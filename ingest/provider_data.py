"""Fetch the CMS Provider Data Catalog nursing-home tables.

These are the outcome and covariate side of the project: inspection citations
with severity, monetary penalties, facility characteristics and star ratings,
and ownership. All key on the CMS Certification Number, which is PBJ's
PROVNUM, so no fuzzy matching is needed anywhere.
"""
from __future__ import annotations

import hashlib
import json
import sys
import time
import urllib.request as u
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PARQUET = ROOT / "data" / "parquet"
UA = {"User-Agent": "sawtooth/0.1 (portfolio research)"}

CATALOG = "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items"
DATASETS = {
    "deficiencies": "r5ix-sfxw",
    "penalties": "g6vv-u9sr",
    "provider_info": "4pq5-n9py",
    "ownership": "y2hd-n93e",
}


def resolve(ident: str) -> str:
    with u.urlopen(u.Request(f"{CATALOG}/{ident}?show-reference-ids=true",
                             headers=UA), timeout=90) as r:
        meta = json.loads(r.read())
    for dist in meta.get("distribution") or []:
        d = dist.get("data") or dist
        url = d.get("downloadURL") or d.get("accessURL")
        if url and url.lower().endswith(".csv"):
            return url
    raise LookupError(f"no CSV distribution for {ident}")


def snake(name: str) -> str:
    out = []
    for ch in name.strip().lower():
        out.append(ch if ch.isalnum() else "_")
    s = "".join(out)
    while "__" in s:
        s = s.replace("__", "_")
    return s.strip("_")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    RAW.mkdir(parents=True, exist_ok=True)
    PARQUET.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    manifest = {}

    for name, ident in DATASETS.items():
        url = resolve(ident)
        dest = RAW / f"nh_{name}.csv"
        h = hashlib.sha256()
        total = 0
        with u.urlopen(u.Request(url, headers=UA), timeout=600) as r, dest.open("wb") as f:
            while (block := r.read(1 << 20)):
                f.write(block)
                h.update(block)
                total += len(block)

        # Same cp1252 hazard as PBJ.
        clean = dest.with_suffix(".utf8.csv")
        repaired = 0
        with dest.open("rb") as fin, clean.open("wb") as fout:
            for line in fin:
                try:
                    line.decode("utf-8")
                except UnicodeDecodeError:
                    line = line.decode("cp1252").encode("utf-8")
                    repaired += 1
                fout.write(line)

        cols = con.execute(
            f"SELECT * FROM read_csv('{clean.as_posix()}', all_varchar=true, "
            f"header=true, sample_size=1000) LIMIT 0"
        ).description
        sel = ", ".join(
            f'"{c[0]}" AS {snake(c[0])}' for c in cols
        )
        pq = PARQUET / f"nh_{name}.parquet"
        con.execute(f"""
            COPY (SELECT {sel}
                  FROM read_csv('{clean.as_posix()}', all_varchar=true,
                                header=true, sample_size=-1))
            TO '{pq.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)
        """)
        clean.unlink(missing_ok=True)

        n, ccn = con.execute(
            f"SELECT COUNT(*), COUNT(DISTINCT cms_certification_number_ccn) "
            f"FROM read_parquet('{pq.as_posix()}')"
        ).fetchone()

        manifest[name] = {
            "url": url, "bytes": total, "sha256": h.hexdigest(),
            "rows": n, "distinct_ccn": ccn, "columns": len(cols),
            "encoding_repaired_lines": repaired,
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        print(f"  {name:14s} {n:>9,} rows  {ccn:>6,} facilities  "
              f"{len(cols):2d} cols  {total/1e6:6.1f} MB  repaired {repaired}")

    (ROOT / "data" / "provider_manifest.json").write_text(
        json.dumps(manifest, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
