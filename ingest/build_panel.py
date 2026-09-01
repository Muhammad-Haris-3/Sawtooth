"""Download, normalize and discard each PBJ quarter in turn.

Holding all 37 raw CSVs would cost ~8.7 GB. Each quarter is fetched, hashed,
converted to Parquet and then the raw CSV is removed, so peak disk stays near
one quarter plus the growing Parquet set (~1.2 GB total).

Resumable: quarters already present as Parquet are skipped, and the fetch
manifest keeps the sha256 of what was actually downloaded even though the CSV
no longer exists locally.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))

from download import fetch, load_manifest, save_manifest  # noqa: E402
from normalize import normalize  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PARQUET = ROOT / "data" / "parquet"


def main(keep_raw: bool = False) -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    audit = json.loads((ROOT / "ingest" / "pbj_schema_audit.json").read_text(encoding="utf-8"))
    quarters = sorted(audit["quarters"])
    man = load_manifest()
    con = duckdb.connect()

    log_path = ROOT / "data" / "normalize_log.json"
    log = json.loads(log_path.read_text(encoding="utf-8")) if log_path.exists() else {}

    started = time.time()
    for i, q in enumerate(quarters, 1):
        pq = PARQUET / f"pbj_{q}.parquet"
        if pq.exists() and q in log:
            print(f"[{i:2d}/{len(quarters)}] {q} already built, skipping", flush=True)
            continue
        try:
            man[q] = fetch(q, audit["quarters"][q], man)
            save_manifest(man)
            rec = normalize(q, con, audit)
            log[q] = rec
            log_path.write_text(json.dumps(log, indent=1, sort_keys=True), encoding="utf-8")
            if not keep_raw:
                (RAW / f"pbj_{q}.csv").unlink(missing_ok=True)
            print(f"[{i:2d}/{len(quarters)}] {q}: {rec['rows']:>9,} rows  "
                  f"{rec['facilities']:>6,} fac  "
                  f"repaired {rec['encoding_repaired_lines']:>4,}  "
                  f"parquet {rec['parquet_bytes']/1e6:5.1f} MB", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"[{i:2d}/{len(quarters)}] !! {q}: {type(exc).__name__}: {exc}", flush=True)

    total_rows = sum(r["rows"] for r in log.values())
    total_pq = sum(r["parquet_bytes"] for r in log.values())
    print(f"\npanel: {len(log)} quarters, {total_rows:,} facility-days, "
          f"{total_pq/1e9:.2f} GB parquet, {(time.time()-started)/60:.1f} min")


if __name__ == "__main__":
    main(keep_raw="--keep-raw" in sys.argv)
