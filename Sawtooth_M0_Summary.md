# Sawtooth — M0 Summary

**The pipeline is built, the national gate is measured, and the blueprint's
partial-sample figures hold.**

Run 2026-09-01 · Python 3.14.7 · DuckDB 1.5.5 · all figures reproducible from
`ingest/` and `analysis/`.

---

## 1. The gate: does the sawtooth survive national re-measurement?

The blueprint's numbers came from the first 40 MB of one quarterly file — 11
states, alphabetically AK–GA. That is a biased sample and was labelled as one.
Recomputed on the complete national file:

| Measure | 11-state sample | **National (2026Q1)** |
|---|---|---|
| Weekday HPRD | 3.702 | **3.472** |
| Weekend HPRD | 3.440 | **3.221** |
| **Weekend gap** | 7.1% | **7.2%** |
| Median facility drop | 6.3% | **6.6%** |
| p90 | 15.2% | **15.7%** |
| p95 | 18.7% | **18.7%** |
| p99 | 23.8% | **24.8%** |
| Facilities dropping ≥20% | 3.7% | **3.6%** |
| Agency share of nurse hours | 2.8% | **5.5%** |

**The gap replicates almost exactly (7.1% → 7.2%) and the distribution shape
holds.** Two corrections the partial sample got wrong:

- **Absolute staffing was overstated.** The A–G states are a high-staffing
  subset — they include California, which has a state staffing mandate. National
  HPRD is about 0.23 hours lower across the board.
- **Agency reliance was understated by half.** 2.8% in the sample, **5.5%**
  nationally. Any conclusion about contract staffing drawn from the sample would
  have been wrong by a factor of two.

### The population of the finding

Nationally, of 14,461 facilities with a full quarter of data:

- **514 (3.6%)** drop 20% or more at weekends.
- **188** of those carry a healthy-looking quarterly average (≥3.5 HPRD)
  *and* collapse ≥20% at weekends.

188 is the honest size of the headline. It is not "the star rating hides a
catastrophe." It is "for 188 identifiable facilities, the published average
conceals a weekend floor" — a specific, checkable, actionable list.

Day-of-week pattern, national, 1,301,313 facility-days:

```
  MON  3.424  #################################
  TUE  3.501  ############################################
  WED  3.520  ###############################################   <- peak
  THU  3.482  #########################################
  FRI  3.438  ###################################
  SAT  3.249  ########                                          <- weekend
  SUN  3.193  #                                                 <- trough
```

RN share of nurse hours: **13.5%**.

---

## 2. Exclusion ledger (2026Q1)

| Step | Facility-days |
|---|---|
| In file | 1,303,830 |
| Census null | 0 |
| Census < 5 | 1,040 |
| Zero nurse hours, census valid | 1,477 |
| **Kept** | **1,301,313 (99.8%)** |

Facilities 14,487 → 14,483. The data is far cleaner than expected; the
interesting problems are in the file *format*, not the values.

---

## 3. What ingest actually had to solve

None of this was visible from the catalogue and all of it would corrupt a naive
load.

**Three naming conventions.** CMS has published PBJ under
`PBJ_dailynursestaffing_CY2026Q1.csv`,
`pbj_daily_nurse_staffing_cy_2020q4.csv`, and `PBJ_Nurse_2019_Q2_4juw-fxcf.csv`.
One file, `2qky-49qq.csv`, encodes its quarter nowhere in the name — it was
recovered by reading its `cy_qtr` column, which says **2020Q3**, the single gap
in the sequence. All **37 quarters (2017Q1–2026Q1)** are now resolved.

**Column drift.** Eight columns move across vintages:

| Column | Present in |
|---|---|
| `hrs_rn_donadmin` → `hrs_rndon` | 2017Q1–Q2 → 2017Q2 onward |
| `hrs_lpn_admin` → `hrs_lpnadmin` | 2017 only → 2018 onward |
| `hrs_na_trn` → `hrs_natrn` | 2017 only → 2018 onward |
| `hrs_medaide_ctr` | missing in 2017Q2 only |
| `incomplete` | **2021Q4 only** |

