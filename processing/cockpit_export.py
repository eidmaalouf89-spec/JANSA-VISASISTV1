"""
JANSA VISASIST — Cockpit JSON Export (v1.4 — open/closed split)
Pre-computes all data structures needed by the V2 React cockpit.
Produces a single cockpit_data.json consumed directly by the UI.
"""
import json
import dataclasses
from pathlib import Path
from datetime import date, timedelta
from collections import Counter, defaultdict

from processing.config import TODAY, resolve_mission, resolve_mission_tier
from processing.models import Submittal, EmetteurStats, ActorStats, WorkflowRow


# ─────────────────────────────────────────────────────────────────
# CATEGORY CLASSIFICATION — deterministic, server-side
# ─────────────────────────────────────────────────────────────────

def classify_submittal(s: Submittal) -> str:
    """Assign a single primary category for the cockpit queue."""
    # EASY_WIN: fully responded, aligned, no blocking → ready for MOEX VAO
    if (s.current_state == "fully_responded"
            and not s.has_blocking_response
            and s.alignment_state == "aligned"):
        return "EASY_WIN"
    # FAST_REJECT: fully responded with rejection/blocking present
    if s.current_state == "fully_responded" and s.rejection_flag:
        return "FAST_REJECT"
    # CONFLICT: hard or soft conflict among respondents
    if s.conflict_severity in ("hard", "soft"):
        return "CONFLICT"
    # BLOCKED: blocking responses but not fully responded yet
    if s.has_blocking_response or s.has_blocking_tag:
        return "BLOCKED"
    # ALL_HORS_MISSION
    if s.current_state == "all_hors_mission":
        return "NOT_STARTED"
    # NO_RESPONSE: no effective response received yet
    if s.alignment_state == "no_response":
        return "NOT_STARTED"
    # WAITING: in progress, no conflict, just waiting
    if s.current_state == "in_progress":
        return "WAITING"
    return "WAITING"


def compute_smart_lists(s: Submittal, cat: str) -> list[str]:
    """Compute which smart lists a submittal belongs to."""
    sl = [cat]
    # CHRONIC: multiple revisions or aging > 60 days
    indice_val = _indice_to_rev(s.indice)
    if indice_val >= 3 or (s.aging_days is not None and s.aging_days > 60):
        sl.append("CHRONIC")
    # MISSING: has pending actors
    if s.pending_count > 0 and s.current_state == "in_progress":
        sl.append("MISSING")
    return list(dict.fromkeys(sl))  # order-preserving dedup


def _indice_to_rev(indice) -> int:
    """Convert indice (A, B, C..., 01, 02...) to revision number."""
    if indice is None:
        return 1
    s = str(indice).strip().upper()
    if s.isdigit():
        return max(int(s), 1)
    if len(s) == 1 and s.isalpha():
        return ord(s) - ord('A') + 1
    return 1


def compute_urgency_score(s: Submittal) -> int:
    """Compute a 0–100 urgency score for queue prioritization."""
    score = 0
    if s.has_blocking_tag:
        score += 30
    if s.conflict_severity == "hard":
        score += 20
    elif s.conflict_severity == "soft":
        score += 10
    # Delay contributes up to 40 points
    if s.max_delay_days is not None and s.max_delay_days > 0:
        score += min(s.max_delay_days, 40)
    # Low completion penalized
    if s.completion_ratio is not None:
        score += int((1.0 - s.completion_ratio) * 15)
    # Chronic revision bonus
    if _indice_to_rev(s.indice) >= 3:
        score += 5
    return min(score, 100)


def map_consensus(s: Submittal) -> str:
    """Map alignment_state to UI-friendly consensus label."""
    mapping = {
        "aligned": "ALL_APPROVE" if not s.has_blocking_response else "ALL_REJECT",
        "hard_conflict": "MIXED",
        "soft_mix": "MIXED",
        "no_response": "NOT_STARTED",
    }
    return mapping.get(s.alignment_state, "INCOMPLETE")


