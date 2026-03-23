"""
JANSA VISASIST — CSV/JSON export functions.
"""
import json
import dataclasses
from pathlib import Path
from datetime import date

import pandas as pd

from processing.models import WorkflowRow, Submittal, Anomaly, EmetteurStats, ActorStats


def _ensure_dir(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)


def _serialize(val):
    """Serialize complex values for CSV: lists/dicts → JSON strings, dates → ISO."""
    if isinstance(val, (list, dict)):
        return json.dumps(val, ensure_ascii=False, default=str)
    if isinstance(val, date):
        return val.isoformat()
    return val


def export_workflow_rows(rows: list[WorkflowRow], output_dir: Path) -> Path:
    """Export to CSV: workflow_rows.csv — one line per row, all cleaned fields."""
    _ensure_dir(output_dir)
    records = []
    for r in rows:
        d = dataclasses.asdict(r)
        records.append({k: _serialize(v) for k, v in d.items()})
    df = pd.DataFrame(records)
    out = output_dir / "workflow_rows.csv"
    df.to_csv(out, index=False, encoding="utf-8-sig")
    return out


def export_submittals(submittals: list[Submittal], output_dir: Path) -> Path:
    """Export to CSV: submittals.csv — one line per submittal, key analysis fields.
    List/dict fields serialized as JSON strings."""
    _ensure_dir(output_dir)
    records = []
    for s in submittals:
        d = dataclasses.asdict(s)
        records.append({k: _serialize(v) for k, v in d.items()})
    df = pd.DataFrame(records)
    out = output_dir / "submittals.csv"
    df.to_csv(out, index=False, encoding="utf-8-sig")
    return out


def export_anomalies(anomalies: list[Anomaly], output_dir: Path) -> Path:
    """Export to JSON: anomalies.json"""
    _ensure_dir(output_dir)
    out = output_dir / "anomalies.json"
    data = [a.to_dict() for a in anomalies]
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    return out


def export_emetteur_stats(stats: dict[str, EmetteurStats], output_dir: Path) -> Path:
    """Export to CSV: emetteur_stats.csv"""
    _ensure_dir(output_dir)
    records = []
    for es in stats.values():
        d = dataclasses.asdict(es)
        records.append({k: _serialize(v) for k, v in d.items()})
    df = pd.DataFrame(records)
    out = output_dir / "emetteur_stats.csv"
    df.to_csv(out, index=False, encoding="utf-8-sig")
    return out


def export_actor_stats(stats: dict[str, ActorStats], output_dir: Path) -> Path:
    """Export to CSV: actor_stats.csv"""
    _ensure_dir(output_dir)
    records = []
    for ast in stats.values():
        d = dataclasses.asdict(ast)
        records.append({k: _serialize(v) for k, v in d.items()})
    df = pd.DataFrame(records)
    out = output_dir / "actor_stats.csv"
    df.to_csv(out, index=False, encoding="utf-8-sig")
    return out
