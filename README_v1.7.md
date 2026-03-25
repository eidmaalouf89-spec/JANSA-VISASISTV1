# JANSA VISASIST — v1.7 Changelog & Implementation Details

This document covers everything implemented in the March 25, 2026 session: SOCOTEC PDF integration, GOE completed discard, and GEMO_NJ hors-mission tagging.

---

## 1. SOCOTEC PDF Pipeline (`run_socotec.py`)

### What it does
Parses SOCOTEC "Fiche examen de document" PDFs, extracts document codes and verdicts (Favorable / Suspendu / Défavorable), matches them to the GED Excel by 6-digit numéro (column M), and updates Bureau de Contrôle "En attente" rows.

### How to run

```bash
# Drop new SOCOTEC PDFs into the folder
cp new_report.pdf "socotec reports/"

# Run the SOCOTEC pipeline
python run_socotec.py

# Then run the main pipeline (verdicts are auto-injected)
python run_pipeline.py "source/17&CO Tranche 2 du 23 mars 2026 07_45.xlsx"
```

### PDF parsing details
- Extracts document codes matching pattern `P17_T2_{bat}_EXE_{emit}_{spec}_{lot}_{type}_{zone}_{niv}_{numero}_{indice}`
- Handles pdfplumber newline breaks within codes: `_\nC-C` and `_F\n-F` patterns normalized via regex
- Two table types detected per fiche:
  - **Document list** ("Désignation – Identification des documents examinés") — documents listed here without a verdict in the verdict table get implicit Favorable
  - **Verdict table** ("Éléments examinés" | "Avis" | "Observations et commentaires") — explicit F/S/D verdicts

### Verdict mapping
| PDF Avis | Excel Value | Code | Severity |
|----------|-------------|------|----------|
| F | Favorable | FAV | favorable |
| S | Suspendu | SUSP | caution |
| D | Défavorable | DEF | blocking |

### Persistence (hardcoded verdicts)

When `run_socotec.py` runs, it persists results to two JSON files:

**`data/socotec_verdicts.json`** — keyed by 6-digit numéro. 592 entries as of this session.
```json
{
  "045007": {
    "avis_raw": "F",
    "avis_excel": "Favorable",
    "avis_code": "FAV",
    "observation": "",
    "fiche": "46",
    "fiche_date": "16/02/2026"
  }
}
```

**`data/socotec_registry.json`** — tracks which PDFs have been processed (30 fiches). Shown in the cockpit UI under Rapports > Registre SOCOTEC.

New PDFs are **merged** into existing data (not overwritten). If a later fiche provides a different verdict for the same numéro, it overwrites the earlier one.

### Auto-injection at load time (`processing/loader.py`)

Every time the main pipeline runs, `loader.py` loads `socotec_verdicts.json` and injects verdicts into Bureau de Contrôle rows that are still "En attente" and whose numéro matches. This means any new GED Excel export automatically gets SOCOTEC data applied. Fields overridden: `response_tag_raw`, `response_tag_code`, `response_severity`, `response_date`, `respondant` (set to "SOCOTEC (PDF)"), and `comment_raw` (observation from PDF).

---

## 2. GOE Completed Exception (Rule Type 3)

### Background
The GOE (Gros Oeuvre) works are complete on site. The remaining GOE submittals in the GED represent purely administrative backlog. The site team confirmed these should be excluded from the active pipeline.

### What's kept
- **Lot B006** — facade elements (BFUP panneaux, consoles, chéneaux, jardinières). Works not yet started.
- **Charpente métallique** — submittals whose filename contains "charpente", "métal", "chapiteau", "BFUP", "casquette", "auvent", "marquise"
- Total kept: **22 submittal IDs**, 116 rows

### What's discarded
- **289 new submittal IDs** added to `GOE_COMPLETED_EXCEPTION_IDS` in `processing/config.py`
- 306 additional GOE IDs were already covered by the existing `ANCIEN_EXCEPTION_SUBMITTAL_IDS`
- Total discarded: **595 GOE submittals**, ~2,418 rows

### Implementation
Added in `processing/loader.py` as Exception Type 3, checked after the ancien discard:
```python
if sid_str and sid_str in GOE_COMPLETED_EXCEPTION_IDS:
    discarded_goe_completed += 1
    continue
```

---

## 3. GEMO_NJ — Hors Mission BdC Tagging (Submittal-Level)

### The problem
The GED workflow sends every submittal to Bureau de Contrôle regardless of specialité. BdC's contractual scope is Mission L (solidité: GOE, STR, FAC, ETA) + Mission S (sécurité: SSI, DSF, SPK) + possibly Mission TH (CVC, ISO). Sending them fiches techniques for menuiserie, peinture, plomberie, etc. creates artificial blockage — BdC will never review those documents, so the submittal sits "En attente" indefinitely.

### The rule
**GEMO_NJ** = "Blockage GEMO Non Justifié". Applied at the **submittal level**, not row level.

A submittal qualifies if ALL of these are true:
1. It has at least one BdC row that is "En attente"
2. The **only** remaining pending relevant actors are BdC and/or MOEX (no other consultant is still pending)
3. ALL BdC specialités on that submittal are in the hors-mission or ambiguous set