def map_action(s: Submittal) -> str:
    """Map action_needed to a UI action code."""
    an = s.action_needed
    if "Terminé" in an:
        return "ISSUE_VISA"
    if "Arbitrage" in an:
        return "ARBITRATE"
    if "Escalad" in an:
        return "ESCALATE"
    if "Relance" in an:
        return "CHASE"
    if "surveiller" in an:
        return "HOLD"
    if "Pas d'action" in an:
        return "DONE"
    return "HOLD"


# ─────────────────────────────────────────────────────────────────
# QUEUE ITEM BUILDER
# ─────────────────────────────────────────────────────────────────

def build_queue_item(s: Submittal, idx: int) -> dict:
    """Build a single queue item for the cockpit UI."""
    cat = classify_submittal(s)
    sl = compute_smart_lists(s, cat)
    return {
        "id": str(idx + 1),
        "submittal_key": s.submittal_key,
        "doc": s.submittal_id or s.submittal_key,
        "titre": s.attached_filename or s.numero or s.submittal_id or "",
        "lot": s.lot or s.emetteur or "—",
        "emetteur": s.emetteur or "—",
        "cat": cat,
        "score": compute_urgency_score(s),
        "overdue": s.max_delay_days or 0,
        "consensus": map_consensus(s),
        "missing": s.actors_pending,
        "rev": _indice_to_rev(s.indice),
        "action": map_action(s),
        "sl": sl,
        # Detail panel data
        "current_state": s.current_state,
        "alignment_state": s.alignment_state,
        "conflict_severity": s.conflict_severity,
        "worst_tag": s.worst_tag,
        "final_decision": s.final_decision,
        "approval_quality": s.approval_quality,
        "action_needed": s.action_needed,
        "blocking_summary": s.blocking_summary,
        "completion_ratio": s.completion_ratio,
        "holder_count": s.holder_count,
        "current_holders": s.current_holders,
        "late_actors": s.late_actors,
        "aging_days": s.aging_days,
        "is_moex_holder": s.is_moex_holder,
        "is_moex_late": s.is_moex_late,
        "moex_default_flag": s.moex_default_flag,
        "is_arbitration_required": s.is_arbitration_required,
        "responses": s.responses,
        "comments_by_actor": s.comments_by_actor,
        "pending_count": s.pending_count,
        "responded_count": s.responded_count,
        "late_count": s.late_count,
        "indice": s.indice,
        "responsibility_phase": s.responsibility_phase,
        "responsible_missions": s.responsible_missions,
        "secondary_window_remaining": s.secondary_window_remaining,
        "secondary_elapsed_days": s.secondary_elapsed_days,
        "moex_sub_phase": s.moex_sub_phase,
        "defaulted_missions": s.defaulted_missions,
    }


# ─────────────────────────────────────────────────────────────────
# LOT HEALTH BUILDER (from emetteur_stats)
# ─────────────────────────────────────────────────────────────────

def build_lots(em_stats: dict[str, EmetteurStats]) -> list[dict]:
    """Build lot health table from emetteur stats, sorted worst-first."""
    lots = []
    for em, es in em_stats.items():
        # Health = approval_quality_score scaled to 0–100 (score is 1–5 → 20–100)
        raw_score = es.approval_quality_score or 2.0
        health = int(min(max(raw_score * 20, 0), 100))
        lots.append({
            "code": em,
            "name": em,
            "health": health,
            "total": es.total_submittals,
            "pending": es.pending_submittals,
            "overdue": es.late_backlog_count,
            "ref": es.ref_count,
            "chronic": es.problem_submittal_count,
            "fully_responded": es.fully_responded,
            "rejected": es.rejected_submittals,
            "hard_conflict": es.hard_conflict_submittals,
            "backlog": es.backlog_count,
            "avg_completion": round(es.avg_completion_ratio * 100, 1) if es.avg_completion_ratio else 0,
        })
    lots.sort(key=lambda l: l["health"])
    return lots


