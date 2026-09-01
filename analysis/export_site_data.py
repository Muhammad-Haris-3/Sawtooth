"""Export every number the website shows into static JSON.

The result is fixed and there is nothing to compute at request time, so the
site ships as static files. Facility records are written as arrays-of-arrays
with a separate schema key rather than arrays-of-objects, which roughly halves
the payload.
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "sawtooth.duckdb"
OUT = ROOT / "web" / "public" / "data"
PQ = ROOT / "data" / "parquet"
LOOKUP_QUARTER = "2026Q1"
SCATTER_N = 3000
SEED = 20260901


def write(name: str, obj) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / name
    p.write_text(json.dumps(obj, separators=(",", ":"), default=float), encoding="utf-8")
    print(f"  {name:<22}{p.stat().st_size/1024:8.1f} KB")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    con = duckdb.connect(str(DB), read_only=True)

    # ---- 1. national day-of-week pattern --------------------------------
    nat = json.loads((ROOT / "analysis" / f"sawtooth_national_{LOOKUP_QUARTER}.json")
                     .read_text(encoding="utf-8"))
    write("sawtooth.json", {
        "quarter": LOOKUP_QUARTER,
        "dow": nat["dow_hprd"],
        "weekday": nat["weekday"], "weekend": nat["weekend"],
        "gap_pct": nat["gap_pct"],
        "agency_share": nat["agency_share"], "rn_share": nat["rn_share"],
        "facility_days": nat["ledger"]["rows_kept"],
        "facilities": nat["ledger"]["fac_kept"],
        "percentiles": nat["gap_percentiles"],
        "n_full_quarter": nat["n_full_quarter"], "n_drop20": nat["n_drop20"],
        "n_healthy": nat["n_healthy"], "n_healthy_drop20": nat["n_healthy_drop20"],
    })

    # ---- 2. the result ---------------------------------------------------
    res = json.loads((ROOT / "analysis" / "model_results.json").read_text(encoding="utf-8"))
    diag = json.loads((ROOT / "analysis" / "diagnostics.json").read_text(encoding="utf-8"))
    write("results.json", {"model": res, "diagnostics": diag})

    # ---- 3. the redundancy scatter: the finding, made visible ------------
    pts = con.execute(f"""
        SELECT mean_hprd, hprd_p10, harm
        FROM model_table
        WHERE mean_hprd IS NOT NULL AND hprd_p10 IS NOT NULL
        USING SAMPLE {SCATTER_N} ROWS (reservoir, {SEED})
    """).fetchall()
    write("redundancy.json", {
        "r": diag["redundancy"]["hprd_p10"]["mean_hprd"],
        "n_total": con.execute("SELECT COUNT(*) FROM model_table").fetchone()[0],
        "schema": ["mean_hprd", "hprd_p10", "harm"],
        "points": [[round(a, 3), round(b, 3), int(c)] for a, b, c in pts],
        "correlations": diag["redundancy"],
    })

    # ---- 4. weekend-gap distribution histogram --------------------------
    hist = con.execute("""
        WITH g AS (
          SELECT provnum,
                 AVG(CASE WHEN dayofweek(workdate) NOT IN (0,6) THEN hprd END) wd,
                 AVG(CASE WHEN dayofweek(workdate) IN (0,6) THEN hprd END) we,
                 COUNT(*) n
          FROM day WHERE src_quarter = ? GROUP BY 1
        )
        SELECT FLOOR(LEAST(GREATEST(100*(wd-we)/wd, -10), 35)/2.5)*2.5 AS bin,
               COUNT(*) AS n
        FROM g WHERE n >= 56 AND wd > 0
        GROUP BY 1 ORDER BY 1
    """, [LOOKUP_QUARTER]).fetchall()
    write("gap_hist.json", {"bin_width": 2.5,
                            "bins": [[float(b), int(n)] for b, n in hist]})

    # ---- 5. facility lookup ---------------------------------------------
    rows = con.execute(f"""
        WITH d AS (
          SELECT provnum, dayofweek(workdate) dw, hprd,
                 ctr_hrs/NULLIF(nurse_hrs,0) AS ctr
          FROM day WHERE src_quarter = '{LOOKUP_QUARTER}'
        ),
        agg AS (
          SELECT provnum,
                 AVG(CASE WHEN dw=1 THEN hprd END) mon,
                 AVG(CASE WHEN dw=2 THEN hprd END) tue,
                 AVG(CASE WHEN dw=3 THEN hprd END) wed,
                 AVG(CASE WHEN dw=4 THEN hprd END) thu,
                 AVG(CASE WHEN dw=5 THEN hprd END) fri,
                 AVG(CASE WHEN dw=6 THEN hprd END) sat,
                 AVG(CASE WHEN dw=0 THEN hprd END) sun,
                 AVG(hprd) mean_hprd,
                 quantile_cont(hprd, 0.10) p10,
                 AVG(ctr) agency,
                 COUNT(*) n
          FROM d GROUP BY 1 HAVING COUNT(*) >= 56
        )
        SELECT a.provnum, p.provider_name, p.city_town, p.state,
               a.mon,a.tue,a.wed,a.thu,a.fri,a.sat,a.sun,
               a.mean_hprd, a.p10, a.agency,
               TRY_CAST(p.staffing_rating AS INTEGER),
               TRY_CAST(p.overall_rating AS INTEGER),
               TRY_CAST(p.number_of_certified_beds AS INTEGER)
        FROM agg a
        JOIN read_parquet('{(PQ/"nh_provider_info.parquet").as_posix()}') p
          ON p.cms_certification_number_ccn = a.provnum
    """).fetchall()

    def r3(v):
        return None if v is None else round(float(v), 3)

    write("facilities.json", {
        "quarter": LOOKUP_QUARTER,
        "schema": ["ccn", "name", "city", "state", "mon", "tue", "wed", "thu",
                   "fri", "sat", "sun", "mean_hprd", "p10", "agency_share",
                   "staffing_star", "overall_star", "beds"],
        "rows": [[c, n, ct, st, *[r3(x) for x in wk], r3(mh), r3(p10), r3(ag),
                  sr, orr, bd]
                 for c, n, ct, st, *rest in rows
                 for wk, mh, p10, ag, sr, orr, bd in [(rest[:7], *rest[7:])]],
    })

    # ---- 6. the 188 -----------------------------------------------------
    flagged = con.execute(f"""
        WITH g AS (
          SELECT provnum,
                 AVG(CASE WHEN dayofweek(workdate) NOT IN (0,6) THEN hprd END) wd,
                 AVG(CASE WHEN dayofweek(workdate) IN (0,6) THEN hprd END) we,
                 AVG(hprd) mean_hprd, COUNT(*) n
          FROM day WHERE src_quarter = '{LOOKUP_QUARTER}' GROUP BY 1
        )
        SELECT g.provnum, p.provider_name, p.city_town, p.state,
               100*(g.wd-g.we)/g.wd AS gap, g.mean_hprd,
               TRY_CAST(p.staffing_rating AS INTEGER)
        FROM g JOIN read_parquet('{(PQ/"nh_provider_info.parquet").as_posix()}') p
          ON p.cms_certification_number_ccn = g.provnum
        WHERE g.n >= 56 AND g.wd > 0 AND g.mean_hprd >= 3.5
          AND 100*(g.wd-g.we)/g.wd >= 20
        ORDER BY gap DESC
    """).fetchall()
    write("flagged.json", {
        "criteria": {"mean_hprd_min": 3.5, "weekend_drop_min_pct": 20,
                     "quarter": LOOKUP_QUARTER},
        "schema": ["ccn", "name", "city", "state", "weekend_drop_pct",
                   "mean_hprd", "staffing_star"],
        "rows": [[c, n, ct, st, round(gp, 1), round(mh, 3), sr]
                 for c, n, ct, st, gp, mh, sr in flagged],
    })
    print(f"\nflagged facilities: {len(flagged)}")

    # keep the machine-readable results next to the site too
    for f in ("model_results.json", "diagnostics.json"):
        shutil.copy(ROOT / "analysis" / f, OUT / f)


if __name__ == "__main__":
    main()
