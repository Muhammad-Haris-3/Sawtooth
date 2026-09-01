# Sawtooth

**Project blueprint — data analyst centerpiece**
Sources: CMS Payroll-Based Journal · CMS Provider Data Catalog
Compiled 2026-09-01. All figures below measured before the project starts.

---

Medicare publishes one staffing number per nursing home: a case-mix adjusted
quarterly *mean*. Care is not delivered on average. It is delivered on
particular days, by particular skill levels, by people who may have arrived
that morning from an agency.

**Sawtooth asks whether the dimensions the mean discards predict harm the
rating misses.**

Falsifiable. Could return null.

---

## The measured hook

Total nurse hours per resident day, by day of week:

```
  MON  3.655  ##############################################
  TUE  3.728  #################################################
  WED  3.749  #################################################   <- peak
  THU  3.708  ################################################
  FRI  3.672  ##############################################
  SAT  3.467  ######################################
  SUN  3.413  ####################################               <- trough
```

Measured from **231,063 facility-days** across **2,572 facilities**, CY2026Q1.
Partial sample — the first 40 MB of the quarterly file, covering 11 states
alphabetically (AK–GA). Raw hours per resident day, no case-mix adjustment.

Weekday mean **3.702** · weekend mean **3.440** · gap **7.1%**
Contract/agency share of nurse hours: **2.8%**

---

## 01 · What I tested, and what failed

The tempting pitch is *"a four-star home runs skeleton crews on Sundays and the
rating hides it."* That was checked on real data before being recommended. It is
**mostly not true**, and you need to know that before building a landing page
around it.

Weekend staffing drop, per facility:

| Description | Percentile |
|---|---|
| Staffs *more* on weekends | p5 = −1.5% |
| Barely moves | p25 = 2.8% |
| **Typical facility** | **p50 = 6.3%** |
| Noticeable dip | p90 = 15.2% |
| Severe dip | p99 = 23.8% |

Range: min −81.8%, max 37.9%, mean 6.9%.

Of 2,567 facilities with a full quarter, only **94 (3.7%)** drop 20% or more at
weekends. Among the 1,336 with a healthy-looking quarterly average (≥3.5 HPRD),
only **40 (3.0%)** also collapse at weekends.

So the weekend gap is **real, near-universal, and mostly modest.** "The rating
hides a catastrophe" would be an overclaim. "The rating hides a catastrophe for
roughly one facility in thirty" is true, and nationally that is still several
hundred homes — but it is a different, smaller, honest sentence.

This is why the project is framed as a *question* rather than an exposé. Weekend
gap is one discarded dimension out of four, and on its own it is not the story.
The real question is whether **any** of them carry signal the published rating
does not.

---

## 02 · The four dimensions a mean discards

**Which days.** Weekend gap, day-to-day coefficient of variation, and *low-day
frequency* — the share of days below a clinical floor. A facility averaging 3.6
with ten days under 2.5 is not the same facility as one steady at 3.6.

**Which skill.** RN share of total nurse hours. The file separates `Hrs_RN`,
`Hrs_LPN`, `Hrs_CNA`. Registered-nurse coverage is the component clinical
literature ties most tightly to outcomes, and the headline number blends it away.

**Which people.** Every category splits `_emp` versus `_ctr` — employed versus
contract agency. Agency share averages 2.8% in this sample but is heavily
skewed. Continuity of care is invisible to an hours count.

**Which residents.** `MDScensus` gives a daily denominator, so hours per
resident day is computable per day rather than per quarter. Most published
analysis cannot do this because most published analysis starts from the
quarterly aggregate.

---

## 03 · The pre-registered claim

**Primary outcome.** Adding the four discarded dimensions to a model containing
the published CMS staffing star rating improves prediction of a **scope-severity
≥ G deficiency ("actual harm") cited at the facility's next standard health
survey.**

```
Baseline   — CMS staffing star + beds + ownership type + state.
Challenger — baseline + weekend_gap, hprd_cv, low_day_freq,
             rn_share, agency_share.
Metric     — delta AUC >= 0.03, 95% bootstrap CI excluding zero.
             Brier score reported alongside.
Split      — temporal. Fit on earlier quarters, evaluate only on
             later surveys.
```

**Restrict the primary analysis to standard surveys.** Complaint and
infection-control surveys are triggered *by* problems, so including them builds
the outcome into the sampling. The `Standard Deficiency` flag makes this a
one-line filter and a paragraph of justification — exactly the kind of decision
an interviewer will probe.

**State plainly that the claim is predictive, not causal.** Thin staffing and
citations share obvious common causes, and an inspector who walks into a
short-staffed building may cite more because of what they see. Run a facility
fixed-effects panel model as a secondary analysis to ask the within-facility
question, and label it as supporting evidence rather than identification.

---

## 04 · The analytical program

### Clean

The demonstration piece, and the one most portfolios skip. Publish a
data-quality appendix with exclusion counts at every step.

- Zero-hour days — closure, or a reporting failure? They are not the same and
  must be separated.
