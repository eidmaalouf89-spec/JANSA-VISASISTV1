"""
JANSA VISASIST — Data Models (v1.3 — final stabilization patch)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from typing import Optional


@dataclass
class WorkflowRow:
    source_row_index: int
    directory: Optional[str]
    submittal_id: Optional[str]
    affaire: Optional[str]
    projet: Optional[str]
    batiment: Optional[str]
    phase: Optional[str]
    emetteur: Optional[str]
    specialite: Optional[str]
    lot: Optional[str]
    type_doc: Optional[str]
    zone: Optional[str]
    niveau: Optional[str]
    numero: Optional[str]
    indice: Optional[str]
    attached_filename: Optional[str]
    submittal_key: str = ""
    actor_raw: Optional[str] = None
    actor_prefix: Optional[str] = None
    actor_role: Optional[str] = None
    actor_clean: Optional[str] = None
    actor_family: Optional[str] = None
    is_relevant_actor: bool = False
    is_moex: bool = False                   # v1.3: explicit MOEX flag from actor_map
    respondant: Optional[str] = None
    deadline_raw: Optional[str] = None
    deadline_date: Optional[date] = None
    response_date_raw: Optional[str] = None
    response_date: Optional[date] = None
    delay_raw: Optional[str] = None
    delay_days: Optional[int] = None
    response_tag_raw: Optional[str] = None
    response_tag_clean: Optional[str] = None
    response_tag_code: Optional[str] = None
    response_severity: Optional[str] = None
    comment_raw: Optional[str] = None
    is_pending: bool = False
    is_late: bool = False
    is_hors_mission: bool = False
    has_response_raw: bool = False
    has_effective_response: bool = False
    is_active_row: bool = False


@dataclass
class ResponseDetail:
    actor_clean: str
    actor_family: Optional[str]
    is_relevant: bool
    is_moex: bool                           # v1.3
    response_tag_code: Optional[str]
    response_severity: Optional[str]
    deadline_date: Optional[str]
    response_date: Optional[str]
    delay_days: Optional[int]
    is_pending: bool
    is_late: bool
    has_effective_response: bool
    comment: Optional[str]

    def to_dict(self) -> dict:
        return {
            "actor_clean": self.actor_clean,
            "actor_family": self.actor_family,
            "is_relevant": self.is_relevant,
            "is_moex": self.is_moex,
            "response_tag_code": self.response_tag_code,
            "response_severity": self.response_severity,
            "deadline_date": self.deadline_date,
            "response_date": self.response_date,
            "delay_days": self.delay_days,
            "is_pending": self.is_pending,
            "is_late": self.is_late,
            "has_effective_response": self.has_effective_response,
            "comment": self.comment,
        }


@dataclass
class Submittal:
    submittal_key: str
    submittal_id: str
    indice: str

    # Metadata
    directory: Optional[str] = None
    affaire: Optional[str] = None
    projet: Optional[str] = None
    batiment: Optional[str] = None
    phase: Optional[str] = None
    emetteur: Optional[str] = None
    specialite: Optional[str] = None
    lot: Optional[str] = None
    type_doc: Optional[str] = None
    zone: Optional[str] = None
    niveau: Optional[str] = None
    numero: Optional[str] = None
    attached_filename: Optional[str] = None

    # Counts
    row_count: int = 0
    active_row_count: int = 0

    # Actor lists (deduplicated, order-preserved)
    actors_expected: list[str] = field(default_factory=list)
    actors_pending: list[str] = field(default_factory=list)
    actors_responded: list[str] = field(default_factory=list)
    actors_hors_mission: list[str] = field(default_factory=list)
    actors_irrelevant: list[str] = field(default_factory=list)

    # Response data
    response_tags_present: list[str] = field(default_factory=list)
    comments_by_actor: dict[str, list[str]] = field(default_factory=dict)
    responses: list[dict] = field(default_factory=list)

    # State
    current_state: str = "unknown"

    # Alignment
    alignment_state: str = "no_response"
    aligned_tag: Optional[str] = None
    conflict_severity: str = "none"
    worst_tag: Optional[str] = None         # v1.3: deterministic via TAG_PRIORITY
    has_blocking_response: bool = False      # severity-based
    has_blocking_tag: bool = False           # v1.3: tag-based (REF or DEF present)

    # Holding
    current_holders: list[str] = field(default_factory=list)
    primary_holder: Optional[str] = None
    holder_count: int = 0
    holding_state: str = "unknown"

    # Delay
    late_actors: list[str] = field(default_factory=list)
    delay_state: str = "not_applicable"
    max_delay_days: Optional[int] = None

    # Summary
    blocking_summary: str = ""

    # Counts
    pending_count: int = 0
    responded_count: int = 0
    late_count: int = 0

    # Completion
    completion_ratio: Optional[float] = None

    # Decision
    final_decision: str = "unknown"
    approval_quality: str = "pending"
    action_needed: str = ""

    # Special
    has_special_signal: bool = False

    # ─── MOEX cockpit ───
    is_moex_holder: bool = False
    is_moex_sole_holder: bool = False
    is_moex_late: bool = False
    moex_delay_days: Optional[int] = None
    moex_default_flag: bool = False
    is_waiting_external: bool = False
    external_holders: list[str] = field(default_factory=list)
    is_arbitration_required: bool = False
    is_problem_submittal: bool = False
    is_backlog_item: bool = False
    backlog_bucket: str = "completed"

    # Aging
    aging_days: Optional[int] = None
    # Proxy: computed from earliest deadline, NOT actual submission date.
    # Negative values clamped to 0. None if no deadlines exist.

    lateness_bucket: str = "not_late"
    rejection_flag: bool = False


# ═══════════════════════════════════════════════════════════════════════════
# Queue views
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class MoexQueueItem:
    submittal_key: str
    submittal_id: str
    indice: str
    emetteur: Optional[str]
    lot: Optional[str]
    type_doc: Optional[str]
    attached_filename: Optional[str]
    directory: Optional[str]
    primary_holder: Optional[str]
    is_moex_late: bool
    moex_delay_days: Optional[int]
    lateness_bucket: str
    action_needed: str
    final_decision: str
    conflict_severity: str
    approval_quality: str
    has_blocking_response: bool
    has_blocking_tag: bool
    completion_ratio: Optional[float]
    has_special_signal: bool
    comments_count: int
    aging_days: Optional[int]

    @staticmethod
    def from_submittal(s: Submittal) -> MoexQueueItem:
        return MoexQueueItem(
            submittal_key=s.submittal_key, submittal_id=s.submittal_id, indice=s.indice,
            emetteur=s.emetteur, lot=s.lot, type_doc=s.type_doc,
            attached_filename=s.attached_filename, directory=s.directory,
            primary_holder=s.primary_holder,
            is_moex_late=s.is_moex_late, moex_delay_days=s.moex_delay_days,
            lateness_bucket=s.lateness_bucket, action_needed=s.action_needed,
            final_decision=s.final_decision, conflict_severity=s.conflict_severity,
            approval_quality=s.approval_quality,
            has_blocking_response=s.has_blocking_response,
            has_blocking_tag=s.has_blocking_tag,
            completion_ratio=s.completion_ratio, has_special_signal=s.has_special_signal,
            comments_count=sum(len(v) for v in s.comments_by_actor.values()),
            aging_days=s.aging_days,
        )


@dataclass
class ExternalQueueItem:
    submittal_key: str
    submittal_id: str
    indice: str
    emetteur: Optional[str]
    lot: Optional[str]
    type_doc: Optional[str]
    attached_filename: Optional[str]
    external_holders: list[str]
    holder_count: int
    delay_state: str
    max_delay_days: Optional[int]
    lateness_bucket: str
    current_state: str
    action_needed: str
    completion_ratio: Optional[float]

    @staticmethod
    def from_submittal(s: Submittal) -> ExternalQueueItem:
        return ExternalQueueItem(
            submittal_key=s.submittal_key, submittal_id=s.submittal_id, indice=s.indice,
            emetteur=s.emetteur, lot=s.lot, type_doc=s.type_doc,
            attached_filename=s.attached_filename,
            external_holders=s.external_holders, holder_count=len(s.external_holders),
            delay_state=s.delay_state, max_delay_days=s.max_delay_days,
            lateness_bucket=s.lateness_bucket, current_state=s.current_state,
            action_needed=s.action_needed, completion_ratio=s.completion_ratio,
        )


@dataclass
class ArbitrationQueueItem:
    submittal_key: str
    submittal_id: str
    indice: str
    emetteur: Optional[str]
    lot: Optional[str]
    attached_filename: Optional[str]
    conflict_severity: str
    worst_tag: Optional[str]
    has_blocking_response: bool
    has_blocking_tag: bool
    alignment_state: str
    response_tags_present: list[str]
    actors_responded: list[str]
    final_decision: str
    action_needed: str
    comments_count: int
    has_special_signal: bool

    @staticmethod
    def from_submittal(s: Submittal) -> ArbitrationQueueItem:
        return ArbitrationQueueItem(
            submittal_key=s.submittal_key, submittal_id=s.submittal_id, indice=s.indice,
            emetteur=s.emetteur, lot=s.lot, attached_filename=s.attached_filename,
            conflict_severity=s.conflict_severity, worst_tag=s.worst_tag,
            has_blocking_response=s.has_blocking_response,
            has_blocking_tag=s.has_blocking_tag,
            alignment_state=s.alignment_state,
            response_tags_present=s.response_tags_present,
            actors_responded=s.actors_responded,
            final_decision=s.final_decision, action_needed="Arbitrage MOEX requis",
            comments_count=sum(len(v) for v in s.comments_by_actor.values()),
            has_special_signal=s.has_special_signal,
        )


# ═══════════════════════════════════════════════════════════════════════════
# EMETTEUR PERFORMANCE (v1.3 — fully specified)
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class EmetteurStats:
    emetteur: str
    total_submittals: int = 0
    fully_responded: int = 0
    pending_submittals: int = 0
    rejected_submittals: int = 0
    hard_conflict_submittals: int = 0
    held_at_moex: int = 0
    held_externally: int = 0
    avg_completion_ratio: Optional[float] = None
    ref_count: int = 0                      # submittals with REF among active responded
    def_count: int = 0                      # submittals with DEF among active responded
    blocking_response_count: int = 0        # submittals with any blocking severity response
    problem_submittal_count: int = 0
    backlog_count: int = 0
    late_backlog_count: int = 0
    # Approval quality distribution
    approval_quality_distribution: dict[str, int] = field(default_factory=lambda: {
        "clean": 0, "with_reservations": 0, "blocked": 0, "pending": 0, "mixed": 0,
    })
    # Simple scoring: clean=5, with_reservations=4, mixed=3, pending=2, blocked=1
    # weighted average across submittals. None if no submittals.
    approval_quality_score: Optional[float] = None


# ═══════════════════════════════════════════════════════════════════════════
# ACTOR PERFORMANCE (v1.3 — fully specified)
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class ActorStats:
    actor_clean: str
    actor_family: Optional[str] = None
    is_moex: bool = False                   # v1.3
    active_pending_count: int = 0
    late_pending_count: int = 0
    holder_count: int = 0
    single_holder_count: int = 0
    multi_holder_involvement: int = 0
    hard_conflict_involvement: int = 0
    avg_delay_days: Optional[float] = None
    backlog_share: Optional[float] = None


@dataclass
class Anomaly:
    source_row_index: Optional[int]
    anomaly_type: str
    field: Optional[str]
    raw_value: Optional[str]
    message: str

    def to_dict(self) -> dict:
        return {
            "source_row_index": self.source_row_index,
            "anomaly_type": self.anomaly_type,
            "field": self.field,
            "raw_value": self.raw_value,
            "message": self.message,
        }
