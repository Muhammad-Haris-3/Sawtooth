# Sawtooth — Pre-registration v1.0

**Committed 2026-09-01, before any staffing feature has been joined to any
outcome and before any model has been fitted.**

This document fixes the frame, the features, the model comparison, the decision
threshold and the failure conditions. Everything here was written while the
37-quarter panel was still downloading. If any of it changes, the change is
made as a numbered amendment with the reason recorded and this version retained
in git history.

---

## 0. What was known when this was written

Being explicit, because the credibility of everything below depends on it.

**Known — descriptive, 2026Q1 only:**

- National day-of-week staffing: weekday 3.472 HPRD, weekend 3.221, gap 7.2%.
- Per-facility weekend drop: median 6.6%, p90 15.7%, p99 24.8%.
- 514 of 14,461 facilities (3.6%) drop ≥20%; 188 of those also carry a
  quarterly average ≥3.5 HPRD.
- Agency share of nurse hours 5.5%; RN share 13.5%.
- 22,914 citations at scope-severity ≥ G across 2017–2026.
- PBJ↔provider-info join integrity 99.9%.

**Not known — nothing below has been looked at:**

- Any association, of any kind, between any staffing feature and any outcome.
- Any model fit, any AUC, any coefficient, any cross-tabulation of staffing
  against citations.

The descriptive facts above are about the *exposure distribution* and the
*outcome counts* separately. The joint distribution is unexamined.

---

## 1. The premise had to be narrowed before it was registered

The project was conceived as *"CMS publishes a quarterly mean, so weekend
staffing is invisible."* **That is false, and it was checked before
registering rather than after.**

`provider_info` publishes, at 97.1–97.3% coverage:

- `total_number_of_nurse_staff_hours_per_resident_per_day_on_the_weekend`
- `adjusted_weekend_total_nurse_staffing_hours_per_resident_per_day`
- `case_mix_weekend_total_nurse_staffing_hours_per_resident_per_day`
- `registered_nurse_hours_per_resident_per_day_on_the_weekend`
- `total_nursing_staff_turnover`, `registered_nurse_turnover`

CMS publishes weekend staffing *levels*. A weekend **gap** is therefore very
nearly derivable from published data — total and weekend HPRD together imply
the weekday figure.

**Consequence, accepted in advance: `weekend_gap` is excluded from the
challenger feature set.** Including it would let the project claim credit for
information CMS already releases. The sawtooth remains the project's visual and
its name; it is no longer its claim.

What is left, and what genuinely requires the daily file, is the **shape of the
within-quarter distribution** — its floor, its variance, its runs, and the
employed-versus-agency split. No published CMS aggregate contains any of these.

---

## 2. Frame

**Unit of analysis:** one facility × one standard health survey.

**Survey universe:** `rating_cycle_1_standard_survey_health_date` and
`rating_cycle_2_standard_health_survey_date` from `provider_info`.

This choice is deliberate and load-bearing. **882 facilities (6.0%) recorded
zero standard health deficiencies in cycle 1.** Those surveys leave no row in
the citations file. Deriving the survey universe from citations would therefore
drop 6% of all surveys — every one of them a clean survey — and inflate the
positive rate by construction. The provider-info cycle dates include them.

**Inclusion:** a survey enters the frame if

1. its date falls in the published PBJ coverage window, and
2. at least **two complete PBJ quarters end strictly before** the survey date,
   and
3. the facility has ≥ 60 usable facility-days in that exposure window, and
4. the facility appears in `provider_info` with a non-null `staffing_rating`.

**Exclusion, declared now:** facility-days with `mdscensus < 5` or zero total
nurse hours, as used in M0 (this removed 0.2% of 2026Q1). Facilities whose CCN
changes within the exposure window are dropped rather than stitched.

**Leakage guard:** every feature is computed from quarters that end *strictly
before* the survey date. A survey may itself change staffing behaviour, so no
part of the survey quarter enters the exposure window. This is asserted in code
and any violation raises rather than warns.

---

## 3. Outcome

**Primary outcome:** at least one citation with scope-severity code in
{G, H, I, J, K, L} — "actual harm or immediate jeopardy" — recorded at that
standard survey.

Determined by joining the citations file on (CCN, survey date). **A survey with
no matching citation row is outcome 0, not missing.** This is only valid
because the universe comes from provider_info; it is the reason for that choice.

**Secondary outcomes, declared now and reported with explicit multiplicity
correction:**