- Census outliers and `MDScensus` near zero, which explode the HPRD ratio.
- **Facilities that staff *up* at weekends** — the sample minimum is −81.8%.
  Real operating model or bad data? Investigate before excluding.
- CCN changes on ownership transfer, which silently break the facility panel.

### Explore

The sawtooth by state, by ownership type, by chain. Agency share over time. The
joint distribution of quarterly mean against weekend floor — this scatter *is*
the project's argument, and where the rating's blind spot becomes visible as a
cloud rather than a claim.

### Model

`statsmodels` for the interpretable layer — logistic regression with facility
and state fixed effects, negative binomial for deficiency counts.
`scikit-learn` gradient boosting for the predictive comparison, with a
calibration curve, not just an AUC.

Report the baseline and challenger side by side with bootstrap intervals. If the
challenger does not win, say so — that is the Triage outcome and it is
publishable.

### Decide

End in a costed recommendation, the way OrderLens does:

> *"N facilities carry an acceptable published rating and a weekend floor below
> the harm threshold. Here they are. Re-weighting the staffing star by low-day
> frequency would reclassify M of them."*

A number a regulator or a family could act on.

---

## 05 · Data, verified

| Source | Grain | Gives you |
|---|---|---|
| PBJ Daily Nurse Staffing | facility × day | Hours by RN/LPN/CNA, employee vs contract, daily census. Quarterly CSVs, multi-year. |
| Health Deficiencies | citation | Survey date, survey type, tag number, **scope-severity A–L**, standard vs complaint flag |
| Penalties | penalty | **Fine amount in dollars**, payment-denial days, penalty date |
| Provider Information | facility | Star ratings, ownership type, beds, **chain ID and chain size** |
| Ownership | owner × facility | Owner name, type, **ownership percentage**, association date |

**Join key: CCN.** PBJ's `PROVNUM` is the CMS Certification Number. Every table
above keys on it. No fuzzy matching anywhere in this project.

**Use DuckDB, not pandas-in-memory.** A quarter is roughly 1.3M rows; several
years across the staffing files runs to multiple GB. Write the quarterly CSVs to
Parquet once, then query with DuckDB and pull only aggregates into Pandas. It is
the correct tool, it runs on a laptop, and it reads as a current analytics stack
without becoming an infrastructure project.

### PBJ columns (confirmed)

```
PROVNUM, PROVNAME, CITY, STATE, COUNTY_NAME, COUNTY_FIPS, CY_Qtr,
WorkDate, MDScensus,
Hrs_RNDON,    Hrs_RNDON_emp,    Hrs_RNDON_ctr,
Hrs_RNadmin,  Hrs_RNadmin_emp,  Hrs_RNadmin_ctr,
Hrs_RN,       Hrs_RN_emp,       Hrs_RN_ctr,
Hrs_LPNadmin, Hrs_LPNadmin_emp, Hrs_LPNadmin_ctr,
Hrs_LPN,      Hrs_LPN_emp,      Hrs_LPN_ctr,
Hrs_CNA,      Hrs_CNA_emp,      Hrs_CNA_ctr,
Hrs_NAtrn,    Hrs_NAtrn_emp,    Hrs_NAtrn_ctr,
Hrs_MedAide,  Hrs_MedAide_emp,  Hrs_MedAide_ctr
```

Catalogs:
- CMS data catalog: `https://data.cms.gov/data.json`
- Provider data catalog:
  `https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items`
- Provider dataset ids — Health Deficiencies `r5ix-sfxw`, Penalties `g6vv-u9sr`,
  Provider Information `4pq5-n9py`, Ownership `y2hd-n93e`

---

## 06 · What the dashboard shows

**The sawtooth — hero.** The day-of-week chart, live and national. One line,
seven points, an immediately legible drop. Nobody needs the methodology
explained to understand it.

**Facility lookup.** Search a home. Its own week-shape against its published
star rating. *"Four stars. On Sundays it staffs like a two."* — shown only where
that is actually true, which is roughly one facility in thirty.

**The blind-spot scatter.** Published rating on one axis, weekend floor on the
other, points marked where a harm-level citation followed. The rating's failure
cases sit in a visible corner.

**The scorecard.** Baseline AUC versus challenger AUC with intervals, plus the
calibration curve. Publishing your own model's limits is the single most senior
thing on the site.

---

## 07 · Known risks

- **Case-mix adjustment may not be exactly reproducible.** CMS adjusts expected
  hours using resident acuity. Report raw and adjusted separately and state
  which drives each conclusion.
- **This ground has been walked before.** A 2018 New York Times investigation
  used PBJ to show facilities overstating staffing. Treat that as an asset —
  estimate independently, then compare against the published finding, exactly as
  Groundtruth does.
- **The challenger model may not beat the star rating.** Given what section 01
  measured, this is a genuine possibility. Decide now that you will publish it
  either way.
- **These figures are one quarter and eleven states.** Re-measure on the full
  national file before anything goes on a page.

---

*Sawtooth · project blueprint · staffing figures measured from CMS PBJ CY2026Q1,
partial sample, 2026-09-01 · all sources free, public, and keyless*
