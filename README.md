# Sawtooth

**A pre-registered investigation into whether Medicare's nursing-home staffing
average hides daily catastrophes. It doesn't. Here is the full autopsy.**

[**Live site**](https://sawtooth-henna.vercel.app) ·
[Pre-registration](PREREGISTRATION.md) (committed *before* the model ran) ·
[Findings](FINDINGS.md) ·
[M0 data summary](Sawtooth_M0_Summary.md)

| | Baseline | Challenger | Δ AUC | 95% CI | Verdict |
|---|---|---|---|---|---|
| **Primary** — shape beyond level | 0.6118 | 0.6172 | **+0.0054** | [−0.0024, +0.0131] | **NULL** |
| **Secondary** — vs CMS staffing star | 0.6229 | 0.6295 | **+0.0066** | [−0.0062, +0.0187] | **NULL** |

Pre-registered threshold was Δ AUC ≥ 0.03. We missed it by a factor of six, on
20,543 held-out surveys containing 2,358 harm citations. The power floor was met,
so this is a null result — not an underpowered shrug.

**We published it anyway. That is the point of this repository.**

---

## Act I — The assumption: averages lie

CMS grades every nursing home in America on a 1–5 star staffing scale built
largely from a **quarterly average** of nurse hours per resident day.

An average is a lossy summary, so the suspicion writes itself: a facility could
post a perfectly respectable quarterly number while running skeleton crews every
Sunday, swinging wildly day to day, or backfilling half its shifts with agency
temps who have never met the residents. On paper it looks safe. In the building,
on a Tuesday in February, it is not.

If that were true, daily timecard data would predict **actual patient harm**
better than the published average does. That was the hypothesis.

And the sawtooth is real. Across **1,301,313 facility-days at 14,483
facilities**, staffing drops every single weekend:

```
  MON  3.424  #################################
  TUE  3.501  ############################################
  WED  3.520  ###############################################   <- peak
  THU  3.482  #########################################
  FRI  3.438  ###################################
  SAT  3.249  ########                                          <- weekend
  SUN  3.193  #                                                 <- trough
```

Sunday runs **7.2% below** the weekday average. The pattern is universal,
year-round, and invisible in any quarterly summary. It looked like a thread worth
pulling.

### The first thing we did was weaken our own story

Before registering anything, we checked whether CMS *already* publishes what we
were about to call hidden. **It does.**
`adjusted_weekend_total_nurse_staffing_hours_per_resident_per_day` and four
related fields exist at 97.3% coverage, plus nurse turnover.

A weekend *gap* is therefore nearly derivable from public data. So `weekend_gap`
was **excluded from the challenger feature set** before the pre-registration was
written. Claiming credit for information CMS already releases would have been the
easy version of this project.

The sawtooth stayed as the name and the visual. It stopped being the claim. What
survived is what genuinely requires daily timecards: the **shape** of the
within-quarter distribution — its floor, its variance, its runs of thin days, and
the employee-versus-agency split.

---

## Act II — Locking it in

Two things happened before a single feature met a single outcome.

### 1. A real ETL pipeline, because the data fights back

**37 quarters. 49,202,720 facility-days. 1.16 GB of Parquet** built from ~8.7 GB
of raw CSV, processed with DuckDB so nothing ever has to fit in memory.

None of the following is documented in the CMS catalogue. Each silently corrupts
a naive load:

| Defect | What it would have done |
|---|---|
| **Three different file-naming conventions**, and one file that encodes its quarter *nowhere* in its name | Silently lose quarters. `2qky-49qq.csv` was identified as **2020Q3** by reading its `cy_qtr` column — the single gap in the sequence |
| **Eight drifting column names.** 2017 uses `hrs_lpn_admin`, `hrs_na_trn`, `hrs_rn_donadmin`; 2017Q2 carries *both* DON spellings; casing flips at 2020Q1 | Columns quietly become null for four years of history |
| **The files are cp1252, not UTF-8.** Two facilities have `0x92`/`0x96` in their names | 360 rows out of 1.3M abort a strict read of the entire file. `ignore_errors=true` drops rows silently; latin-1 turns those bytes into control characters. We try UTF-8 per line and fall back to cp1252, counting every repair — **10,485** across the panel |
| **An `incomplete` quality flag published for 2021Q4 only** (1.1% of rows) | Equivalent rows are unidentifiable in every other quarter — carried through and declared as a limitation |
| **882 facilities (6.0%) recorded zero deficiencies** | Building the survey universe from the citations file drops 6% of surveys — *every one of them a clean survey* — inflating the positive rate by construction |

**The staleness guard.** The pre-registration said exposure came from "the two
quarters ending strictly before the survey date." Run against a partially
downloaded panel, that rule cheerfully handed a 2025 survey a **2021** exposure
window and produced a clean-looking 28,306-row table that was mostly garbage.
"Ending before" is not the same as "immediately preceding." The window must now
end within 180 days of the survey, or the survey is dropped.

That bug would have been invisible on a complete panel and silently wrong forever
after.

### 2. Pre-registration, pushed to GitHub before the outcome data was touched

[`PREREGISTRATION.md`](PREREGISTRATION.md) was committed **the day before** the
model ran. It fixes, in public, with a timestamp:

- the frame, the outcome definition, and both feature sets
- the estimator and the temporal split (train < 2024-07-01)
- **the decision rule: Δ AUC ≥ 0.03, a paired bootstrap 95% CI excluding zero, and a Brier score no worse**
- **the power floor: ≥2,000 test surveys and ≥500 harm events, or the result is withheld as underpowered rather than reported as a null**
- a commitment to publish whichever way it came out

Two commits, in order, both public. That ordering is the only thing that makes a
null result worth reading.

### We also caught ourselves cheating

Version 1.0 named CMS's published staffing star and turnover measures as the
baseline. Those are published as a **single current snapshot with no archive** —
so a 2026 value would have been used to predict a 2023 survey. v1.0 applied its
leakage guard to the challenger features and left the baseline exempt.

That was our error. It is recorded as [Amendment 1](PREREGISTRATION.md), with the
reason, rather than quietly patched. The baseline was rebuilt from the daily data
as-of the correct window — which makes the test **harder**, since continuous
as-of levels carry strictly more information than a 1–5 star discretisation.

---

## Act III — The null

```
=== PRIMARY - shape beyond level ===
  train 8,218  test 20,543  positives 2,358 (11.5%)
  baseline    AUC 0.6118   Brier 0.10587
  challenger  AUC 0.6172   Brier 0.10482
  delta AUC   +0.0054   95% CI [-0.0024, +0.0131]
    dAUC >= 0.03      FAIL
    CI excludes 0     FAIL
    Brier no worse    PASS
  --> NULL
```

The floor, the variance, the thin-day streaks, the agency mix — all of it,
together, moved discrimination by **half a percentage point**, with a confidence
interval that comfortably contains zero.

The direction is positive. There may be a real effect in there. It is not a
useful one, and it is not the effect we said we would need.

---

## Act IV — Why we were wrong: `r = 0.955`

The interesting question isn't *that* it failed. It's *why*.

We correlated every "shape" feature against the "level" features it was supposed
to improve upon:

| Feature that was supposed to add information | max abs. correlation with a level feature |
|---|---|
| `hprd_p10` — the floor | **0.958** |
| `low_day_freq` — share of days under 3.0 HPRD | **0.758** |
| `max_low_run` — longest thin streak | **0.599** |
| `hprd_cv` — day-to-day variability | 0.178 |
| `agency_share_sd` | 0.036 |
| `agency_share` | **0.017** |

**A facility's 10th-percentile staffing day correlates 0.955 with its quarterly
mean** — and 0.958 with its weekend mean. The floor and the level are the same
number.

Three of our six challenger features were elaborate restatements of the average
we were trying to beat.

The premise was that a mean discards the distribution's shape. **For nurse
staffing, it mostly doesn't.** Facilities are far more consistent week to week
than the "hidden catastrophe" story assumes. A home that averages 3.6 hours per
resident day is not secretly running at 1.8 on Sundays — it is running at roughly
3.4.

The daily chaos we went looking for does not exist at scale. In this industry,
the average tells you the truth.

This is the finding underneath the null, and it is genuinely useful: **anyone
planning to mine PBJ daily data for distributional signal should see 0.955 before
they start.**

---

## Act V — The uncomfortable discovery

While examining the null, something worse turned up.

**Baseline AUC: 0.6118. Pseudo R²: 0.015.**

Staffing — in *any* form we could measure it, published star or reconstructed
as-of levels, mean or shape — predicts a harm citation barely better than the
base rate. The CMS published staffing star does no better (0.6229).

And in the interpretable arm, the most reliably significant predictor of a harm
citation is not a staffing metric at all. It is **the number of beds in the
building**:

| Feature | Coefficient | p |
|---|---|---|
| `agency_share_sd` | +0.181 | **<0.001** |
| **`beds`** | **+0.083** | **0.008** |
| `hprd_p10` | −0.143 | 0.517 |
| `hprd_cv` | −0.124 | 0.086 |
| `mean_hprd` | −0.074 | 0.750 |

Two readings, and this design cannot separate them:

1. **Mechanical.** A bigger facility has more residents, more care events, and
   more surface area for a surveyor to find something. More beds, more chances.
2. **Instrumental.** Inspection outcomes are a noisy measure dominated by the
   surveyor, the state agency, and timing — and staffing genuinely has weak
   influence on what gets cited.

Both are probably partly true. Either way, **the assumption that staffing metrics
predict inspection harm is considerably weaker than the policy conversation
around staffing minimums generally assumes.**

*(A caveat we state rather than bury: with `hprd_p10` correlating 0.955 with
`mean_hprd`, individual coefficients in that table are barely identified. That
`mean_hprd` is not significant should be read as collinearity, not as proof that
staffing level is irrelevant.)*

---

## Act VI — The part that matters

Digging through the wreckage, we found a live wire.

The only two features **not** redundant with staffing level are the agency ones —
how much of a facility's nursing is contract labour, and how much that mix swings
day to day. `agency_share_sd` is the strongest shape coefficient in the model
(+0.181, p < 0.001), and both agency features are significant in the
negative-binomial secondary at a Bonferroni-corrected alpha.

Here is where a portfolio project goes to die.

The tempting move is obvious: delete the pre-registration, rewrite the hypothesis
as *"agency staffing volatility predicts patient harm,"* rerun against that
target, and publish a chart with a p-value under it. It would look like a win.
Nobody would check the commit history.

**That is p-hacking, and we didn't do it.**

The pre-registered test was **held-out discrimination**, and it failed. The agency
result is *in-sample*, on the *training* period, at a corrected alpha. It is a
hypothesis worth someone else pre-registering. It is not a finding this project
earned, and it is not presented as one.

The pre-registration is still in the repository. So is the amendment recording our
own leakage error. So is the null.

**A result you can trust is worth more than a result that flatters you.** That is
the entire deliverable.

---

## Tech Stack

| Layer | Tooling |
|---|---|
| **Ingest / ETL** | Python 3.14, `urllib`, custom cp1252 transcoder, hashed fetch manifest |
| **Storage / compute** | **DuckDB** over Parquet (ZSTD) — 49.2M rows, 1.16 GB, laptop-scale |
| **Modelling** | **scikit-learn** `HistGradientBoostingClassifier`, paired bootstrap (2,000 resamples) |
| **Statistics** | **statsmodels** — logistic with fixed effects, negative binomial |
| **Frontend** | **Next.js 16** (App Router, TypeScript), static export, hand-authored SVG charts |
| **Hosting** | **Vercel** — fully static, no serverless functions |

**Why there is no backend.** The result is fixed. There is no live register and
nothing to compute at request time; every number the site shows is a precomputed
aggregate, and the largest object is a 1.8 MB facility lookup fetched only when
someone searches. A FastAPI service here would serve static rows and call itself
an architecture. The chart palette was likewise validated against colour-vision
deficiency thresholds programmatically rather than by eye.

---

## Data

All free, public, keyless. The join key is the CMS Certification Number
throughout — PBJ's `PROVNUM` *is* the CCN — so there is **no fuzzy matching
anywhere in this project**. Join integrity PBJ ↔ provider information: **99.9%**.

| Source | Grain | Volume |
|---|---|---|
| PBJ Daily Nurse Staffing | facility × day | 49,202,720 rows, 37 quarters |
| Health Deficiencies | citation | 419,479 |
| Penalties | penalty | 15,696 ($456.7M in fines) |
| Provider Information | facility | 14,690 × 99 columns |
| Ownership | owner × facility | 249,452 |

**22,914** citations at scope-severity ≥ G ("actual harm or worse"), survey window
2017-03-23 to 2026-07-23.

---

## Reproduce

Python 3.14, no credentials required.

```bash
python -m venv .venv && .venv/Scripts/python.exe -m pip install -r requirements.txt
```

```bash
.venv/Scripts/python.exe ingest/pbj_manifest.py        # resolve 37 quarters, 3 naming conventions
.venv/Scripts/python.exe ingest/schema_audit.py        # map column drift, recover 2020Q3
.venv/Scripts/python.exe ingest/provider_data.py       # outcomes and covariates
.venv/Scripts/python.exe ingest/build_panel.py         # fetch -> parquet -> discard raw
.venv/Scripts/python.exe analysis/build_features.py    # leakage + staleness guards
.venv/Scripts/python.exe analysis/run_model.py         # the decision rule, applied once
.venv/Scripts/python.exe analysis/diagnostics.py       # redundancy, interpretable arm, secondaries
```

`build_panel.py` is resumable and discards each raw CSV after conversion, so peak
disk stays near 1.5 GB rather than 8.7 GB.

Raw data is **not** committed. `data/fetch_manifest.json` records the sha256, byte
count and fetch time of every file downloaded, so a rebuild can be checked against
what this analysis actually read.

Site deployment: [DEPLOY.md](DEPLOY.md).

---

## Repository map

```
PREREGISTRATION.md          the claim, and Amendment 1 recording our own leakage error
FINDINGS.md                 the full result
Sawtooth_M0_Summary.md      data engineering: what the published files required
ingest/                     manifest, schema audit, transcoder, panel builder
analysis/                   features, the decision rule, diagnostics, site export
web/                        Next.js static site
data/fetch_manifest.json    sha256 of every source file read
```