# ─────────────────────────────────────────────────────────────────
# CATEGORIES BUILDER
# ─────────────────────────────────────────────────────────────────

def build_categories(all_submittals: list[Submittal]) -> list[dict]:
    """Build category breakdown with counts."""
    cats = Counter(classify_submittal(s) for s in all_submittals)
    cat_defs = [
        {"name": "EASY WIN", "key": "EASY_WIN"},
        {"name": "CONFLICT", "key": "CONFLICT"},
        {"name": "BLOCKED", "key": "BLOCKED"},
        {"name": "WAITING", "key": "WAITING"},
        {"name": "FAST REJECT", "key": "FAST_REJECT"},
        {"name": "NOT STARTED", "key": "NOT_STARTED"},
    ]
    for c in cat_defs:
        c["count"] = cats.get(c["key"], 0)
    return cat_defs


# ─────────────────────────────────────────────────────────────────
# KPIs BUILDER
# ─────────────────────────────────────────────────────────────────

def build_kpis(all_submittals: list[Submittal], open_subs: list[Submittal],
               closed_subs: list[Submittal], all_rows: dict[str, list[WorkflowRow]],
               em_stats: dict[str, EmetteurStats], act_stats: dict[str, ActorStats]) -> dict:
    """Build dashboard KPI summary with open/closed split."""
    total = len(all_submittals)
    total_open = len(open_subs)
    total_closed = len(closed_subs)
    clean_close = sum(1 for s in closed_subs if s.close_type == "clean_close")
    forced_close = sum(1 for s in closed_subs if s.close_type == "forced_close")

    # Open-only operational KPIs
    pending = sum(1 for s in open_subs if s.current_state == "in_progress")
    late = sum(1 for s in open_subs if s.delay_state == "late")
    blocked = sum(1 for s in open_subs if s.has_blocking_response or s.has_blocking_tag)
    arbitration = sum(1 for s in open_subs if s.is_arbitration_required)
    moex_holds = sum(1 for s in open_subs if s.is_moex_holder)
    moex_late = sum(1 for s in open_subs if s.is_moex_late)
    problems = sum(1 for s in open_subs if s.is_problem_submittal)
    backlog = sum(1 for s in open_subs if s.is_backlog_item)

    # Average delay among late open submittals
    late_delays = [s.max_delay_days for s in open_subs if s.max_delay_days and s.max_delay_days > 0]
    avg_delay = round(sum(late_delays) / len(late_delays), 1) if late_delays else 0

    # Worst emetteur by health (computed on ALL submittals)
    worst_em = min(em_stats.values(), key=lambda e: e.approval_quality_score or 0) if em_stats else None

    # Worst actor by mission (aggregate holds per mission — open only)
    mission_holds: dict[str, int] = defaultdict(int)
    for ast in act_stats.values():
        mission_holds[resolve_mission(ast.actor_clean)] += ast.holder_count
    worst_mission = max(mission_holds.items(), key=lambda x: x[1]) if mission_holds else (None, 0)

    # Responsibility breakdown (open only — 4 phases)
    resp_primary = sum(1 for s in open_subs if s.responsibility_phase == "primary")
    resp_secondary = sum(1 for s in open_subs if s.responsibility_phase == "secondary")
    resp_moex_relance = sum(1 for s in open_subs if s.responsibility_phase == "moex_relance_secondary")
    resp_moex = sum(1 for s in open_subs if s.responsibility_phase == "moex")

    # Phase 4 (MOEX) sub-phase breakdown (v1.6)
    moex_subs = [s for s in open_subs if s.responsibility_phase == "moex"]
    moex_all_responded = sum(1 for s in moex_subs if s.moex_sub_phase == "all_responded")
    moex_secondary_default = sum(1 for s in moex_subs if s.moex_sub_phase == "secondary_default")
    moex_no_secondary = sum(1 for s in moex_subs if s.moex_sub_phase == "no_secondary")
    moex_orphan = sum(1 for s in moex_subs if s.moex_sub_phase == "orphan")

    # Which secondaries are repeat defaulters? (across all 4b submittals)
    defaulter_counts: dict[str, int] = defaultdict(int)
    for s in moex_subs:
        if s.moex_sub_phase == "secondary_default":
            for m in s.defaulted_missions:
                defaulter_counts[m] += 1
    top_defaulters = sorted(defaulter_counts.items(), key=lambda x: -x[1])

    # Closed submittal breakdown by MOEX decision tag
    closed_by_tag = Counter(s.moex_decision_tag for s in closed_subs if s.moex_decision_tag)

    return {
        "total_submittals": total,
        "total_open": total_open,
        "total_closed": total_closed,
        "clean_close": clean_close,
        "forced_close": forced_close,
        "closed_by_tag": dict(closed_by_tag),
        "resp_primary": resp_primary,
        "resp_secondary": resp_secondary,
        "resp_moex_relance": resp_moex_relance,
        "resp_moex": resp_moex,
        "moex_all_responded": moex_all_responded,
        "moex_secondary_default": moex_secondary_default,
        "moex_no_secondary": moex_no_secondary,
        "moex_orphan": moex_orphan,
        "top_defaulters": [{"mission": m, "count": c} for m, c in top_defaulters],
        "pending": pending,
        "late": late,
        "blocked": blocked,
        "arbitration": arbitration,
        "moex_holds": moex_holds,
        "moex_late": moex_late,
        "problems": problems,
        "backlog": backlog,
        "avg_delay_days": avg_delay,
        "worst_emetteur": worst_em.emetteur if worst_em else None,
        "worst_emetteur_score": round(worst_em.approval_quality_score * 20, 0) if worst_em and worst_em.approval_quality_score else None,
        "worst_emetteur_late": worst_em.late_backlog_count if worst_em else 0,
        "worst_actor": worst_mission[0],
        "worst_actor_holds": worst_mission[1],
        "total_emetteurs": len(em_stats),
    }