- Count of standard deficiencies at the survey (negative binomial).
- Any monetary penalty within 180 days after the survey. Penalties are only
  published from 2023-08-19, so this is restricted to surveys after that date
  and is reported as underpowered if it yields fewer than 300 events.

---

## 4. Feature sets

### Baseline — everything CMS already publishes

`staffing_rating`, `adjusted_total_nurse_staffing_hours_per_resident_per_day`,
`adjusted_weekend_total_nurse_staffing_hours_per_resident_per_day`,
`adjusted_rn_staffing_hours_per_resident_per_day`,
`total_nursing_staff_turnover`, `registered_nurse_turnover`,
`number_of_certified_beds`, `ownership_type`, `state`.

The baseline is deliberately strong. Beating a weak baseline would prove
nothing.

### Challenger — baseline plus features that require the daily file

| Feature | Definition |
|---|---|
| `low_day_freq` | share of days in the window with HPRD < **3.0** |
| `hprd_p10` | 10th percentile of daily HPRD — the floor |
| `hprd_cv` | standard deviation ÷ mean of daily HPRD |
| `max_low_run` | longest consecutive run of days with HPRD < 3.0 |
| `agency_share` | contract nurse hours ÷ total nurse hours |
| `agency_share_sd` | between-day variability of agency share |

**The 3.0 HPRD threshold is fixed now**, before any outcome has been examined,
and is not tuned. Sensitivity at 2.5 and 3.5 is reported as a robustness check,
never as the headline.

`weekend_gap` is **excluded** for the reason given in §1.

---

## 5. Model and comparison

Both arms use the same estimator, the same folds and the same preprocessing:
gradient-boosted trees (`sklearn.ensemble.HistGradientBoostingClassifier`),
default hyperparameters, no tuning on the test period.

An interpretable arm — logistic regression with state fixed effects
(`statsmodels`) — is fitted on the same feature sets and reported alongside, so
that coefficient signs can be inspected. It is not the primary comparison.

**Split: temporal, not random.** Fit on surveys dated before **2024-07-01**;
evaluate only on surveys dated on or after it. A facility may appear in both
periods; facility-level grouping is *not* applied, because the operational
question is whether a facility's current staffing shape predicts its next
survey, and that is a facility-repeated question by nature. This is stated so it
cannot later be presented as an oversight.

---

## 6. Decision rule

**The primary claim is confirmed only if all three hold:**

1. **ΔAUC ≥ 0.03** (challenger minus baseline) on the held-out period.
2. The **95% bootstrap CI for ΔAUC excludes zero** (2,000 resamples of the test
   set, paired).
3. The challenger's **Brier score is no worse** than the baseline's.

Anything else is a null result and is published as one.

**Power floor, fixed now.** The comparison is only reportable if the test period
contains **≥ 2,000 surveys and ≥ 500 positive (≥G) outcomes**. Below either
floor, the result is reported as *underpowered and withheld*, not as a null and
not as a trend.

**Calibration is reported regardless of outcome** — a reliability curve in ten
bins for both arms.

---

## 7. What would make this project wrong

Named in advance so they cannot be quietly absorbed later.

- **Inspector reactivity.** An inspector who walks into a visibly short-staffed
  building may cite more because of what they see. This makes the association
  partly mechanical. **The primary claim is predictive, not causal,** and will
  be worded that way everywhere on the site.
- **Facility fixed-effects support.** A within-facility panel model is reported
  as *supporting evidence only*. It is not identification and will not be
  described as such.
- **Case-mix.** CMS's adjusted figures are used in the baseline; challenger
  features are unadjusted daily values. If the challenger wins, part of the gain
  may be residual acuity rather than staffing shape. Stated as a limitation, not
  buried.
- **The `incomplete` flag.** CMS published a row-level quality flag for 2021Q4
  only (1.1% of rows). Equivalent rows cannot be identified in other quarters.
- **Survey timing is not random.** Restricting to standard surveys removes
  complaint-triggered inspections, but standard survey timing still varies with
  prior performance.

---

## 8. Publication commitment

The result is published whichever way it comes out, including if the challenger
adds nothing. A null here is a genuine finding: *daily staffing granularity,
which only PBJ provides, adds nothing beyond the aggregates CMS already
publishes.* That would be worth knowing and is the outcome this design is most
at risk of producing.

No figure derived from this comparison appears anywhere public before this
document's decision rule has been applied once.

---

*v1.0 — 2026-09-01. Amendments append below with date and reason; the original
text is never edited.*
