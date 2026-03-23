"""
JANSA VISASIST — Business rule tests for analyzer.py
Uses manually constructed WorkflowRow lists (not from Excel).
"""
import sys
from pathlib import Path
from datetime import date, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from processing.config import TODAY
from processing.models import WorkflowRow
from processing.analyzer import analyze_submittal


def _make_row(
    actor_clean="0-BET Structure",
    actor_family="bet",
    is_relevant_actor=True,
    is_moex=False,
    response_tag_code="VSO",
    response_severity="caution",
    deadline_date=None,
    response_date=None,
    delay_days=None,
    is_pending=False,
    is_late=False,
    is_hors_mission=False,
    has_response_raw=True,
    has_effective_response=True,
    is_active_row=True,
    comment_raw=None,
    submittal_key="100_A",
    submittal_id="100",
    indice="A",
    emetteur="EM1",
    **kwargs,
) -> WorkflowRow:
    return WorkflowRow(
        source_row_index=kwargs.get("source_row_index", 3),
        directory="/test",
        submittal_id=submittal_id,
        affaire="AFF",
        projet="PRJ",
        batiment="BAT",
        phase="EXE",
        emetteur=emetteur,
        specialite="STR",
        lot="LOT1",
        type_doc="PLN",
        zone="Z1",
        niveau="N1",
        numero="001",
        indice=indice,
        attached_filename="test.pdf",
        submittal_key=submittal_key,
        actor_raw=actor_clean,
        actor_prefix="0",
        actor_role=actor_clean.split("-", 1)[-1] if "-" in actor_clean else actor_clean,
        actor_clean=actor_clean,
        actor_family=actor_family,
        is_relevant_actor=is_relevant_actor,
        is_moex=is_moex,
        respondant=None,
        deadline_raw=None,
        deadline_date=deadline_date,
        response_date_raw=None,
        response_date=response_date,
        delay_raw=None,
        delay_days=delay_days,
        response_tag_raw=None,
        response_tag_clean=response_tag_code,
        response_tag_code=response_tag_code,
        response_severity=response_severity,
        comment_raw=comment_raw,
        is_pending=is_pending,
        is_late=is_late,
        is_hors_mission=is_hors_mission,
        has_response_raw=has_response_raw,
        has_effective_response=has_effective_response,
        is_active_row=is_active_row,
    )


class TestFullyRespondedAligned:
    """1. Fully responded, aligned VSO"""

    def test_aligned_vso(self):
        rows = [
            _make_row(actor_clean="0-BET Structure", response_tag_code="VSO", response_severity="caution"),
            _make_row(actor_clean="0-BET CVC", response_tag_code="VSO", response_severity="caution"),
            _make_row(actor_clean="0-ARCHITECTE", response_tag_code="VSO", response_severity="caution"),
        ]
        s = analyze_submittal(rows, {})
        assert s.current_state == "fully_responded"
        assert s.alignment_state == "aligned"
        assert s.aligned_tag == "VSO"
        # Aligned VSO = no conflict → "approved" (not "approved_with_reservations")
        # approved_with_reservations requires conflict_severity == "soft"
        assert s.final_decision == "approved"
        assert s.conflict_severity == "none"


class TestHardConflict:
    """2. Hard conflict: REF + VSO"""

    def test_ref_vs_vso(self):
        rows = [
            _make_row(actor_clean="0-Bureau de Contrôle", response_tag_code="REF", response_severity="blocking"),
            _make_row(actor_clean="0-BET Structure", response_tag_code="VSO", response_severity="caution"),
        ]
        s = analyze_submittal(rows, {})
        assert s.conflict_severity == "hard"
        assert s.is_arbitration_required is True
        assert s.worst_tag == "REF"
        assert s.alignment_state == "hard_conflict"


class TestSingleHolderLate:
    """3. Single holder, late"""

    def test_single_holder_late(self):
        past_deadline = TODAY - timedelta(days=10)
        rows = [
            _make_row(actor_clean="0-BET Structure", response_tag_code="VSO", response_severity="caution"),
            _make_row(actor_clean="0-ARCHITECTE", response_tag_code="VSO", response_severity="caution"),
            _make_row(
                actor_clean="0-Bureau de Contrôle",
                response_tag_code="EN_ATTENTE",
                response_severity="non_response",
                is_pending=True,
                is_late=True,
                has_effective_response=False,
                has_response_raw=True,
                deadline_date=past_deadline,
            ),
        ]
        s = analyze_submittal(rows, {})
        assert s.holding_state == "single_holder"
        assert s.delay_state == "late"
        assert s.primary_holder == "0-Bureau de Contrôle"
        assert s.current_state == "in_progress"