2017Q2 carries *both* DON spellings. Column case also flips: files before 2020Q1
are lowercase, later ones mixed case.

**The `incomplete` flag.** CMS published a row-level data-quality flag for
exactly one quarter and never again. In 2021Q4 it marks **142 of 12,909 sampled
facility-days (1.1%)** as incomplete submissions. There is no way to identify
the equivalent rows in any other quarter. Recorded, carried through the schema,
and flagged as a limitation.

**Encoding.** The files are **cp1252, not UTF-8**. In 2026Q1 two facilities
carry `0x92` (right quote) and `0x96` (en dash) in their names — 180 rows each,
360 of 1.3M. That is enough to abort a strict CSV read of the entire file.

Both tempting fixes are wrong: `ignore_errors=true` silently drops rows, and
decoding as latin-1 turns those bytes into control characters. Each line is
tried as UTF-8 and falls back to cp1252 only on failure, with the repair count
reported per quarter.

---

## 4. Outcome data, loaded and joined

| Table | Rows | Facilities |
|---|---|---|
| Health deficiencies | 419,479 | 14,627 |
| Penalties | 15,696 | 6,775 |
| Provider information (99 cols) | 14,690 | 14,690 |
| Ownership | 249,452 | 14,690 |

**Join integrity: 14,474 of 14,487 PBJ facilities match provider information —
99.9%.** PBJ's `PROVNUM` is the CCN. No fuzzy matching anywhere in this project.

**Outcome events are ample.** Scope-severity ≥ G ("actual harm or worse"):

| Code | Citations |
|---|---|
| G | 12,965 |
| H | 448 |
| I | 21 |
| J | 6,773 |
| K | 2,081 |
| L | 626 |
| **Total ≥ G** | **22,914** |

Survey window **2017-03-23 to 2026-07-23**, which overlaps the full PBJ history.
Standard-only surveys: 288,047 citations; complaint-only: 101,991; both: 29,324.
The pre-registered restriction to standard surveys is a clean filter.

Staffing star rating present for 14,497 facilities. Penalties total
**$456,752,787** but span only **2023-08-19 to 2026-07-29** — a shorter window
than deficiencies, so the fine-amount outcome is secondary.

---

## 5. Storage

234.3 MB CSV → **32.4 MB Parquet (13.8%)**, ZSTD. All 37 quarters would be
roughly 8.7 GB raw and ~1.2 GB as Parquet. DuckDB reads the Parquet directly;
nothing needs to be held in memory.

---

## 6. Status and next step

Established: ingest, schema-drift handling, encoding repair, hashed fetch
manifest, canonical Parquet, national measurement, outcome join.

**Not yet done:** only 2026Q1 of 37 quarters is downloaded. The feature layer
and the pre-registered model need a multi-quarter panel.

**Open decision — how much history to pull.** Deficiencies reach back to 2017
and PBJ covers 2017Q1 onward, so the full panel is available. Penalties only
reach 2023.

| Window | Quarters | Raw | Parquet |
|---|---|---|---|
| 2025Q1–2026Q1 | 5 | ~1.2 GB | ~160 MB |
| 2022Q1–2026Q1 | 17 | ~4.0 GB | ~550 MB |
| 2017Q1–2026Q1 | 37 | ~8.7 GB | ~1.2 GB |

---

## Reproduce

```
ingest/pbj_manifest.py     # resolve 37 quarters across 3 naming conventions
ingest/schema_audit.py     # map column drift; recovers 2020Q3
ingest/download.py 2026Q1  # hashed, resumable fetch
ingest/normalize.py 2026Q1 # cp1252 repair -> canonical Parquet
ingest/provider_data.py    # deficiencies, penalties, provider info, ownership
analysis/sawtooth_national.py 2026Q1   # the gate
```
