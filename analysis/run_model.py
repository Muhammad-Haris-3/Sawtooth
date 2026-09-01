"""Run the pre-registered comparison, once.

Implements PREREGISTRATION.md v1.1 §5 and §6 exactly.

  baseline    mean_hprd, weekend_hprd, rn_hprd, beds, ownership_type, state
  challenger  baseline + low_day_freq, hprd_p10, hprd_cv, max_low_run,
              agency_share, agency_share_sd
  estimator   HistGradientBoostingClassifier, default hyperparameters, no tuning
  split       temporal, train < 2024-07-01, test on or after
  confirmed   iff  dAUC >= 0.03  AND  paired bootstrap 95% CI excludes 0
                   AND challenger Brier no worse
  power floor >= 2,000 test surveys and >= 500 positive, else withheld

Nothing here is tuned. This script is written to be run one time.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.preprocessing import OrdinalEncoder

ROOT = Path(__file__).resolve().parent.parent
TABLE = ROOT / "analysis" / "model_table.parquet"
SPLIT_DATE = pd.Timestamp("2024-07-01")
CONTEMP_DATE = pd.Timestamp("2025-08-01")
SEED = 20260901
N_BOOT = 2000
DELTA_AUC_THRESHOLD = 0.03
MIN_TEST_SURVEYS = 2000
MIN_TEST_POSITIVE = 500

NUMERIC_BASE = ["mean_hprd", "weekend_hprd", "rn_hprd", "beds"]
CATEGORICAL = ["ownership_type", "state"]
CHALLENGER_EXTRA = ["low_day_freq", "hprd_p10", "hprd_cv", "max_low_run",
                    "agency_share", "agency_share_sd"]


def design(df: pd.DataFrame, extra: list[str], enc: OrdinalEncoder | None):
    num = df[NUMERIC_BASE + extra].astype(float).to_numpy()
    cat_raw = df[CATEGORICAL].astype(str)
    if enc is None:
        enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
        cat = enc.fit_transform(cat_raw)
    else:
        cat = enc.transform(cat_raw)
    X = np.hstack([num, cat])
    cat_idx = list(range(num.shape[1], X.shape[1]))
    return X, cat_idx, enc


def fit_predict(tr: pd.DataFrame, te: pd.DataFrame, extra: list[str], y: str):
    Xtr, cat_idx, enc = design(tr, extra, None)
    Xte, _, _ = design(te, extra, enc)
    clf = HistGradientBoostingClassifier(
        categorical_features=cat_idx, random_state=SEED)
    clf.fit(Xtr, tr[y].to_numpy())
    return clf.predict_proba(Xte)[:, 1], clf


def paired_bootstrap(y, p_base, p_chal, rng, n=N_BOOT):
    """Resample the test set; both models scored on the same resample."""
    deltas = np.empty(n)
    idx = np.arange(len(y))
    got = 0
    while got < n:
        s = rng.choice(idx, size=len(idx), replace=True)
        ys = y[s]
        if ys.min() == ys.max():          # degenerate resample, redraw
            continue
        deltas[got] = roc_auc_score(ys, p_chal[s]) - roc_auc_score(ys, p_base[s])
        got += 1
    return deltas


def compare(tr, te, label, y="harm", extra=CHALLENGER_EXTRA,
            base_extra: list[str] | None = None):
    base_extra = base_extra or []
    rng = np.random.default_rng(SEED)
    yte = te[y].to_numpy()

    p_base, _ = fit_predict(tr, te, base_extra, y)
    p_chal, _ = fit_predict(tr, te, base_extra + extra, y)

    auc_b = roc_auc_score(yte, p_base)
    auc_c = roc_auc_score(yte, p_chal)
    br_b = brier_score_loss(yte, p_base)
    br_c = brier_score_loss(yte, p_chal)
    d = auc_c - auc_b
    boot = paired_bootstrap(yte, p_base, p_chal, rng)
    lo, hi = np.percentile(boot, [2.5, 97.5])

    print(f"\n=== {label} ===")
    print(f"  train {len(tr):,}  test {len(te):,}  positives {int(yte.sum()):,} "
          f"({yte.mean():.1%})")
    print(f"  baseline    AUC {auc_b:.4f}   Brier {br_b:.5f}")
    print(f"  challenger  AUC {auc_c:.4f}   Brier {br_c:.5f}")
    print(f"  delta AUC   {d:+.4f}   95% CI [{lo:+.4f}, {hi:+.4f}]")

    c1 = d >= DELTA_AUC_THRESHOLD
    c2 = lo > 0
    c3 = br_c <= br_b
    print(f"    dAUC >= {DELTA_AUC_THRESHOLD}      {'PASS' if c1 else 'FAIL'}")
    print(f"    CI excludes 0     {'PASS' if c2 else 'FAIL'}")
    print(f"    Brier no worse    {'PASS' if c3 else 'FAIL'}")
    verdict = "CONFIRMED" if (c1 and c2 and c3) else "NULL"
    print(f"  --> {verdict}")

    return {
        "label": label, "n_train": len(tr), "n_test": len(te),
        "positives": int(yte.sum()), "positive_rate": float(yte.mean()),
        "auc_baseline": auc_b, "auc_challenger": auc_c,
        "brier_baseline": br_b, "brier_challenger": br_c,
        "delta_auc": d, "ci_low": lo, "ci_high": hi,
        "criterion_delta": bool(c1), "criterion_ci": bool(c2),
        "criterion_brier": bool(c3), "verdict": verdict,
        "calibration": {
            k: [list(map(float, a)) for a in calibration_curve(yte, p, n_bins=10)]
            for k, p in (("baseline", p_base), ("challenger", p_chal))
        },
    }


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    df = pd.read_parquet(TABLE)
    df["survey_date"] = pd.to_datetime(df["survey_date"])
    for c in NUMERIC_BASE + CHALLENGER_EXTRA:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=NUMERIC_BASE + CHALLENGER_EXTRA)

    tr = df[df.survey_date < SPLIT_DATE]
    te = df[df.survey_date >= SPLIT_DATE]

    print(f"model table {len(df):,} surveys "
          f"({df.survey_date.min().date()} .. {df.survey_date.max().date()})")
    print(f"train {len(tr):,}   test {len(te):,}   test positives {int(te.harm.sum()):,}")

    ok = len(te) >= MIN_TEST_SURVEYS and te.harm.sum() >= MIN_TEST_POSITIVE
    print(f"power floor: {'MET' if ok else 'NOT MET'}")
    if not ok:
        print("\nResult WITHHELD as underpowered, per PREREGISTRATION.md v1.1 §6.")
        (ROOT / "analysis" / "model_results.json").write_text(
            json.dumps({"withheld": True, "n_test": len(te),
                        "test_positives": int(te.harm.sum())}, indent=1),
            encoding="utf-8")
        return

    results = {"primary": compare(tr, te, "PRIMARY - shape beyond level")}

    # Secondary: does it beat the rating CMS actually publishes? Bounded to
    # surveys where the published snapshot is approximately contemporaneous.
    sub = df[df.survey_date >= CONTEMP_DATE].copy()
    sub["staffing_rating"] = pd.to_numeric(sub["staffing_rating"], errors="coerce")
    sub = sub.dropna(subset=["staffing_rating"])
    if len(sub) >= MIN_TEST_SURVEYS and sub.harm.sum() >= MIN_TEST_POSITIVE:
        tr_c = df[df.survey_date < SPLIT_DATE]
        results["contemporaneous"] = compare(
            tr_c.assign(staffing_rating=pd.to_numeric(
                tr_c.staffing_rating, errors="coerce")).dropna(subset=["staffing_rating"]),
            sub, "SECONDARY - vs published staffing star (contemporaneous subset)",
            base_extra=["staffing_rating"])
    else:
        print(f"\nSECONDARY (contemporaneous subset): n={len(sub):,}, "
              f"positives={int(sub.harm.sum()):,} -> underpowered, withheld")
        results["contemporaneous"] = {"withheld": True, "n": len(sub),
                                      "positives": int(sub.harm.sum())}

    (ROOT / "analysis" / "model_results.json").write_text(
        json.dumps(results, indent=1, default=float), encoding="utf-8")
    print("\nwrote analysis/model_results.json")


if __name__ == "__main__":
    main()
