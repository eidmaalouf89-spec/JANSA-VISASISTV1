"""
JANSA VISASIST — Actor normalization logic.
"""
import json
from pathlib import Path
from typing import Optional

from processing.config import DEFAULT_ACTOR_RELEVANT, DEFAULT_ACTOR_FAMILY


def load_actor_map(path: Path) -> dict:
    """Load actor_map.json, strip _meta key, return dict."""
    with open(path, "r", encoding="utf-8") as f:
        am = json.load(f)
    am.pop("_meta", None)
    return am


def resolve_actor(actor_raw: Optional[str], actor_map: dict) -> tuple[dict, bool]:
    """Returns (actor_entry, is_mapped).
    If not in map, returns fallback entry with relevant=False."""
    akey = str(actor_raw).strip() if actor_raw is not None else "_UNKNOWN_"
    if akey in actor_map:
        return actor_map[akey], True
    fallback = {
        "canonical": akey,
        "prefix": "_",
        "role": akey,
        "family": DEFAULT_ACTOR_FAMILY,
        "relevant": DEFAULT_ACTOR_RELEVANT,
        "is_moex": False,
    }
    return fallback, False
