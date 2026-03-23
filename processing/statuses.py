"""
JANSA VISASIST — Response tag normalization logic.
"""
import json
from pathlib import Path
from typing import Optional


def load_status_map(path: Path) -> dict:
    """Load status_map.json, strip _meta key, return dict."""
    with open(path, "r", encoding="utf-8") as f:
        sm = json.load(f)
    sm.pop("_meta", None)
    return sm


def resolve_status(tag_raw: Optional[str], status_map: dict) -> tuple[dict, bool]:
    """Returns (status_entry, is_mapped).
    If not in map, returns _NONE_ entry."""
    tkey = str(tag_raw).strip() if tag_raw is not None else "_NONE_"
    if tkey in status_map:
        return status_map[tkey], True
    return status_map["_NONE_"], False
