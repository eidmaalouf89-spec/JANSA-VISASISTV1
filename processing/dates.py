"""
JANSA VISASIST — Date & delay parsing utilities.
"""
from datetime import datetime, date
from typing import Optional

from processing.config import DATE_FORMAT


def parse_date(raw) -> Optional[date]:
    """Parse dd/mm/yyyy string to date. None on failure."""
    if raw is None:
        return None
    try:
        return datetime.strptime(str(raw).strip(), DATE_FORMAT).date()
    except (ValueError, TypeError):
        return None


def parse_delay(raw) -> Optional[int]:
    """Parse delay from int, float, or string like '+ 52'. None on failure."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return int(raw)
    try:
        return int(str(raw).replace("+", "").strip())
    except (ValueError, TypeError):
        return None
