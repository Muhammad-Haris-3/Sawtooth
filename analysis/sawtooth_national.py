"""National re-measurement of the day-of-week staffing pattern.

The blueprint's figures came from the first 40 MB of one quarterly file, which
covered 11 states alphabetically. This recomputes them on the complete national
file and reports every exclusion, so the partial-sample estimates can be
checked rather than assumed.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
PARQUET = ROOT / "data" / "parquet"

MIN_CENSUS = 5          # below this the HPRD ratio is unstable
MIN_WEEKDAYS = 40       # of ~64 weekdays in a quarter
MIN_WEEKENDS = 16       # of ~26 weekend days in a quarter

DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def main(quarter: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    src = (PARQUET / f"pbj_{quarter}.parquet").as_posix()
    con = duckdb.connect()

    con.execute(f"""
        CREATE VIEW raw AS SELECT * FROM read_parquet('{src}');

        CREATE VIEW day AS
        SELECT provnum, state, workdate,
               dayofweek(workdate)                       AS dow,      -- 0=Sun
               mdscensus                                 AS census,
               COALESCE(hrs_rn,0)+COALESCE(hrs_lpn,0)+COALESCE(hrs_cna,0)     AS nurse_hrs,
               COALESCE(hrs_rn_ctr,0)+COALESCE(hrs_lpn_ctr,0)+COALESCE(hrs_cna_ctr,0) AS ctr_hrs,
               COALESCE(hrs_rn,0)                        AS rn_hrs
        FROM raw;

        CREATE VIEW clean AS
        SELECT *, nurse_hrs/census AS hprd,
               CASE WHEN dow IN (0,6) THEN 1 ELSE 0 END AS is_weekend
        FROM day
        WHERE census >= {MIN_CENSUS} AND nurse_hrs > 0;
    """)

    # ---- exclusion ledger -------------------------------------------------
    led = con.execute(f"""
        SELECT
          (SELECT COUNT(*) FROM day)                                        AS rows_in,
          (SELECT COUNT(*) FROM day WHERE census IS NULL)                   AS null_census,
          (SELECT COUNT(*) FROM day WHERE census < {MIN_CENSUS})            AS low_census,
          (SELECT COUNT(*) FROM day WHERE census >= {MIN_CENSUS}
                                      AND nurse_hrs <= 0)                   AS zero_hours,
          (SELECT COUNT(*) FROM clean)                                      AS rows_kept,
          (SELECT COUNT(DISTINCT provnum) FROM day)                         AS fac_in,
          (SELECT COUNT(DISTINCT provnum) FROM clean)                       AS fac_kept
    """).fetchone()
    names = ["rows_in", "null_census", "low_census", "zero_hours", "rows_kept",
             "fac_in", "fac_kept"]
    ledger = dict(zip(names, led))

    print(f"=== {quarter} exclusion ledger ===")
    print(f"  facility-days in file        {ledger['rows_in']:>10,}")
    print(f"  census null                  {ledger['null_census']:>10,}")
    print(f"  census < {MIN_CENSUS}                   {ledger['low_census']:>10,}")
    print(f"  zero nurse hours (census ok) {ledger['zero_hours']:>10,}")
    print(f"  kept                         {ledger['rows_kept']:>10,}"
          f"   ({ledger['rows_kept']/ledger['rows_in']:.1%})")
    print(f"  facilities {ledger['fac_in']:,} -> {ledger['fac_kept']:,}")

    # ---- national day-of-week pattern ------------------------------------
    rows = con.execute("""
        SELECT dow, AVG(hprd) AS hprd, COUNT(*) AS n
        FROM clean GROUP BY dow ORDER BY dow
    """).fetchall()
    by_dow = {int(d): (h, n) for d, h, n in rows}

    print(f"\n=== national hours per resident day, by day of week ===")
    order = [1, 2, 3, 4, 5, 6, 0]  # Mon..Sun
    vals = [by_dow[d][0] for d in order]
    lo, hi = min(vals), max(vals)
    for d in order:
        h, n = by_dow[d]
        bar = "#" * int(1 + 46 * (h - lo) / (hi - lo))
        mark = "  <-- weekend" if d in (0, 6) else ""
        print(f"  {DOW[(d-1) % 7][:3].upper()}  {h:5.3f}  {bar}{mark}")

    wk = con.execute("""
        SELECT AVG(CASE WHEN is_weekend=0 THEN hprd END) AS weekday,
               AVG(CASE WHEN is_weekend=1 THEN hprd END) AS weekend,
               AVG(ctr_hrs/NULLIF(nurse_hrs,0))          AS agency_share,
               AVG(rn_hrs/NULLIF(nurse_hrs,0))           AS rn_share
        FROM clean
    """).fetchone()
    gap = 100 * (wk[0] - wk[1]) / wk[0]
    print(f"\n  weekday {wk[0]:.3f} | weekend {wk[1]:.3f} | gap {gap:.1f}%")
    print(f"  agency share of nurse hours {100*wk[2]:.1f}%   RN share {100*wk[3]:.1f}%")

    # ---- per-facility weekend gap ----------------------------------------
    con.execute(f"""
        CREATE VIEW fac AS
        SELECT provnum,
               AVG(CASE WHEN is_weekend=0 THEN hprd END) AS wd,
               AVG(CASE WHEN is_weekend=1 THEN hprd END) AS we,
               AVG(hprd)                                 AS mean_hprd,
               SUM(CASE WHEN is_weekend=0 THEN 1 ELSE 0 END) AS n_wd,
               SUM(CASE WHEN is_weekend=1 THEN 1 ELSE 0 END) AS n_we
        FROM clean GROUP BY provnum;

        CREATE VIEW gaps AS
        SELECT provnum, mean_hprd, 100*(wd-we)/wd AS gap_pct
        FROM fac
        WHERE n_wd >= {MIN_WEEKDAYS} AND n_we >= {MIN_WEEKENDS} AND wd > 0;
    """)

    q = con.execute("""
        SELECT COUNT(*),
               quantile_cont(gap_pct, 0.05), quantile_cont(gap_pct, 0.10),
               quantile_cont(gap_pct, 0.25), quantile_cont(gap_pct, 0.50),
               quantile_cont(gap_pct, 0.75), quantile_cont(gap_pct, 0.90),
               quantile_cont(gap_pct, 0.95), quantile_cont(gap_pct, 0.99),
               MIN(gap_pct), MAX(gap_pct), AVG(gap_pct)
        FROM gaps
    """).fetchone()
    print(f"\n=== per-facility weekend drop (n={q[0]:,} with a full quarter) ===")
    for label, v in zip(["p5", "p10", "p25", "p50", "p75", "p90", "p95", "p99"], q[1:9]):
        print(f"  {label:<4} {v:7.1f}%")
    print(f"  min {q[9]:.1f}%  max {q[10]:.1f}%  mean {q[11]:.1f}%")

    sev = con.execute("""
        SELECT
          (SELECT COUNT(*) FROM gaps)                                        AS n,
          (SELECT COUNT(*) FROM gaps WHERE gap_pct >= 20)                    AS drop20,
          (SELECT COUNT(*) FROM gaps WHERE mean_hprd >= 3.5)                 AS healthy,
          (SELECT COUNT(*) FROM gaps WHERE mean_hprd >= 3.5 AND gap_pct>=20) AS healthy_drop20
    """).fetchone()
    print(f"\n  drop >= 20%: {sev[1]:,} of {sev[0]:,} ({100*sev[1]/sev[0]:.1f}%)")
    print(f"  healthy average (>=3.5 HPRD) AND drop >= 20%: "
          f"{sev[3]:,} of {sev[2]:,} ({100*sev[3]/sev[2]:.1f}%)")

    out = {
        "quarter": quarter, "ledger": ledger,
        "dow_hprd": {DOW[(d-1) % 7]: by_dow[d][0] for d in order},
        "weekday": wk[0], "weekend": wk[1], "gap_pct": gap,
        "agency_share": wk[2], "rn_share": wk[3],
        "gap_percentiles": dict(zip(
            ["p5", "p10", "p25", "p50", "p75", "p90", "p95", "p99"], q[1:9])),
        "gap_min": q[9], "gap_max": q[10], "gap_mean": q[11],
        "n_full_quarter": sev[0], "n_drop20": sev[1],
        "n_healthy": sev[2], "n_healthy_drop20": sev[3],
    }
    dest = ROOT / "analysis" / f"sawtooth_national_{quarter}.json"
    dest.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"\nwrote {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "2026Q1")
