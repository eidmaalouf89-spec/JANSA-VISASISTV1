"""
JANSA VISASIST — Deterministic business rules + aggregations.
Extracted exactly from validate_schema.py's analyze_submittal(),
build_emetteur_stats(), and build_actor_stats().
"""
from collections import defaultdict

from processing.config import (
    TODAY, PROBLEM_HOLDER_THRESHOLD, TAG_PRIORITY,
    resolve_worst_tag, has_blocking_tag,
    lateness_bucket, resolve_final_decision, resolve_approval_quality,
    ACTION_LABELS,
    resolve_mission, resolve_mission_tier, SECONDARY_WINDOW_DAYS, MOEX_CLOSE_THRESHOLD_DAYS,
)
from processing.models import (
    WorkflowRow, ResponseDetail, Submittal,
    EmetteurStats, ActorStats,
)

QUALITY_SCORE = {"clean": 5, "with_reservations": 4, "mixed": 3, "pending": 2, "blocked": 1}


# ═══════════════════════════════════════════════════════════════════════════
# ANALYZE SUBMITTAL
# ═══════════════════════════════════════════════════════════════════════════

def analyze_submittal(rows: list[WorkflowRow], actor_map: dict) -> Submittal:
    """Build a fully analyzed Submittal from its WorkflowRow group.
    All deterministic rules applied here."""
    first = rows[0]

    # --- Deduplicated actor lists ---
    actors_expected  = list(dict.fromkeys(r.actor_clean for r in rows if r.is_relevant_actor))
    actors_pending   = list(dict.fromkeys(r.actor_clean for r in rows if r.is_relevant_actor and r.is_pending))
    actors_responded = list(dict.fromkeys(r.actor_clean for r in rows if r.is_active_row and r.has_effective_response))
    actors_hm        = list(dict.fromkeys(r.actor_clean for r in rows if r.is_hors_mission))
    actors_irrel     = list(dict.fromkeys(r.actor_clean for r in rows if not r.is_relevant_actor))

    # --- Comments (all actors, always append, never overwrite) ---
    comments: dict[str, list[str]] = defaultdict(list)
    for r in rows:
        if r.comment_raw:
            comments[r.actor_clean].append(r.comment_raw)

    # --- Responses (all actors — AI-ready, preserves irrelevant) ---
    responses = [ResponseDetail(
        actor_clean=r.actor_clean, actor_family=r.actor_family,
        is_relevant=r.is_relevant_actor, is_moex=r.is_moex,
        response_tag_code=r.response_tag_code, response_severity=r.response_severity,
        deadline_date=r.deadline_date.isoformat() if r.deadline_date else None,
        response_date=r.response_date.isoformat() if r.response_date else None,
        delay_days=r.delay_days, is_pending=r.is_pending, is_late=r.is_late,
        has_effective_response=r.has_effective_response, comment=r.comment_raw,
    ).to_dict() for r in rows]

    # --- Active rows ---
    active = [r for r in rows if r.is_active_row]
    active_responded = [r for r in active if r.has_effective_response]
    active_pending = [r for r in active if r.is_pending]
    active_row_count = len(active)

    # --- Tags (deterministic via TAG_PRIORITY) ---
    all_active_tags = list(set(
        r.response_tag_code for r in active
        if r.response_tag_code is not None
    ))
    tags_responded = list(dict.fromkeys(r.response_tag_code for r in active_responded))
    severities = set(r.response_severity for r in active_responded)
    wt = resolve_worst_tag(all_active_tags)
    hbt = has_blocking_tag(all_active_tags)
    tags_present = tags_responded

    # --- State ---
    if not active:
        current_state = "all_hors_mission"
    elif all(not r.is_pending for r in active):
        current_state = "fully_responded"
    elif any(r.is_pending for r in active):
        current_state = "in_progress"
    else:
        current_state = "unknown"

    # --- Alignment (severity-based, worst_tag via priority) ---
    if not active_responded:
        alignment_state, aligned_tag, conflict_severity = "no_response", None, "none"
    elif len(set(tags_present)) == 1:
        alignment_state, aligned_tag, conflict_severity = "aligned", tags_present[0], "none"
    elif "blocking" in severities and ("favorable" in severities or "caution" in severities):
        alignment_state, aligned_tag, conflict_severity = "hard_conflict", None, "hard"
    else:
        alignment_state, aligned_tag, conflict_severity = "soft_mix", None, "soft"

    has_blocking = any(r.response_severity == "blocking" for r in active_responded)

    # --- Holding (deduplicated) ---
    current_holders = list(dict.fromkeys(r.actor_clean for r in active_pending))
    holder_count = len(current_holders)
    primary_holder = current_holders[0] if holder_count == 1 else None
    if holder_count == 0:
        holding_state = "fully_responded" if current_state == "fully_responded" else "no_holder"
    elif holder_count == 1:
        holding_state = "single_holder"
    else:
        holding_state = "multiple_holders"

    # --- Delay (null-safe) ---
    late_actors = list(dict.fromkeys(r.actor_clean for r in active_pending if r.is_late))
    late_count = len(late_actors)
    if holder_count == 0:
        delay_state = "not_applicable"
    elif late_count == 0:
        delay_state = "no_delay"
    else:
        delay_state = "late"
    late_delays = [abs((TODAY - r.deadline_date).days) for r in active_pending
                   if r.is_late and r.deadline_date is not None]
    max_delay_days = max(late_delays) if late_delays else None

    # --- Completion ---
    completion_ratio = (len(active_responded) / active_row_count) if active_row_count > 0 else None

    # --- Decision ---
    final_decision = resolve_final_decision(current_state, has_blocking, conflict_severity)
    approval_quality = resolve_approval_quality(final_decision, conflict_severity)

    # --- Special signal ---
    has_special_signal = any(
        (not r.is_relevant_actor and r.comment_raw)
        or (not r.is_relevant_actor and r.response_tag_code not in ("NONE", "HM", "EN_ATTENTE"))
        for r in rows
    )

    # --- Rejection flag ---
    rejection_flag = any(r.response_tag_code in ("REF", "DEF") for r in active_responded)

    # --- MOEX cockpit (uses is_moex from row, not family lookup) ---
    moex_holders = [r.actor_clean for r in active_pending if r.is_moex]
    moex_holders = list(dict.fromkeys(moex_holders))
    is_moex_holder = len(moex_holders) > 0
    is_moex_sole_holder = (holder_count == 1 and is_moex_holder)
    moex_late_set = set(moex_holders) & set(late_actors)
    is_moex_late = len(moex_late_set) > 0
    moex_default_flag = is_moex_holder and is_moex_late
    moex_delay_list = [abs((TODAY - r.deadline_date).days) for r in active_pending
                       if r.is_late and r.is_moex and r.deadline_date is not None]
    moex_delay_days = max(moex_delay_list) if moex_delay_list else None

    ext_holders = [a for a in current_holders if a not in moex_holders]
    is_waiting_external = (holder_count > 0 and not is_moex_holder)

    # --- Arbitration ---
    is_arbitration_required = (
        conflict_severity == "hard"
        or (has_blocking and len(severities - {"blocking"}) > 0)
    )

    # --- Problem ---
    is_problem = (
        conflict_severity == "hard" or has_blocking or late_count > 0
        or holder_count >= PROBLEM_HOLDER_THRESHOLD
        or (has_special_signal and conflict_severity != "none")
    )

    # --- Backlog ---
    is_backlog = (current_state == "in_progress")
    if not is_backlog:
        backlog_bucket = "completed"
    elif is_arbitration_required:
        backlog_bucket = "arbitration_pending"
    elif is_moex_holder and not is_waiting_external:
        backlog_bucket = "moex_pending"
    elif holder_count > 1:
        backlog_bucket = "multi_holder_pending"
    else:
        backlog_bucket = "external_pending"

    # --- Aging (proxy: days since earliest active deadline, clamped ≥ 0) ---
    active_deadlines = [r.deadline_date for r in active if r.deadline_date is not None]
    if active_deadlines:
        raw_aging = (TODAY - min(active_deadlines)).days
        aging_days = max(raw_aging, 0)
    else:
        aging_days = None

    # --- Lateness bucket ---
    lb = lateness_bucket(max_delay_days)

    # --- Action needed ---
    if current_state == "fully_responded" and not is_arbitration_required:
        action_needed = ACTION_LABELS["completed"]
    elif is_arbitration_required:
        action_needed = ACTION_LABELS["arbitration"]
    elif is_moex_holder and is_moex_late:
        action_needed = ACTION_LABELS["relance_moex"]
    elif holding_state == "single_holder" and primary_holder:
        action_needed = ACTION_LABELS["relance_single"].format(holder=primary_holder)
    elif holding_state == "multiple_holders":
        action_needed = ACTION_LABELS["relance_multiple"]
    elif current_state == "in_progress" and delay_state == "no_delay":
        action_needed = ACTION_LABELS["monitor"]
    elif current_state == "all_hors_mission":
        action_needed = ACTION_LABELS["neutral"]
    else:
        action_needed = ACTION_LABELS["unknown"]

    # --- Blocking summary ---
    if holding_state == "fully_responded" and conflict_severity == "hard":
        bs = "Terminé avec conflit dur (REF présent)"
    elif holding_state == "single_holder" and delay_state == "late":
        bs = f"Tenu par {primary_holder} (retard {max_delay_days}j)"
    elif holding_state == "single_holder":
        bs = f"Tenu par {primary_holder}"
    elif holding_state == "multiple_holders" and delay_state == "late":
        bs = f"{holder_count} acteurs, {late_count} en retard"
    elif holding_state == "multiple_holders":
        bs = f"{holder_count} acteurs en attente"
    elif holding_state == "fully_responded" and conflict_severity == "soft":
        bs = "Terminé (mix léger)"
    elif current_state == "fully_responded":
        bs = "Terminé"
    else:
        bs = current_state

    # --- Open / Closed split (v1.4) ---
    # A submittal is closed when any MOEX row has an effective response
    # (tag is not EN_ATTENTE, not NONE — includes HM which means MOEX declined review)
    moex_responded_rows = [r for r in rows if r.is_moex and r.response_tag_code not in ("EN_ATTENTE", "NONE")]
    if moex_responded_rows:
        _is_closed = True
        # Pick the "best" MOEX decision row (worst tag by priority = most decisive)
        _best_moex = min(moex_responded_rows,
                         key=lambda r: TAG_PRIORITY.get(r.response_tag_code, 99))
        _moex_decision_tag = _best_moex.response_tag_code
        _moex_decision_comment = _best_moex.comment_raw
        # clean_close = all active actors responded; forced_close = some still pending
        if current_state == "fully_responded":
            _close_type = "clean_close"
        else:
            _close_type = "forced_close"
    else:
        _is_closed = False
        _close_type = "open"
        _moex_decision_tag = None
        _moex_decision_comment = None

    # --- Responsibility attribution (v1.5 + v1.6 sub-phases) ---
    # Phase 1: primary    — at least one primary consultant still EN_ATTENTE
    # Phase 2: secondary  — primaries done, <SECONDARY_WINDOW_DAYS elapsed, secondaries pending
    # Phase 3: moex_relance_secondary — 10–30d elapsed, secondaries still pending → MOEX chases
    # Phase 4: moex       — >30d elapsed OR all secondaries responded → MOEX closes
    #   4a: all_responded     — every solicited actor responded → MOEX synthesizes & closes
    #   4b: secondary_default — >30d, secondaries never responded → inherited (secondary failure)
    #   4c: no_secondary      — no secondaries solicited, primaries done → direct close
    #   4d: orphan            — no primary response dates / no relevant non-MOEX rows
    _secondary_elapsed = None
    _moex_sub = None        # v1.6
    _defaulted = []         # v1.6
    if _is_closed:
        _resp_phase = "moex"
        _resp_missions = []
        _last_primary_date = None
        _secondary_remaining = None
    else:
        # Classify each active relevant row by mission tier
        _primary_pending = []
        _secondary_pending = []
        _secondary_responded = []
        _primary_response_dates = []
        _has_secondary_solicited = False

        for r in rows:
            if not r.is_relevant_actor or r.is_moex:
                continue
            tier = resolve_mission_tier(r.actor_clean)
            mission = resolve_mission(r.actor_clean)

            if tier == "primary":
                if r.is_pending:
                    _primary_pending.append(mission)
                elif r.response_date is not None:
                    _primary_response_dates.append(r.response_date)
            elif tier == "secondary":
                _has_secondary_solicited = True
                if r.is_pending:
                    _secondary_pending.append(mission)
                else:
                    _secondary_responded.append(mission)

        # Deduplicate
        _primary_pending = list(dict.fromkeys(_primary_pending))
        _secondary_pending = list(dict.fromkeys(_secondary_pending))
        _secondary_responded = list(dict.fromkeys(_secondary_responded))

        if _primary_pending:
            # Phase 1: primaries still pending
            _resp_phase = "primary"
            _resp_missions = _primary_pending
            _last_primary_date = None
            _secondary_remaining = None
        elif _primary_response_dates:
            _last_primary_date = max(_primary_response_dates)
            elapsed = (TODAY - _last_primary_date).days
            _secondary_elapsed = elapsed

            if _secondary_pending and elapsed < SECONDARY_WINDOW_DAYS:
                # Phase 2: secondary window open
                _resp_phase = "secondary"
                _resp_missions = _secondary_pending
                _secondary_remaining = SECONDARY_WINDOW_DAYS - elapsed
            elif _secondary_pending and elapsed < MOEX_CLOSE_THRESHOLD_DAYS:
                # Phase 3: window elapsed, secondaries still pending, <30d
                _resp_phase = "moex_relance_secondary"
                _resp_missions = _secondary_pending
                _secondary_remaining = None
            else:
                # Phase 4: MOEX closes
                _resp_phase = "moex"
                _secondary_remaining = None
                if not _has_secondary_solicited:
                    # 4c: no secondaries were ever solicited
                    _moex_sub = "no_secondary"
                    _resp_missions = []
                elif _secondary_pending:
                    # 4b: secondaries timed out (>30d), never responded
                    _moex_sub = "secondary_default"
                    _resp_missions = _secondary_pending
                    _defaulted = list(_secondary_pending)
                else:
                    # 4a: all actors (primary + secondary) have responded
                    _moex_sub = "all_responded"
                    _resp_missions = []
        else:
            # No primary rows at all (edge case) → orphan
            _resp_phase = "moex"
            _resp_missions = []
            _last_primary_date = None
            _secondary_remaining = None
            _moex_sub = "orphan"

    return Submittal(
        submittal_key=first.submittal_key, submittal_id=first.submittal_id, indice=first.indice,
        directory=first.directory, affaire=first.affaire, projet=first.projet,
        batiment=first.batiment, phase=first.phase, emetteur=first.emetteur,
        specialite=first.specialite, lot=first.lot, type_doc=first.type_doc,
        zone=first.zone, niveau=first.niveau, numero=first.numero,
        attached_filename=first.attached_filename,
        row_count=len(rows), active_row_count=active_row_count,
        actors_expected=actors_expected, actors_pending=actors_pending,
        actors_responded=actors_responded, actors_hors_mission=actors_hm,
        actors_irrelevant=actors_irrel, response_tags_present=tags_present,
        comments_by_actor=dict(comments), responses=responses,
        current_state=current_state,
        alignment_state=alignment_state, aligned_tag=aligned_tag,
        conflict_severity=conflict_severity, worst_tag=wt,
        has_blocking_response=has_blocking, has_blocking_tag=hbt,
        current_holders=current_holders, primary_holder=primary_holder,
        holder_count=holder_count, holding_state=holding_state,
        late_actors=late_actors, delay_state=delay_state, max_delay_days=max_delay_days,
        blocking_summary=bs,
        pending_count=len(actors_pending), responded_count=len(actors_responded), late_count=late_count,
        completion_ratio=completion_ratio,
        final_decision=final_decision, approval_quality=approval_quality,
        action_needed=action_needed, has_special_signal=has_special_signal,
        is_moex_holder=is_moex_holder, is_moex_sole_holder=is_moex_sole_holder,
        is_moex_late=is_moex_late, moex_delay_days=moex_delay_days,
        moex_default_flag=moex_default_flag,
        is_waiting_external=is_waiting_external, external_holders=ext_holders,
        is_arbitration_required=is_arbitration_required,
        is_problem_submittal=is_problem, is_backlog_item=is_backlog,
        backlog_bucket=backlog_bucket, aging_days=aging_days,
        lateness_bucket=lb, rejection_flag=rejection_flag,
        is_closed=_is_closed, close_type=_close_type,
        moex_decision_tag=_moex_decision_tag,
        moex_decision_comment=_moex_decision_comment,
        responsibility_phase=_resp_phase,
        responsible_missions=_resp_missions,
        last_primary_response_date=_last_primary_date,
        secondary_window_remaining=_secondary_remaining,
        secondary_elapsed_days=_secondary_elapsed,
        moex_sub_phase=_moex_sub,
        defaulted_missions=_defaulted,
    )


