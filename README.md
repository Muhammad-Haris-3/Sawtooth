# Sawtooth

**Medicare publishes one staffing number per nursing home: a case-mix adjusted
quarterly mean. Care is not delivered on average.**

Sawtooth asks whether the shape of a facility's daily staffing — its floor, its
variance, its runs of thin days, its reliance on agency staff — predicts
inspection harm that the published aggregates miss.

> **Status: complete. The pre-registered claim is null.**
> Δ AUC **+0.0054** against a pre-registered threshold of 0.03, 95% CI
> [−0.0024, +0.0131], on 20,543 held-out surveys with 2,358 harm events. The
> power floor was met, so this is a null and not a withholding.
> **[`FINDINGS.md`](FINDINGS.md)** · [`PREREGISTRATION.md`](PREREGISTRATION.md)
> was committed **the day before**, before any feature was joined to any
> outcome.

**The shape of a facility's daily staffing does not predict inspection harm
better than its level does — because the shape and the level are nearly the same
number.** A facility's 10th-percentile staffing day correlates **0.958** with its
quarterly mean. The information was never hiding in the daily data.

Two by-products are worth more than the original hypothesis:

- **`hprd_p10` ≈ `mean_hprd` at r = 0.958.** Daily PBJ data adds less
  distributional signal to quality measurement than its granularity suggests.
- **Staffing predicts cited harm at AUC ≈ 0.61** — for CMS's published staffing
  star (0.6229) and for as-of reconstructed levels (0.6118) alike. Bed count is a
  stronger predictor than any staffing measure in the model.

---

## The premise had to be narrowed before it was registered

The project was conceived as *"CMS publishes a quarterly mean, so weekend
staffing is invisible."* **That is false.** CMS publishes weekend staffing
levels at 97.3% coverage — `adjusted_weekend_total_nurse_staffing_hours_per_
resident_per_day` and four related fields — plus nurse turnover.

A weekend *gap* is therefore very nearly derivable from data CMS already
releases. So `weekend_gap` is **excluded from the challenger feature set**.
Including it would claim credit for information that is already public.

The sawtooth stays as this project's visual and its name. It is no longer its
claim. What remains, and what genuinely requires the daily file, is the
within-quarter *distribution* — floor, variance, runs, and the employed-versus-
agency split. No published CMS aggregate contains any of these.

That correction was made **before** the pre-registration was committed, not
after the results came in.

---

## What M0 established

**The sawtooth is real and survives national re-measurement.** The design
figures came from the first 40 MB of one quarterly file — 11 states,
alphabetically AK–GA. Recomputed on the complete national file:

| Measure | 11-state sample | **National (2026Q1)** |
|---|---|---|
| Weekend gap | 7.1% | **7.2%** |
| Median facility drop | 6.3% | **6.6%** |
| Facilities dropping ≥20% | 3.7% | **3.6%** |
| Agency share of nurse hours | 2.8% | **5.5%** |

The gap replicates. Two things the partial sample got wrong: absolute staffing
was overstated (the A–G states include California, which has a staffing
mandate), and **agency reliance was understated by half**.

**The honest size of the headline is 188 facilities** — nationally, 514 of
14,461 drop ≥20% at weekends, and 188 of those also carry a healthy-looking
quarterly average (≥3.5 HPRD). Not "the rating hides a catastrophe." A specific,
checkable list.

```
  MON  3.424  #################################
  TUE  3.501  ############################################
  WED  3.520  ###############################################   <- peak
  THU  3.482  #########################################
  FRI  3.438  ###################################
  SAT  3.249  ########                                          <- weekend
  SUN  3.193  #                                                 <- trough
```

Full record: [`Sawtooth_M0_Summary.md`](Sawtooth_M0_Summary.md).

---

## What ingest had to solve

None of this is visible from the CMS catalogue, and each would corrupt a naive
load.

| Problem | What it would have done |
|---|---|
| **Three naming conventions** across 37 quarters, and one file that encodes its quarter nowhere in the name | Silently lose quarters. `2qky-49qq.csv` was identified as **2020Q3** by reading its `cy_qtr` column — the single gap in the sequence |
| **Eight drifting column names.** 2017 uses `hrs_lpn_admin`, `hrs_na_trn`, `hrs_rn_donadmin`; 2017Q2 carries *both* DON spellings; case flips at 2020Q1 | Columns silently become null |
| **Files are cp1252, not UTF-8.** Two facilities carry `0x92`/`0x96` in their names — 360 rows of 1.3M | Aborts a strict read of the entire file. `ignore_errors=true` would drop rows silently; latin-1 would turn those bytes into control characters |
| **An `incomplete` quality flag published for 2021Q4 only** (1.1% of rows) | Equivalent rows cannot be identified in any other quarter — carried through and declared as a limitation |
| **882 facilities (6.0%) had zero standard deficiencies** | Building the survey universe from the citations file drops 6% of surveys, every one of them clean, inflating the positive rate by construction |

---

## Data

All free, public, keyless. Join key is the CMS Certification Number throughout —
PBJ's `PROVNUM` is the CCN, so there is **no fuzzy matching anywhere in this
project**. Join integrity PBJ↔provider information: **99.9%**.

| Source | Grain | Rows |
|---|---|---|
| PBJ Daily Nurse Staffing | facility × day | 1.3M per quarter, 37 quarters |
| Health Deficiencies | citation | 419,479 |
| Penalties | penalty | 15,696 |
| Provider Information | facility | 14,690 × 99 cols |
| Ownership | owner × facility | 249,452 |

**22,914** citations at scope-severity ≥ G ("actual harm or worse"), survey
window 2017-03-23 to 2026-07-23.

---

## Reproduce

Python 3.14, DuckDB, no credentials required.

```bash
python -m venv .venv && .venv/Scripts/python.exe -m pip install -r requirements.txt
```

```bash
.venv/Scripts/python.exe ingest/pbj_manifest.py     # resolve 37 quarters, 3 naming conventions
.venv/Scripts/python.exe ingest/schema_audit.py     # map column drift, recover 2020Q3
.venv/Scripts/python.exe ingest/provider_data.py    # outcomes and covariates
.venv/Scripts/python.exe ingest/build_panel.py      # fetch -> parquet -> discard raw
.venv/Scripts/python.exe analysis/sawtooth_national.py 2026Q1
```

`build_panel.py` is resumable and discards each raw CSV after conversion, so
peak disk stays near 1.5 GB rather than 8.7 GB. Parquet compresses the panel to
about 14% of source.

Raw data is not committed. `data/fetch_manifest.json` records the sha256, byte
count and fetch time of every file downloaded, so a rebuild can be checked
against what this analysis actually read.
