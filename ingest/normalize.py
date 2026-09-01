"""Normalize raw PBJ quarterly CSVs into one canonical Parquet dataset.

The published files drift in three ways: column case, column names, and one
quarter (2021Q4) carrying an extra `incomplete` flag that CMS never repeated.
Each quarter's select list is built from its own audited header so drift is
handled explicitly and a missing canonical column fails loudly rather than
silently becoming zero.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import duckdb

from transcode import transcode

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
INTERIM = ROOT / "data" / "interim"
PARQUET = ROOT / "data" / "parquet"

STAFF_BASES = (
    "rndon", "rnadmin", "rn",
    "lpnadmin", "lpn",
    "cna", "natrn", "medaide",
)

# Canonical name -> accepted source spellings, in priority order.
ALIASES: dict[str, tuple[str, ...]] = {
    "hrs_rndon": ("hrs_rndon", "hrs_rn_donadmin"),
    "hrs_lpnadmin": ("hrs_lpnadmin", "hrs_lpn_admin"),
    "hrs_natrn": ("hrs_natrn", "hrs_na_trn"),
}

ID_COLS = ("provnum", "provname", "city", "state", "county_name", "county_fips",
           "cy_qtr", "workdate", "mdscensus")

# Columns permitted to be absent in some vintages; they become NULL.
OPTIONAL = {"hrs_medaide_ctr", "incomplete"}


def canonical_columns() -> list[str]:
    cols = list(ID_COLS)
    for base in STAFF_BASES:
        cols += [f"hrs_{base}", f"hrs_{base}_emp", f"hrs_{base}_ctr"]
    cols.append("incomplete")
    return cols


def select_list(header: list[str]) -> list[str]:
    """Map this quarter's actual header onto the canonical schema."""
    present = {c.strip().lower(): c for c in header}
    parts: list[str] = []
    for canon in canonical_columns():
        source = None
        for cand in ALIASES.get(canon, (canon,)):
            if cand in present:
                source = present[cand]
                break
        if source is None:
            if canon not in OPTIONAL:
                raise KeyError(f"required column {canon!r} missing; header={sorted(present)}")
            parts.append(f"CAST(NULL AS DOUBLE) AS {canon}")
            continue

        quoted = '"' + source.replace('"', '""') + '"'
        if canon in ("provnum", "provname", "city", "state", "county_name",
                     "county_fips", "cy_qtr"):
            parts.append(f"CAST({quoted} AS VARCHAR) AS {canon}")
        elif canon == "workdate":
            parts.append(f"strptime(CAST({quoted} AS VARCHAR), '%Y%m%d')::DATE AS workdate")
        else:
            parts.append(f"TRY_CAST({quoted} AS DOUBLE) AS {canon}")
    return parts


def normalize(quarter: str, con: duckdb.DuckDBPyConnection, audit: dict) -> dict:
    src = RAW / f"pbj_{quarter}.csv"
    if not src.exists():
        raise FileNotFoundError(src)
    header = audit["headers"][quarter]
    cols = ",\n       ".join(select_list(header))

    # CMS ships these as cp1252; repair to UTF-8 before a strict read.
    INTERIM.mkdir(parents=True, exist_ok=True)
    clean = INTERIM / f"pbj_{quarter}.utf8.csv"
    enc = transcode(src, clean)

    PARQUET.mkdir(parents=True, exist_ok=True)
    dest = PARQUET / f"pbj_{quarter}.parquet"
    con.execute(f"""
        COPY (
            SELECT {cols},
                   '{quarter}' AS src_quarter
            FROM read_csv('{clean.as_posix()}', all_varchar=true,
                          header=true, sample_size=-1)
        ) TO '{dest.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)
    """)

    stats = con.execute(f"""
        SELECT COUNT(*)                                   AS rows,
               COUNT(DISTINCT provnum)                    AS facilities,
               MIN(workdate)                              AS first_day,
               MAX(workdate)                              AS last_day,
               SUM(CASE WHEN mdscensus IS NULL THEN 1 ELSE 0 END) AS null_census,
               SUM(CASE WHEN incomplete = 1 THEN 1 ELSE 0 END)    AS flagged_incomplete
        FROM read_parquet('{dest.as_posix()}')
    """).fetchone()

    clean.unlink(missing_ok=True)

    return {
        "quarter": quarter,
        "source_lines": enc["lines"],
        "encoding_repaired_lines": enc["repaired_lines"],
        "rows": stats[0], "facilities": stats[1],
        "first_day": str(stats[2]), "last_day": str(stats[3]),
        "null_census": stats[4], "flagged_incomplete": stats[5],
        "parquet_bytes": dest.stat().st_size,
        "csv_bytes": src.stat().st_size,
    }


def main(quarters: list[str]) -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    audit = json.loads((ROOT / "ingest" / "pbj_schema_audit.json").read_text(encoding="utf-8"))
    con = duckdb.connect()
    out = []
    for q in quarters:
        rec = normalize(q, con, audit)
        out.append(rec)
        print(f"  {q}: {rec['rows']:>9,} rows  {rec['facilities']:>6,} facilities  "
              f"{rec['first_day']}..{rec['last_day']}  "
              f"parquet {rec['parquet_bytes']/1e6:5.1f} MB "
              f"({rec['parquet_bytes']/rec['csv_bytes']:.1%} of csv)")

    log = ROOT / "data" / "normalize_log.json"
    prev = json.loads(log.read_text(encoding="utf-8")) if log.exists() else {}
    prev.update({r["quarter"]: r for r in out})
    log.write_text(json.dumps(prev, indent=1, sort_keys=True), encoding="utf-8")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        raise SystemExit("usage: normalize.py 2026Q1 [...]")
    main(args)