def analyze_all(grouped: dict[str, list[WorkflowRow]], actor_map: dict) -> list[Submittal]:
    """Run analyze_submittal on all groups."""
    return [analyze_submittal(grp, actor_map) for grp in grouped.values()]


# ═══════════════════════════════════════════════════════════════════════════
# EMETTEUR AGGREGATION
# ═══════════════════════════════════════════════════════════════════════════

def build_emetteur_stats(all_submittals: list[Submittal]) -> dict[str, EmetteurStats]:
    """Aggregate per-emetteur metrics from submittal-level data."""
    stats: dict[str, EmetteurStats] = {}
    for s in all_submittals:
        em = s.emetteur or "UNKNOWN"
        if em not in stats:
            stats[em] = EmetteurStats(emetteur=em)
        es = stats[em]
        es.total_submittals += 1
        if s.current_state == "fully_responded":
            es.fully_responded += 1
        if s.current_state == "in_progress":
            es.pending_submittals += 1
        if s.final_decision == "rejected":
            es.rejected_submittals += 1
        if s.conflict_severity == "hard":
            es.hard_conflict_submittals += 1
        if s.is_moex_holder:
            es.held_at_moex += 1
        if s.is_waiting_external:
            es.held_externally += 1
        if s.is_problem_submittal:
            es.problem_submittal_count += 1
        if s.is_backlog_item:
            es.backlog_count += 1
            if s.delay_state == "late":
                es.late_backlog_count += 1
        if "REF" in s.response_tags_present:
            es.ref_count += 1
        if "DEF" in s.response_tags_present:
            es.def_count += 1
        if s.has_blocking_response:
            es.blocking_response_count += 1
        aq = s.approval_quality
        if aq in es.approval_quality_distribution:
            es.approval_quality_distribution[aq] += 1

    # Compute averages
    for em, es in stats.items():
        subs = [s for s in all_submittals if (s.emetteur or "UNKNOWN") == em]
        ratios = [s.completion_ratio for s in subs if s.completion_ratio is not None]
        es.avg_completion_ratio = (sum(ratios) / len(ratios)) if ratios else None
        scores = [QUALITY_SCORE.get(s.approval_quality, 2) for s in subs]
        es.approval_quality_score = (sum(scores) / len(scores)) if scores else None

    return stats