# ─────────────────────────────────────────────────────────────────
# SMART LIST COUNTS
# ─────────────────────────────────────────────────────────────────

def build_smart_list_counts(all_submittals: list[Submittal]) -> dict:
    """Pre-compute counts per smart list."""
    counts = defaultdict(int)
    for s in all_submittals:
        cat = classify_submittal(s)
        for tag in compute_smart_lists(s, cat):
            counts[tag] += 1
    return dict(counts)


# ─────────────────────────────────────────────────────────────────
# ACTOR STATS FOR UI
# ─────────────────────────────────────────────────────────────────

def build_actor_stats_ui(act_stats: dict[str, ActorStats]) -> list[dict]:
    """Build actor stats aggregated by unified mission group (22 values).
    Multiple actor_clean values that share the same mission are summed."""
    # Aggregate by mission
    mission_agg: dict[str, dict] = {}
    for ac, ast in act_stats.items():
        mission = resolve_mission(ast.actor_clean)
        if mission not in mission_agg:
            mission_agg[mission] = {
                "mission": mission,
                "actors": [],
                "is_moex": ast.is_moex,
                "holds": 0,
                "sole_holds": 0,
                "late": 0,
                "multi": 0,
                "conflicts": 0,
                "delay_sum": 0.0,
                "delay_count": 0,
                "backlog_shares": [],
            }
        m = mission_agg[mission]
        m["actors"].append(ast.actor_clean)
        m["is_moex"] = m["is_moex"] or ast.is_moex
        m["holds"] += ast.holder_count
        m["sole_holds"] += ast.single_holder_count
        m["late"] += ast.late_pending_count
        m["multi"] += ast.multi_holder_involvement
        m["conflicts"] += ast.hard_conflict_involvement
        if ast.avg_delay_days is not None and ast.avg_delay_days > 0:
            m["delay_sum"] += ast.avg_delay_days
            m["delay_count"] += 1
        if ast.backlog_share is not None:
            m["backlog_shares"].append(ast.backlog_share)

    # Build final list
    items = []
    for mission, m in mission_agg.items():
        avg_delay = round(m["delay_sum"] / m["delay_count"], 1) if m["delay_count"] > 0 else 0
        backlog = round(sum(m["backlog_shares"]) * 100, 1) if m["backlog_shares"] else 0
        items.append({
            "mission": mission,
            "actors": sorted(m["actors"]),
            "is_moex": m["is_moex"],
            "holds": m["holds"],
            "sole_holds": m["sole_holds"],
            "late": m["late"],
            "multi": m["multi"],
            "conflicts": m["conflicts"],
            "avg_delay": avg_delay,
            "backlog_share": backlog,
        })
    items.sort(key=lambda x: -x["holds"])
    return items


