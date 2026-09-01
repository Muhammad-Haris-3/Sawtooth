# Sawtooth — Findings

**The pre-registered claim is null. The shape of a nursing home's daily
staffing does not predict inspection harm better than its level does.**

Decision rule applied once, 2026-09-02, on the complete 37-quarter panel.
Pre-registration committed 2026-09-01, before any feature was joined to any
outcome: [`PREREGISTRATION.md`](PREREGISTRATION.md).

---

## 1. The result

| | Baseline | Challenger | Δ AUC | 95% CI | Verdict |
|---|---|---|---|---|---|
| **Primary** — shape beyond level | 0.6118 | 0.6172 | **+0.0054** | [−0.0024, +0.0131] | **NULL** |
| **Secondary** — vs published staffing star | 0.6229 | 0.6295 | **+0.0066** | [−0.0062, +0.0187] | **NULL** |

Test period 2024-07-01 to 2026-07-24: **20,543 surveys, 2,358 harm events
(11.5%)**. Power floor (≥2,000 surveys, ≥500 events) met with room to spare, so
this is a null, not an underpowered withholding.

Pre-registered threshold was Δ AUC ≥ 0.03. The observed effect is **six times
smaller than that**, and its confidence interval includes zero. Brier score
improved very slightly in both arms — the challenger is marginally better
calibrated while being no better at ranking.

The direction is positive in both arms and in every bootstrap percentile above
the 20th. There may be a real effect here. It is not a useful one.

---

## 2. Why it is null

Three of the six challenger features are near-restatements of the level they
were supposed to improve on.

| Shape feature | max abs. correlation with a level feature |
|---|---|
| `hprd_p10` (the floor) | **0.958** |
| `low_day_freq` | **0.758** |
| `max_low_run` | **0.599** |
| `hprd_cv` | 0.178 |
| `agency_share_sd` | 0.036 |
| `agency_share` | **0.017** |

A facility's 10th-percentile day correlates **0.955** with its quarterly mean,
and **0.958** with its weekend mean. The "floor" and the "level" are very nearly
the same number.

This is the finding underneath the null, and it was not obvious in advance. The
project's premise was that a mean discards the distribution's shape. For nurse
staffing it largely does not: facilities are consistent enough week to week that
knowing the average tells you the floor. **The information was never hiding in
the daily data, because the daily data is not that different from the quarterly
summary.**

---

## 3. What did survive, and what it is worth

The two features that are *not* redundant with the level — agency staffing —
are the only ones carrying independent signal.

Interpretable arm (logistic, standardised, train period, n=8,218):

| Feature | Coefficient | p | Direction |
|---|---|---|---|
| `agency_share_sd` | **+0.181** | **<0.001** | as expected |
| `beds` | +0.083 | 0.008 | as expected |
| `hprd_p10` | −0.143 | 0.517 | as expected |
| `hprd_cv` | −0.124 | 0.086 | opposite |
| `mean_hprd` | −0.074 | 0.750 | as expected |
| `agency_share` | +0.043 | 0.307 | as expected |

Secondary outcome (citation count, negative binomial, Bonferroni α = 0.0167):
**`agency_share` and `agency_share_sd` are both significant.**

So *day-to-day volatility in agency reliance* — a facility whose contract-staff
mix swings around — is associated with more citations and more harm. It is
orthogonal to staffing level, so it is genuinely new information.

**This does not rescue the project's claim, and is not presented as if it did.**
The pre-registered test was held-out discrimination, and it failed. The agency
result is in-sample, on the training period, at a corrected alpha. It is a
hypothesis for someone else to pre-register, not a finding this project has
earned.

**A technical caveat that matters:** with `hprd_p10` correlating 0.955 with
`mean_hprd`, the individual coefficients in that table are barely identified.
That `mean_hprd` is not significant should be read as collinearity, not as
evidence that staffing level does not matter.

---

## 4. The larger result nobody was looking for

**Baseline AUC is 0.6118. Pseudo R² is 0.015.**

Staffing — in any form measured here, published or reconstructed, level or
shape — predicts a harm citation barely better than a coin weighted by base
rate. The published staffing star does no better (0.6229).

Facility **bed count** is a stronger and more reliably significant predictor
than any staffing measure in the model.

That is a more uncomfortable result than the one this project set out to test,
and it cuts at the premise shared by every version of it, including the
original. Two readings, and this design cannot distinguish them:

1. Staffing genuinely has weak influence on what inspections cite.
2. Inspections are a noisy instrument, and citation depends heavily on the
   surveyor, the state, and timing.

Reading 2 is at least partly true — health inspection outcomes are known to vary
by state survey agency. Either way, **the assumption that staffing metrics
predict inspection harm is weaker than the policy conversation around staffing
minimums generally assumes.**

---

## 5. What would have to be true for this to be wrong

- **Case-mix.** Challenger features are unadjusted; the baseline uses PBJ-derived
  levels, also unadjusted. Sicker residents need more hours, so some of the
  weak signal may be acuity cancelling out staffing.
- **Outcome choice.** Scope-severity ≥ G is a coarse binary. A severity-weighted
  or harm-scope-weighted outcome might separate better.
- **Two-quarter window.** Exposure was fixed at two quarters before the survey.
  A longer or shorter window was not tested, and testing several would have been
  the multiple-comparisons problem the pre-registration existed to prevent.
- **Predictive, not causal.** Nothing here estimates the effect of changing
  staffing. A facility that raises staffing may or may not be cited less.

---

## 6. What this project is now

A pre-registered test that returned a clean null, plus two by-products worth
more than the original hypothesis:

1. **`hprd_p10` ≈ `mean_hprd` at r = 0.955.** Daily staffing data adds less to
   nursing-home quality measurement than its granularity suggests. Anyone
   planning to mine PBJ for distributional signal should see this number first.
2. **Staffing predicts cited harm at AUC ≈ 0.61.** Weak, for the published star
   and the reconstructed levels alike.

Both are results. Neither is the result that was wanted, and the pre-registration
committed to publishing whatever came out.

---

## Reproduce

```
analysis/build_features.py    # model table, leakage + staleness guards
analysis/run_model.py         # the decision rule, applied once
analysis/diagnostics.py       # redundancy, interpretable arm, secondary outcomes
```

Outputs: `analysis/model_results.json`, `analysis/diagnostics.json`.