# ═══════════════════════════════════════════════════════════════════════════
# ACTOR AGGREGATION
# ═══════════════════════════════════════════════════════════════════════════

def build_actor_stats(
    all_submittals: list[Submittal],
    all_rows: dict[str, list[WorkflowRow]],
) -> dict[str, ActorStats]:
    """Aggregate per-actor bottleneck metrics from submittal + row data."""
    total_backlog = sum(1 for s in all_submittals if s.is_backlog_item)
    stats: dict[str, ActorStats] = {}

    # Row-level: active_pending_count, late_pending_count
    for skey, rows in all_rows.items():
        for r in rows:
            if not r.is_relevant_actor:
                continue
            ac = r.actor_clean
            if ac not in stats:
                stats[ac] = ActorStats(actor_clean=ac, actor_family=r.actor_family, is_moex=r.is_moex)
            ast = stats[ac]
            if r.is_active_row and r.is_pending:
                ast.active_pending_count += 1
            if r.is_active_row and r.is_late:
                ast.late_pending_count += 1

    # Submittal-level: holder_count, single_holder, multi_holder, hard_conflict
    for s in all_submittals:
        for h in s.current_holders:
            if h not in stats:
                fam = next((r["actor_family"] for r in s.responses if r["actor_clean"] == h), None)
                moex = next((r["is_moex"] for r in s.responses if r["actor_clean"] == h), False)
                stats[h] = ActorStats(actor_clean=h, actor_family=fam, is_moex=moex)
            ast = stats[h]
            ast.holder_count += 1
            if s.holding_state == "single_holder" and s.primary_holder == h:
                ast.single_holder_count += 1
            if s.holding_state == "multiple_holders":
                ast.multi_holder_involvement += 1
        if s.conflict_severity == "hard":
            for ac in s.actors_responded:
                if ac in stats:
                    stats[ac].hard_conflict_involvement += 1

    # avg_delay_days from rows
    delay_accum: dict[str, list[int]] = defaultdict(list)
    for skey, rows in all_rows.items():
        for r in rows:
            if r.is_active_row and r.is_late and r.deadline_date:
                delay_accum[r.actor_clean].append(abs((TODAY - r.deadline_date).days))
    for ac, delays in delay_accum.items():
        if ac in stats and delays:
            stats[ac].avg_delay_days = sum(delays) / len(delays)

    # backlog_share
    for ac, ast in stats.items():
        ast.backlog_share = (ast.holder_count / total_backlog) if total_backlog > 0 else None

    return stats