# ─────────────────────────────────────────────────────────────────
# TREND 30J — real historical backlog from deadline + response dates
# ─────────────────────────────────────────────────────────────────

def build_trend_30j(all_rows: dict[str, list[WorkflowRow]], days: int = 30,
                    open_keys: set[str] | None = None) -> dict:
    """Compute daily open-submittal count over the last N days.

    For each day D in [TODAY-N .. TODAY], a submittal is considered "open on day D"
    if it has at least one relevant actor row (ANY actor, not just MOEX) where:
      - deadline_date <= D  (the submittal was already active)
      - AND (response_date is None OR response_date > D)  (actor hadn't responded yet)

    Returns {"global": [{date, count}, ...], "by_mission": {mission: [{date, count}, ...]}}
    """
    start = TODAY - timedelta(days=days - 1)
    day_range = [start + timedelta(days=i) for i in range(days)]

    # Pre-index: for each submittal_key, collect ALL relevant rows with their dates
    # If open_keys is provided, only include submittals that are currently open
    sub_all_rows: dict[str, list[tuple[date | None, date | None]]] = defaultdict(list)
    # Per mission (including MOEX): submittal_key → list of (deadline, response_date)
    mission_rows: dict[str, dict[str, list[tuple[date | None, date | None]]]] = defaultdict(lambda: defaultdict(list))

    for skey, rows in all_rows.items():
        if open_keys is not None and skey not in open_keys:
            continue
        for r in rows:
            if not r.is_relevant_actor:
                continue
            dl = r.deadline_date
            rd = r.response_date
            sub_all_rows[skey].append((dl, rd))
            mission = "MOEX" if r.is_moex else resolve_mission(r.actor_clean)
            mission_rows[mission][skey].append((dl, rd))

    # Global trend: count submittals open on each day (based on ANY relevant actor)
    global_trend = []
    for d in day_range:
        open_count = 0
        for skey, all_dates in sub_all_rows.items():
            is_open = any(
                (dl is not None and dl <= d and (rd is None or rd > d))
                for dl, rd in all_dates
            )
            if is_open:
                open_count += 1
        global_trend.append({"date": d.isoformat(), "count": open_count})

    # Per-mission trend (including MOEX): for each mission, count submittals
    # where that mission had a pending row on day D
    by_mission = {}
    for mission, skey_rows in mission_rows.items():
        if len(skey_rows) < 5:  # skip missions with very few submittals
            continue
        trend = []
        for d in day_range:
            pending_count = 0
            for skey, dates_list in skey_rows.items():
                is_pending = any(
                    (dl is not None and dl <= d and (rd is None or rd > d))
                    for dl, rd in dates_list
                )
                if is_pending:
                    pending_count += 1
            trend.append({"date": d.isoformat(), "count": pending_count})
        by_mission[mission] = trend

    return {
        "global": global_trend,
        "by_mission": by_mission,
    }


