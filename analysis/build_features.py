"""Build the modelling table: one row per facility standard survey.

Implements PREREGISTRATION.md v1.1 exactly:

  frame     union of provider_info rating cycle 1 and cycle 2 standard survey
            dates (not the citations file, which cannot supply zero-deficiency
            surveys)
  exposure  the two complete PBJ quarters whose last day falls strictly before
            the survey date
  baseline  mean_hprd, weekend_hprd, rn_hprd reconstructed from PBJ as-of that
            window, plus beds, ownership type, state
  challenger  baseline + low_day_freq, hprd_p10, hprd_cv, max_low_run,
            agency_share, agency_share_sd
  outcome   any scope-severity in {G,H,I,J,K,L} cited at that standard survey

No feature is inspected against the outcome here. This script only assembles
and counts.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
PARQUET = ROOT / "data" / "parquet"
DB = ROOT / "data" / "sawtooth.duckdb"

LOW_HPRD = 3.0          # pre-registered, not tuned
MIN_CENSUS = 5
MIN_DAYS = 60           # usable facility-days required in the exposure window
N_QUARTERS = 2
# The exposure window must be ADJACENT to the survey, not merely before it.
# A survey falling on the last day of a quarter sits ~92 days after the previous
# quarter ended, so 180 days is permissive; it exists to catch a missing quarter
# silently supplying a years-stale window.
MAX_STALENESS_DAYS = 180
SPLIT_DATE = "2024-07-01"
HARM = ("G", "H", "I", "J", "K", "L")


def build(con: duckdb.DuckDBPyConnection) -> None:
    pbj_glob = (PARQUET / "pbj_*.parquet").as_posix()
    harm_list = ", ".join(f"'{c}'" for c in HARM)

    con.execute(f"""
    CREATE OR REPLACE TABLE day AS
    SELECT provnum, state, src_quarter, workdate,
           mdscensus AS census,
           COALESCE(hrs_rn,0)+COALESCE(hrs_lpn,0)+COALESCE(hrs_cna,0)             AS nurse_hrs,
           COALESCE(hrs_rn_ctr,0)+COALESCE(hrs_lpn_ctr,0)+COALESCE(hrs_cna_ctr,0) AS ctr_hrs,
           COALESCE(hrs_rn,0)                                                     AS rn_hrs
    FROM read_parquet('{pbj_glob}')
    WHERE mdscensus >= {MIN_CENSUS}
      AND COALESCE(hrs_rn,0)+COALESCE(hrs_lpn,0)+COALESCE(hrs_cna,0) > 0;

    ALTER TABLE day ADD COLUMN hprd DOUBLE;
    UPDATE day SET hprd = nurse_hrs / census;

    CREATE OR REPLACE TABLE qcal AS
    SELECT src_quarter AS q, MIN(workdate) AS q_start, MAX(workdate) AS q_end
    FROM day GROUP BY 1;
    """)

    # ---- survey universe -------------------------------------------------
    con.execute(f"""
    CREATE OR REPLACE TABLE survey AS
    WITH p AS (SELECT * FROM read_parquet('{(PARQUET/"nh_provider_info.parquet").as_posix()}')),
    u AS (
      SELECT cms_certification_number_ccn AS ccn,
             TRY_CAST(rating_cycle_1_standard_survey_health_date AS DATE) AS survey_date,
             1 AS cycle
      FROM p
      UNION
      SELECT cms_certification_number_ccn,
             TRY_CAST(rating_cycle_2_standard_health_survey_date AS DATE),
             2
      FROM p
    )
    SELECT DISTINCT u.ccn, u.survey_date, u.cycle,
           TRY_CAST(p.number_of_certified_beds AS INTEGER) AS beds,
           p.ownership_type,
           p.staffing_rating
    FROM u JOIN p ON p.cms_certification_number_ccn = u.ccn
    WHERE u.survey_date IS NOT NULL;
    """)

    # ---- exposure window: two quarters ending strictly before the survey --
    con.execute(f"""
    CREATE OR REPLACE TABLE expo AS
    SELECT ccn, survey_date, q, q_end
    FROM (
      SELECT s.ccn, s.survey_date, c.q, c.q_end,
             ROW_NUMBER() OVER (PARTITION BY s.ccn, s.survey_date
                                ORDER BY c.q_end DESC) AS rk
      FROM survey s
      JOIN qcal c ON c.q_end < s.survey_date
    ) WHERE rk <= {N_QUARTERS};
    """)

    # Leakage guard: no exposure quarter may end on or after its survey date.
    bad = con.execute(
        "SELECT COUNT(*) FROM expo WHERE q_end >= survey_date").fetchone()[0]
    if bad:
        raise AssertionError(f"leakage guard failed: {bad} exposure quarters end on/after survey")

    # Staleness guard: drop surveys whose window is not adjacent to them. Without
    # this, a gap in the panel silently substitutes a years-old exposure window.
    con.execute(f"""
    CREATE OR REPLACE TABLE expo AS
    SELECT e.* FROM expo e
    JOIN (
      SELECT ccn, survey_date, MAX(q_end) AS newest
      FROM expo GROUP BY 1,2
    ) g ON g.ccn = e.ccn AND g.survey_date = e.survey_date
    WHERE date_diff('day', g.newest, e.survey_date) <= {MAX_STALENESS_DAYS};
    """)
    stale = con.execute("""
        SELECT COUNT(*) FROM (
            SELECT DISTINCT ccn, survey_date FROM survey
            EXCEPT
            SELECT DISTINCT ccn, survey_date FROM expo
        )
    """).fetchone()[0]
    print(f"surveys dropped for stale/absent exposure window: {stale:,}")

    # ---- daily rows inside each survey's window --------------------------
    con.execute(f"""
    CREATE OR REPLACE TABLE win AS
    SELECT e.ccn, e.survey_date, d.workdate, d.state,
           d.hprd, d.nurse_hrs, d.ctr_hrs, d.rn_hrs, d.census,
           CASE WHEN d.hprd < {LOW_HPRD} THEN 1 ELSE 0 END AS is_low
    FROM expo e
    JOIN day d ON d.provnum = e.ccn AND d.src_quarter = e.q;
    """)

    # ---- longest consecutive run of low days (gaps and islands) ----------
    con.execute("""
    CREATE OR REPLACE TABLE runs AS
    SELECT ccn, survey_date, MAX(run_len) AS max_low_run
    FROM (
      SELECT ccn, survey_date, grp, COUNT(*) AS run_len
      FROM (
        SELECT ccn, survey_date, workdate, is_low,
               ROW_NUMBER() OVER (PARTITION BY ccn, survey_date ORDER BY workdate)
             - ROW_NUMBER() OVER (PARTITION BY ccn, survey_date, is_low ORDER BY workdate)
               AS grp
        FROM win
      )
      WHERE is_low = 1
      GROUP BY 1,2,3
    )
    GROUP BY 1,2;
    """)

    # ---- features --------------------------------------------------------
    con.execute(f"""
    CREATE OR REPLACE TABLE feat AS
    SELECT w.ccn, w.survey_date,
           COUNT(*)                                              AS n_days,
           ANY_VALUE(w.state)                                    AS state,
           -- baseline (as-of, reconstructed from PBJ)
           AVG(w.hprd)                                           AS mean_hprd,
           AVG(CASE WHEN dayofweek(w.workdate) IN (0,6) THEN w.hprd END) AS weekend_hprd,
           SUM(w.rn_hrs)/SUM(w.census)                           AS rn_hprd,
           -- challenger: shape of the daily distribution
           AVG(w.is_low)                                         AS low_day_freq,
           quantile_cont(w.hprd, 0.10)                           AS hprd_p10,
           STDDEV_SAMP(w.hprd)/NULLIF(AVG(w.hprd),0)             AS hprd_cv,
           SUM(w.ctr_hrs)/NULLIF(SUM(w.nurse_hrs),0)             AS agency_share,
           STDDEV_SAMP(w.ctr_hrs/NULLIF(w.nurse_hrs,0))          AS agency_share_sd
    FROM win w
    GROUP BY 1,2
    HAVING COUNT(*) >= {MIN_DAYS};
    """)

    # ---- outcome ---------------------------------------------------------
    con.execute(f"""
    CREATE OR REPLACE TABLE outcome AS
    SELECT cms_certification_number_ccn AS ccn,
           TRY_CAST(survey_date AS DATE) AS survey_date,
           MAX(CASE WHEN scope_severity_code IN ({harm_list}) THEN 1 ELSE 0 END) AS harm,
           COUNT(*) AS n_citations
    FROM read_parquet('{(PARQUET/"nh_deficiencies.parquet").as_posix()}')
    WHERE standard_deficiency = 'Y'
    GROUP BY 1,2;
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE model_table AS
    SELECT f.*, s.cycle, s.beds, s.ownership_type, s.staffing_rating,
           COALESCE(o.harm, 0)        AS harm,
           COALESCE(o.n_citations, 0) AS n_citations,
           CASE WHEN f.survey_date < DATE '{SPLIT_DATE}' THEN 'train' ELSE 'test' END AS split
    FROM feat f
    JOIN survey s ON s.ccn = f.ccn AND s.survey_date = f.survey_date
    LEFT JOIN outcome o ON o.ccn = f.ccn AND o.survey_date = f.survey_date
    WHERE s.staffing_rating IS NOT NULL AND s.staffing_rating <> '';
    """)


def report(con: duckdb.DuckDBPyConnection) -> dict:
    def one(sql):
        return con.execute(sql).fetchone()

    n_surv = one("SELECT COUNT(*) FROM survey")[0]
    n_feat = one("SELECT COUNT(*) FROM feat")[0]
    n_tab = one("SELECT COUNT(*) FROM model_table")[0]
    print(f"survey universe                {n_surv:>8,}")
    print(f"  with a usable exposure window {n_feat:>8,}")
    print(f"  final model table             {n_tab:>8,}")

    rows = con.execute("""
        SELECT split, COUNT(*) n, SUM(harm) pos, AVG(harm) rate,
               MIN(survey_date) lo, MAX(survey_date) hi
        FROM model_table GROUP BY 1 ORDER BY 1
    """).fetchall()
    print(f"\n{'split':<7}{'surveys':>9}{'harm':>8}{'rate':>8}   window")
    out = {}
    for sp, n, pos, rate, lo, hi in rows:
        print(f"{sp:<7}{n:>9,}{pos:>8,}{rate:>8.1%}   {lo} .. {hi}")
        out[sp] = {"surveys": n, "positive": int(pos), "rate": rate,
                   "from": str(lo), "to": str(hi)}

    te = out.get("test", {})
    ok = te.get("surveys", 0) >= 2000 and te.get("positive", 0) >= 500
    print(f"\npower floor (>=2,000 test surveys and >=500 positive): "
          f"{'MET' if ok else 'NOT MET -> result withheld'}")

    miss = con.execute("""
        SELECT
          SUM(CASE WHEN mean_hprd IS NULL THEN 1 ELSE 0 END),
          SUM(CASE WHEN weekend_hprd IS NULL THEN 1 ELSE 0 END),
          SUM(CASE WHEN hprd_cv IS NULL THEN 1 ELSE 0 END),
          SUM(CASE WHEN agency_share IS NULL THEN 1 ELSE 0 END),
          SUM(CASE WHEN beds IS NULL THEN 1 ELSE 0 END)
        FROM model_table
    """).fetchone()
    print("\nnulls  mean_hprd %d | weekend_hprd %d | hprd_cv %d | agency_share %d | beds %d"
          % miss)

    return {"survey_universe": n_surv, "with_window": n_feat,
            "model_table": n_tab, "splits": out, "power_floor_met": ok}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    built = sorted(PARQUET.glob("pbj_*.parquet"))
    print(f"PBJ quarters available: {len(built)}"
          f" ({built[0].stem[-6:]} .. {built[-1].stem[-6:]})\n")

    con = duckdb.connect(str(DB))
    con.execute("PRAGMA memory_limit='3GB'")
    build(con)

    # max_low_run joined separately so a facility with no low days gets 0
    con.execute("""
        CREATE OR REPLACE TABLE model_table AS
        SELECT m.*, COALESCE(r.max_low_run, 0) AS max_low_run
        FROM model_table m
        LEFT JOIN runs r ON r.ccn = m.ccn AND r.survey_date = m.survey_date;
    """)

    stats = report(con)
    con.execute(f"""COPY (SELECT * FROM model_table)
                    TO '{(ROOT/"analysis"/"model_table.parquet").as_posix()}'
                    (FORMAT PARQUET, COMPRESSION ZSTD)""")
    (ROOT / "analysis" / "feature_build_log.json").write_text(
        json.dumps({"quarters_used": len(built), **stats}, indent=1), encoding="utf-8")
    print("\nwrote analysis/model_table.parquet")


if __name__ == "__main__":
    main()
