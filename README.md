# JANSA VISASIST — GED Submittal Analysis Engine

Deterministic processing module for construction VISA workflow management (MOEX cockpit). Ingests an AxeoBIM Excel export and reconstructs, for each submittal: who must respond, who has responded, who is late, whether statuses are aligned or conflicting, what comments were made, and the consolidated current state.

## Quick Start

```bash
pip install -r requirements.txt
python run_pipeline.py <path_to_excel>
```

## Output

All files are written to `output/`:

- `workflow_rows.csv` — one row per Excel workflow row, all cleaned fields
- `submittals.csv` — one row per submittal, all analysis fields (lists/dicts serialized as JSON)
- `anomalies.json` — any data quality issues found during loading
- `emetteur_stats.csv` — per-emetteur aggregated metrics
- `actor_stats.csv` — per-actor bottleneck metrics

## Configuration

- `data/actor_map.json` — actor normalization map. Edit to add new actors, change relevance flags, or mark MOEX actors.
- `data/status_map.json` — response tag normalization map. Edit to add new status codes or change severity tiers.

## Tests

```bash
python -m pytest tests/
```

## Architecture

```
processing/
├── config.py       # Column mappings, constants, helpers
├── models.py       # All dataclasses
├── dates.py        # Date/delay parsing
├── actors.py       # Actor map loading + resolution
├── statuses.py     # Status map loading + resolution
├── loader.py       # Excel → list[WorkflowRow]
├── normalizer.py   # Orchestrator (load + consistency checks)
├── grouper.py      # Group rows by submittal_key
├── analyzer.py     # All deterministic business rules + aggregations
└── exporter.py     # CSV/JSON export
```
