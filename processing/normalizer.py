"""
JANSA VISASIST — Normalizer: orchestrates loading + consistency checks.
Single entry point for Phase 1.
"""
from processing.config import ACTOR_MAP_PATH, STATUS_MAP_PATH, GROUPING_CONSISTENCY_FIELDS
from processing.models import WorkflowRow, Anomaly
from processing.actors import load_actor_map
from processing.statuses import load_status_map
from processing.loader import load_workbook


def normalize(excel_path: str) -> tuple[list[WorkflowRow], list[Anomaly], dict, dict]:
    """Full pipeline: load maps → load workbook → consistency checks.

    Returns (rows, anomalies, actor_map, status_map).
    The actor_map is returned so downstream modules can use it.
    """
    actor_map = load_actor_map(ACTOR_MAP_PATH)
    status_map = load_status_map(STATUS_MAP_PATH)

    rows, anomalies = load_workbook(excel_path, actor_map, status_map)

    # --- Grouping consistency checks ---
    from collections import defaultdict
    groups: dict[str, list[WorkflowRow]] = defaultdict(list)
    for r in rows:
        groups[r.submittal_key].append(r)

    for sk, grp in groups.items():
        for fld in GROUPING_CONSISTENCY_FIELDS:
            vals = set(getattr(r, fld) for r in grp if getattr(r, fld) is not None)
            if len(vals) > 1:
                anomalies.append(Anomaly(
                    grp[0].source_row_index,
                    "grouping_inconsistency",
                    fld,
                    str(vals),
                    f"{sk}: '{fld}' inconsistent: {vals}",
                ))

    return rows, anomalies, actor_map, status_map
