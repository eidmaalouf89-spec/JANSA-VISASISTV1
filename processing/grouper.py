"""
JANSA VISASIST — Group rows by submittal_key.
"""
from collections import defaultdict

from processing.models import WorkflowRow


def group_submittals(rows: list[WorkflowRow]) -> dict[str, list[WorkflowRow]]:
    """Group rows by submittal_key. Returns dict[submittal_key → rows]."""
    groups: dict[str, list[WorkflowRow]] = defaultdict(list)
    for r in rows:
        groups[r.submittal_key].append(r)
    return dict(groups)
