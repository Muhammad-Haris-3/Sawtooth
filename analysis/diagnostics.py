"""Post-decision diagnostics and the remaining pre-registered analyses.

The primary decision rule has already been applied once, in run_model.py, and
returned NULL. Nothing here can change that verdict. This script exists to make
the null *informative*: is it "these features carry no signal", or "they carry
signal that the level already contains"?

Runs the interpretable arm (v1.1 §5) and the secondary outcomes (§3), with the
multiplicity correction §3 requires.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm

ROOT = Path(__file__).resolve().parent.parent
SPLIT_DATE = pd.Timestamp("2024-07-01")
PENALTY_START = pd.Timestamp("2023-08-19")

BASE = ["mean_hprd", "weekend_hprd", "rn_hprd", "beds"]
SHAPE = ["low_day_freq", "hprd_p10", "hprd_cv", "max_low_run",
         "agency_share", "agency_share_sd"]


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    df = pd.read_parquet(ROOT / "analysis" / "model_table.parquet")
    df["survey_date"] = pd.to_datetime(df["survey_date"])
    for c in BASE + SHAPE:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=BASE + SHAPE)

    out: dict = {}

    # ---- 1. Why the null? Redundancy between shape and level ---------------
    print("=== correlation of each shape feature with the level features ===")
    print(f"{'feature':<18}{'mean_hprd':>11}{'weekend_hprd':>14}{'rn_hprd':>10}{'max |r|':>10}")
    red = {}
    for s in SHAPE:
        rs = {b: df[s].corr(df[b]) for b in ["mean_hprd", "weekend_hprd", "rn_hprd"]}
        mx = max(abs(v) for v in rs.values())
        red[s] = {**rs, "max_abs": mx}
        print(f"  {s:<16}{rs['mean_hprd']:>11.3f}{rs['weekend_hprd']:>14.3f}"
              f"{rs['rn_hprd']:>10.3f}{mx:>10.3f}")
    out["redundancy"] = red

    # ---- 2. Interpretable arm (pre-registered §5) --------------------------
    tr = df[df.survey_date < SPLIT_DATE]
    X = tr[BASE + SHAPE].copy()
    X = (X - X.mean()) / X.std()          # standardised, so signs compare
    X = sm.add_constant(X)
    y = tr["harm"].to_numpy()
    res = sm.Logit(y, X).fit(disp=0)

    print("\n=== interpretable arm: logistic, standardised, train period ===")
    print(f"  n={len(tr):,}  pseudo R2={res.prsquared:.4f}")
    print(f"  {'feature':<18}{'coef':>9}{'p':>9}   direction")
    coefs = {}
    for name in BASE + SHAPE:
        b, p = res.params[name], res.pvalues[name]
        # More staffing should mean less harm; more thin-day burden, more harm.
        expected = "-" if name in ("mean_hprd", "weekend_hprd", "rn_hprd", "hprd_p10") else "+"
        got = "+" if b > 0 else "-"
        flag = "as expected" if got == expected else "OPPOSITE"
        star = "*" if p < 0.05 else " "
        print(f"  {name:<16}{b:>9.3f}{p:>9.3f}{star}  {flag}")
        coefs[name] = {"coef": float(b), "p": float(p), "expected": expected,
                       "observed": got, "significant": bool(p < 0.05)}
    out["interpretable"] = {"n": len(tr), "pseudo_r2": float(res.prsquared),
                            "coefficients": coefs}

    # ---- 3. Secondary outcomes (pre-registered §3) ------------------------
    print("\n=== secondary outcomes, Bonferroni-corrected alpha = 0.05/3 = 0.0167 ===")
    te = df[df.survey_date >= SPLIT_DATE]

    # (a) citation count, negative binomial
    Xtr = sm.add_constant((tr[BASE + SHAPE] - tr[BASE + SHAPE].mean()) / tr[BASE + SHAPE].std())
    nb = sm.NegativeBinomial(tr["n_citations"].to_numpy(), Xtr).fit(disp=0)
    sig = {k: float(nb.pvalues[k]) for k in SHAPE if nb.pvalues[k] < 0.0167}
    print(f"  (a) citation count (negative binomial): shape features significant "
          f"at corrected alpha: {list(sig) or 'none'}")
    out["neg_binomial"] = {"shape_significant": sig,
                           "params": {k: float(nb.params[k]) for k in BASE + SHAPE}}

    # (b) any monetary penalty within 180 days of the survey
    pen = pd.read_parquet(ROOT / "data" / "parquet" / "nh_penalties.parquet")
    pen["penalty_date"] = pd.to_datetime(pen["penalty_date"], errors="coerce")
    pen = pen.dropna(subset=["penalty_date"])
    sub = df[df.survey_date >= PENALTY_START].copy()
    pj = sub.merge(pen[["cms_certification_number_ccn", "penalty_date"]],
                   left_on="ccn", right_on="cms_certification_number_ccn", how="left")
    pj["within"] = ((pj.penalty_date >= pj.survey_date) &
                    (pj.penalty_date <= pj.survey_date + pd.Timedelta(days=180)))
    hit = pj.groupby(["ccn", "survey_date"])["within"].max().fillna(False)
    events = int(hit.sum())
    print(f"  (b) penalty within 180 days: {events:,} events across {len(hit):,} surveys "
          f"-> {'usable' if events >= 300 else 'UNDERPOWERED, withheld'}")
    out["penalty_outcome"] = {"surveys": len(hit), "events": events,
                              "usable": bool(events >= 300)}

    (ROOT / "analysis" / "diagnostics.json").write_text(
        json.dumps(out, indent=1, default=float), encoding="utf-8")
    print("\nwrote analysis/diagnostics.json")


if __name__ == "__main__":
    main()
