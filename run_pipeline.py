"""
JANSA VISASIST — Headless Pipeline
Usage: python run_pipeline.py <path_to_excel>
"""
import json
import sys
from pathlib import Path
from collections import Counter
from datetime import date

# Ensure project root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from processing.config import TODAY, OUTPUT_DIR, SOCOTEC_REGISTRY_PATH, SOCOTEC_VERDICTS_PATH
from processing.normalizer import normalize
from processing.grouper import group_submittals
from processing.analyzer import analyze_all, build_emetteur_stats, build_actor_stats
from processing.exporter import (
    export_workflow_rows, export_submittals, export_anomalies,
    export_emetteur_stats, export_actor_stats,
)
from processing.cockpit_export import export_cockpit_json
from processing.gemo_nj import apply_gemo_nj


def main(excel_path: str):
    P = print

    # 1. Normalize
    rows, anomalies, actor_map, status_map = normalize(excel_path)

    # 2. Group
    grouped = group_submittals(rows)

    # 2b. GEMO_NJ post-processing (submittal-level, before analysis)
    gemo_nj_stats = apply_gemo_nj(grouped)

    # 3. Analyze
    all_subs = analyze_all(grouped, actor_map)

    # 4. Aggregations
    em_stats = build_emetteur_stats(all_subs)
    act_stats = build_actor_stats(all_subs, grouped)

    # 4b. Load SOCOTEC registry for cockpit
    socotec_registry = []
    if SOCOTEC_REGISTRY_PATH.exists():
        with open(SOCOTEC_REGISTRY_PATH, "r", encoding="utf-8") as f:
            socotec_registry = json.load(f)
    socotec_verdicts_count = 0
    if SOCOTEC_VERDICTS_PATH.exists():
        with open(SOCOTEC_VERDICTS_PATH, "r", encoding="utf-8") as f:
            socotec_verdicts_count = len(json.load(f))

    # 5. Export
    output_dir = OUTPUT_DIR
    export_workflow_rows(rows, output_dir)
    export_submittals(all_subs, output_dir)
    export_anomalies(anomalies, output_dir)
    export_emetteur_stats(em_stats, output_dir)
    export_actor_stats(act_stats, output_dir)
    cockpit_path = export_cockpit_json(all_subs, grouped, em_stats, act_stats, output_dir,
                                       socotec_registry=socotec_registry)

    # 6. Summary report
    P("=" * 74)
    P("  JANSA VISASIST — PIPELINE REPORT (v1.3)")
    P("=" * 74)

    P(f"\n{'─'*74}\n  1. DATA LOADING\n{'─'*74}")
    P(f"  Rows:           {len(rows)}")
    P(f"  Submittals:     {len(grouped)}")
    P(f"  Anomalies:      {len(anomalies)}")

    tr = sum(1 for r in rows if r.is_relevant_actor)
    ta = sum(1 for r in rows if r.is_active_row)
    P(f"\n  Relevant rows:  {tr}   Irrelevant: {len(rows) - tr}")
    P(f"  Active rows:    {ta}   Effective resp: {sum(1 for r in rows if r.has_effective_response)}")
    P(f"  Pending:        {sum(1 for r in rows if r.is_pending)}   Late: {sum(1 for r in rows if r.is_late)}")

    P(f"\n{'─'*74}\n  2. STATE / DECISION / ALIGNMENT\n{'─'*74}")
    for label, fn in [("State", lambda s: s.current_state), ("Decision", lambda s: s.final_decision),
                      ("Alignment", lambda s: s.alignment_state)]:
        P(f"  {label}:")
        for k, v in Counter(fn(s) for s in all_subs).most_common():
            P(f"    {k:30s} {v:>5d}")

    P(f"\n{'─'*74}\n  3. MOEX COCKPIT\n{'─'*74}")
    mh = sum(1 for s in all_subs if s.is_moex_holder)
    ms = sum(1 for s in all_subs if s.is_moex_sole_holder)
    ml = sum(1 for s in all_subs if s.is_moex_late)
    md = sum(1 for s in all_subs if s.moex_default_flag)
    ew = sum(1 for s in all_subs if s.is_waiting_external)
    bl = sum(1 for s in all_subs if s.is_backlog_item)
    P(f"  MOEX holds: {mh}  sole: {ms}  late: {ml}  default: {md}")
    P(f"  External waiting: {ew}   Total backlog: {bl}")
    P(f"  Arbitration: {sum(1 for s in all_subs if s.is_arbitration_required)}  Problems: {sum(1 for s in all_subs if s.is_problem_submittal)}")

    P(f"\n  Backlog buckets:")
    for k, v in Counter(s.backlog_bucket for s in all_subs).most_common():
        P(f"    {k:30s} {v:>5d}")
    P(f"\n  Action needed:")
    for k, v in Counter(s.action_needed for s in all_subs).most_common():
        P(f"    {k:42s} {v:>5d}")

    P(f"\n{'─'*74}\n  3b. SOCOTEC INJECTION\n{'─'*74}")
    for a in anomalies:
        if getattr(a, 'anomaly_type', '') == "socotec_verdict_injection":
            P(f"  {a.message}")
    P(f"  SOCOTEC registry:  {len(socotec_registry)} fiches processed")
    P(f"  SOCOTEC verdicts:  {socotec_verdicts_count} hardcoded numeros")

    P(f"\n{'─'*74}\n  3c. GEMO_NJ — Hors Mission BdC (submittal-level)\n{'─'*74}")
    P(f"  Submittals tagged:  {gemo_nj_stats['submittals_tagged']}")
    P(f"  Rows tagged:        {gemo_nj_stats['rows_tagged']}")
    if gemo_nj_stats['by_spec']:
        P(f"  By specialité:")
        for spec, cnt in sorted(gemo_nj_stats['by_spec'].items(), key=lambda x: -x[1]):
            P(f"    {spec:8s}  {cnt} rows")

    P(f"\n{'─'*74}\n  4. EMETTEUR PERFORMANCE (top 5 by rejection)\n{'─'*74}")
    for em, es in sorted(em_stats.items(), key=lambda x: -x[1].rejected_submittals)[:5]:
        P(f"  {em:8s}  total={es.total_submittals:>4d}  rej={es.rejected_submittals:>3d}  "
          f"ref={es.ref_count:>3d}  def={es.def_count:>3d}  block={es.blocking_response_count:>3d}  "
          f"hard={es.hard_conflict_submittals:>3d}  backlog={es.backlog_count:>4d}  "
          f"score={es.approval_quality_score or 0:.1f}")

    P(f"\n{'─'*74}\n  5. ACTOR BOTTLENECK (top 10)\n{'─'*74}")
    for ac, ast in sorted(act_stats.items(), key=lambda x: -x[1].holder_count)[:10]:
        moex_tag = " [MOEX]" if ast.is_moex else ""
        P(f"  {ac:35s}  holds={ast.holder_count:>4d}  sole={ast.single_holder_count:>3d}  "
          f"late={ast.late_pending_count:>4d}  multi={ast.multi_holder_involvement:>4d}  "
          f"conflict={ast.hard_conflict_involvement:>3d}  "
          f"avg_delay={ast.avg_delay_days or 0:.0f}d  share={ast.backlog_share or 0:.1%}{moex_tag}")

    P(f"\n{'─'*74}\n  6. EXPORTS\n{'─'*74}")
    P(f"  Output dir:     {output_dir}")
    P(f"  workflow_rows.csv  ({len(rows)} rows)")
    P(f"  submittals.csv     ({len(all_subs)} submittals)")
    P(f"  anomalies.json     ({len(anomalies)} anomalies)")
    P(f"  emetteur_stats.csv ({len(em_stats)} emetteurs)")
    P(f"  actor_stats.csv    ({len(act_stats)} actors)")
    P(f"  cockpit_data.json  (V2 UI cockpit data)")

    P(f"\n{'═'*74}")
    P(f"  PIPELINE COMPLETE")
    P(f"{'═'*74}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_pipeline.py <path_to_excel>")
        sys.exit(1)
    main(sys.argv[1])