# ─────────────────────────────────────────────────────────────────
# MAIN EXPORT
# ─────────────────────────────────────────────────────────────────

def build_closed_summary(closed_subs: list[Submittal]) -> dict:
    """Build summary analytics for closed submittals (post-mortem view)."""
    if not closed_subs:
        return {"count": 0, "by_close_type": {}, "by_decision_tag": {}, "by_emetteur": {}}

    by_close_type = Counter(s.close_type for s in closed_subs)
    by_tag = Counter(s.moex_decision_tag for s in closed_subs if s.moex_decision_tag)
    by_emetteur = Counter(s.emetteur for s in closed_subs if s.emetteur)

    # Rejection rate per emetteur (closed submittals only)
    em_totals: dict[str, int] = defaultdict(int)
    em_rejected: dict[str, int] = defaultdict(int)
    for s in closed_subs:
        em = s.emetteur or "—"
        em_totals[em] += 1
        if s.moex_decision_tag in ("REF", "DEF"):
            em_rejected[em] += 1

    emetteur_rejection = []
    for em in sorted(em_totals.keys()):
        t = em_totals[em]
        r = em_rejected.get(em, 0)
        emetteur_rejection.append({
            "emetteur": em,
            "total_closed": t,
            "rejected": r,
            "rejection_rate": round(r / t * 100, 1) if t > 0 else 0,
        })
    emetteur_rejection.sort(key=lambda x: -x["rejection_rate"])

    return {
        "count": len(closed_subs),
        "by_close_type": dict(by_close_type),
        "by_decision_tag": dict(by_tag),
        "by_emetteur": dict(by_emetteur),
        "emetteur_rejection": emetteur_rejection,
    }


def export_cockpit_json(
    all_submittals: list[Submittal],
    all_rows: dict[str, list[WorkflowRow]],
    em_stats: dict[str, EmetteurStats],
    act_stats: dict[str, ActorStats],
    output_dir: Path,
    socotec_registry: list[dict] | None = None,
) -> Path:
    """Export the full cockpit JSON consumed by the V2 React UI (v1.7 — SOCOTEC registry)."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Open / Closed split ──
    open_subs = [s for s in all_submittals if not s.is_closed]
    closed_subs = [s for s in all_submittals if s.is_closed]

    # Queue, categories, smart lists: OPEN ONLY
    scored = [(s, compute_urgency_score(s)) for s in open_subs]
    scored.sort(key=lambda x: -x[1])
    queue_data = [build_queue_item(s, i) for i, (s, _) in enumerate(scored)]
    categories = build_categories(open_subs)
    sl_counts = build_smart_list_counts(open_subs)

    # KPIs: include both open and closed counts
    kpis = build_kpis(all_submittals, open_subs, closed_subs, all_rows, em_stats, act_stats)

    # Lots (santé émetteurs): ALL submittals
    lots = build_lots(em_stats)

    # Mission stats: ALL submittals
    mission_stats_ui = build_actor_stats_ui(act_stats)

    # Closed summary for post-mortem analysis
    closed_summary = build_closed_summary(closed_subs)

    # Trend 30j from real deadline/response dates
    open_keys = {s.submittal_key for s in open_subs}
    trend_30j = build_trend_30j(all_rows, open_keys=open_keys)

    cockpit = {
        "generated_at": TODAY.isoformat(),
        "version": "1.7",
        "kpis": kpis,
        "categories": categories,
        "smart_list_counts": sl_counts,
        "lots": lots,
        "queue": queue_data,
        "mission_stats": mission_stats_ui,
        "closed_summary": closed_summary,
        "trend_30j": trend_30j,
        "socotec_registry": socotec_registry or [],
    }

    out = output_dir / "cockpit_data.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(cockpit, f, ensure_ascii=False, indent=2, default=str)

    return out