When triggered, the BdC row(s) are mutated:
- `response_tag_code` → `GEMO_NJ`
- `response_severity` → `neutral` (doesn't block, doesn't count as effective response)
- `respondant` → `"GEMO (Hors Mission)"`
- `comment_raw` → `"Hors mission BdC — spécialité {spec}"`
- `is_pending` → False
- `response_date` → today

### Specialité classification

**Hors mission (clear-cut):** MEN, PEI, SDS, CLD, VRD

**Ambiguous (same rule applies per project decision):** PLB, CFA, CFO, MEX, SER, GTB, FPL, SSP, ASC, FPR, REV, TER, RCF, COU, FSP, GEO, DEM, SDB, STO

**Legitimate BdC scope (NOT tagged):** GOE, STR, FAC, ETA, SSI, DSF, SPK, CVC, ISO

### Implementation
New module `processing/gemo_nj.py`. Runs in `run_pipeline.py` AFTER grouping (`group_submittals`) and BEFORE analysis (`analyze_all`), because it needs the full submittal picture to determine if only BdC+MOEX are pending.

### Impact (this session)
- 469 submittals tagged GEMO_NJ
- Biggest offenders: CFA (143), PLB (107), MEN (83), MEX (33), SDS (33)

---

## 4. Cockpit UI Updates (v1.7)

### SOCOTEC Registry table
New section in Rapports view showing all processed SOCOTEC fiches: fiche number, date, pages, document count, FAV/SUSP/DEF breakdown per fiche, filename. Includes totals row.

### GEMO_NJ tag color
Added orange color for `GEMO_NJ` in `TAG_COLORS` so it's visible in the detail panel and viseur list.

### Version bump
`cockpit_data.json` version set to `"1.7"`. New field: `socotec_registry` (array).

---

## 5. Pipeline Impact Summary

| Metric | Before (v1.6) | After (v1.7) | Delta |
|--------|---------------|--------------|-------|
| Total submittals | 1,694 | 1,443 | -251 |
| Total rows | 8,377 | 7,296 | -1,081 |
| Fully responded | 84 | 265 | +181 |
| In progress (pending) | 1,610 | 1,176 | -434 |
| BdC holds | 1,330 | 658 | -672 |
| BdC "Relance" actions | 280 | 23 | -257 |
| "Terminé" (ready for MOEX VISA) | 59 | 218 | +159 |
| Open submittals | — | 1,095 | — |
| Closed submittals | — | 348 | — |

---

## 6. Files Modified / Created

### New files
- `processing/gemo_nj.py` — submittal-level GEMO_NJ post-processing
- `data/socotec_verdicts.json` — 592 hardcoded SOCOTEC verdicts
- `data/socotec_registry.json` — 30 processed SOCOTEC fiches
- `run_socotec.py` — standalone SOCOTEC PDF pipeline

### Modified files
- `processing/config.py` — added SOCOTEC paths, GEMO_NJ in TAG_PRIORITY, GOE_COMPLETED_EXCEPTION_IDS (289 IDs), BDC_HORS_MISSION_SPECS, BDC_AMBIGUOUS_SPECS, BDC_GEMO_NJ_SPECS
- `processing/loader.py` — SOCOTEC verdict injection at row level, GOE discard (Exception Type 3)
- `processing/cockpit_export.py` — accepts `socotec_registry` param, version 1.7
- `run_pipeline.py` — loads SOCOTEC registry, calls `apply_gemo_nj()` between grouping and analysis, reports SOCOTEC + GEMO_NJ stats
- `cockpit/index.html` — SOCOTEC registry table in Rapports, GEMO_NJ tag color
- `data/status_map.json` — added GEMO_NJ entry

---

## 7. Architecture After v1.7

```
processing/
├── config.py         # Column mappings, constants, TAG_PRIORITY, exception lists, BdC scope
├── models.py         # All dataclasses
├── dates.py          # Date/delay parsing
├── actors.py         # Actor map loading + resolution
├── statuses.py       # Status map loading + resolution
├── loader.py         # Excel → list[WorkflowRow] + SOCOTEC injection + GOE discard
├── normalizer.py     # Orchestrator (load + consistency checks)
├── grouper.py        # Group rows by submittal_key
├── gemo_nj.py        # Submittal-level GEMO_NJ tagging (post-grouping, pre-analysis)
├── analyzer.py       # All deterministic business rules + aggregations
├── cockpit_export.py # Cockpit JSON export (v1.7)
└── exporter.py       # CSV/JSON export

data/
├── actor_map.json
├── status_map.json
├── exception_list.json
├── socotec_verdicts.json   # Hardcoded SOCOTEC verdicts (persistent, merged)
└── socotec_registry.json   # SOCOTEC PDF processing registry (persistent, appended)

run_pipeline.py       # Main pipeline: normalize → group → gemo_nj → analyze → export
run_socotec.py        # SOCOTEC PDF parser: PDFs → Excel update + persist to data/
```

### Pipeline execution order
1. `normalize()` — load Excel, resolve actors/statuses, inject SOCOTEC verdicts, discard ancien + GOE
2. `group_submittals()` — group rows by submittal_key
3. `apply_gemo_nj()` — **submittal-level** scan: tag BdC hors-mission rows as GEMO_NJ
4. `analyze_all()` — compute states, alignment, conflicts, holders, actions
5. Aggregations + export