class TestMoexDefault:
    """4. MOEX default: pending MOEX actor with past deadline"""

    def test_moex_late(self):
        past_deadline = TODAY - timedelta(days=5)
        rows = [
            _make_row(
                actor_clean="0-Maître d'Oeuvre EXE",
                actor_family="moe",
                is_moex=True,
                response_tag_code="EN_ATTENTE",
                response_severity="non_response",
                is_pending=True,
                is_late=True,
                has_effective_response=False,
                has_response_raw=True,
                deadline_date=past_deadline,
            ),
            _make_row(actor_clean="0-BET Structure", response_tag_code="VSO", response_severity="caution"),
        ]
        s = analyze_submittal(rows, {})
        assert s.is_moex_holder is True
        assert s.is_moex_late is True
        assert s.moex_default_flag is True
        assert s.action_needed == "Relance MOEX"


class TestAllHorsMission:
    """5. All hors mission"""

    def test_all_hm(self):
        rows = [
            _make_row(
                actor_clean="0-BET Structure",
                response_tag_code="HM", response_severity="neutral",
                is_hors_mission=True, has_effective_response=False, is_active_row=False,
                has_response_raw=True,
            ),
            _make_row(
                actor_clean="0-BET CVC",
                response_tag_code="HM", response_severity="neutral",
                is_hors_mission=True, has_effective_response=False, is_active_row=False,
                has_response_raw=True,
            ),
            _make_row(
                actor_clean="0-ARCHITECTE",
                response_tag_code="HM", response_severity="neutral",
                is_hors_mission=True, has_effective_response=False, is_active_row=False,
                has_response_raw=True,
            ),
        ]
        s = analyze_submittal(rows, {})
        assert s.current_state == "all_hors_mission"
        assert s.final_decision == "neutral_only"


class TestCompletionRatio:
    """6. Completion ratio: 2 active rows, 1 responded → 0.5"""

    def test_completion(self):
        rows = [
            _make_row(actor_clean="0-BET Structure", response_tag_code="VSO", response_severity="caution"),
            _make_row(
                actor_clean="0-Bureau de Contrôle",
                response_tag_code="EN_ATTENTE",
                response_severity="non_response",
                is_pending=True, has_effective_response=False,
            ),
        ]
        s = analyze_submittal(rows, {})
        assert s.completion_ratio == pytest.approx(0.5)


class TestWorstTagDeterministic:
    """7. worst_tag deterministic: [VSO, REF, FAV] → REF (priority 1)"""

    def test_worst_tag(self):
        rows = [
            _make_row(actor_clean="0-BET Structure", response_tag_code="VSO", response_severity="caution"),
            _make_row(actor_clean="0-Bureau de Contrôle", response_tag_code="REF", response_severity="blocking"),
            _make_row(actor_clean="0-BET CVC", response_tag_code="FAV", response_severity="favorable"),
        ]
        s = analyze_submittal(rows, {})
        assert s.worst_tag == "REF"


class TestIrrelevantActorExcluded:
    """8. Irrelevant actor with EN_ATTENTE should NOT appear in current_holders"""

    def test_irrelevant_excluded(self):
        rows = [
            _make_row(actor_clean="0-BET Structure", response_tag_code="VSO", response_severity="caution"),
            _make_row(
                actor_clean="Sollicitation supplémentaire",
                actor_family="special",
                is_relevant_actor=False,
                response_tag_code="EN_ATTENTE",
                response_severity="non_response",
                is_pending=True,
                has_effective_response=False,
                is_active_row=False,
            ),
        ]
        s = analyze_submittal(rows, {})
        assert "Sollicitation supplémentaire" not in s.current_holders
        assert s.current_state == "fully_responded"
        assert "Sollicitation supplémentaire" in s.actors_irrelevant
