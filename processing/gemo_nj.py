"""
JANSA VISASIST — GEMO_NJ Post-Processing (submittal-level)

Identifies submittals where the ONLY remaining pending actors are
Bureau de Contrôle and/or MOEX, AND the BdC's specialité is outside
their contractual mission scope. Tags those BdC rows as GEMO_NJ
("Blockage GEMO Non Justifié") so the submittal can proceed.

Must run AFTER grouping (needs full submittal view) and BEFORE analysis.
"""
from processing.models import WorkflowRow
from processing.config import BDC_GEMO_NJ_SPECS, TODAY


def apply_gemo_nj(
    grouped: dict[str, list[WorkflowRow]],
) -> dict:
    """Scan all submittals. For each one where the only pending actors
    are BdC (+MOEX) and BdC's specialité is hors-mission/ambiguous,
    mutate the BdC rows from EN_ATTENTE → GEMO_NJ.

    Returns stats dict for reporting.
    """
    stats = {
        "submittals_tagged": 0,
        "rows_tagged": 0,
        "by_spec": {},
    }

    for skey, rows in grouped.items():
        # Classify each row in this submittal
        bdc_pending: list[WorkflowRow] = []
        moex_pending: list[WorkflowRow] = []
        other_pending: list[WorkflowRow] = []
        bdc_specs: set[str] = set()

        for r in rows:
            if not r.is_relevant_actor:
                continue

            if r.is_pending:
                actor_str = str(r.actor_raw or "").strip()
                if "Bureau de Contrôle" in actor_str:
                    bdc_pending.append(r)
                    if r.specialite:
                        bdc_specs.add(r.specialite)
                elif r.is_moex:
                    moex_pending.append(r)
                else:
                    other_pending.append(r)

        # Condition: BdC is pending, no other non-MOEX consultant is pending,
        # and ALL BdC specs are in the hors-mission/ambiguous set
        if (bdc_pending
                and not other_pending
                and bdc_specs
                and bdc_specs.issubset(BDC_GEMO_NJ_SPECS)):

            # Tag all BdC pending rows as GEMO_NJ
            for r in bdc_pending:
                r.response_tag_raw = "Blockage GEMO Non Justifié"
                r.response_tag_clean = "GEMO_NJ"
                r.response_tag_code = "GEMO_NJ"
                r.response_severity = "neutral"
                r.respondant = "GEMO (Hors Mission)"
                r.comment_raw = f"Hors mission BdC — spécialité {r.specialite}"
                r.is_pending = False
                r.is_late = False
                r.has_response_raw = True
                r.has_effective_response = False  # neutral = not an effective response
                r.is_active_row = False  # neutral severity → not active
                r.response_date = TODAY
                r.response_date_raw = TODAY.strftime("%d/%m/%Y")

                stats["rows_tagged"] += 1
                spec = r.specialite or "?"
                stats["by_spec"][spec] = stats["by_spec"].get(spec, 0) + 1

            stats["submittals_tagged"] += 1

    return stats
