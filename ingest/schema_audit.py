"""Audit column-name drift across every published PBJ quarter.

CMS has renamed and re-cased columns several times since 2017. Loading these
files with a single hard-coded schema silently drops columns, so the drift is
mapped explicitly here and the map is committed.
"""
from __future__ import annotations

import csv
import io
import json
import sys
import urllib.request as u
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "sawtooth/0.1"}


def header_of(url: str) -> list[str]:
    """Fetch just enough bytes to read the header row."""
    req = u.Request(url, headers={**UA, "Range": "bytes=0-4000"})
    text = u.urlopen(req, timeout=90).read().decode("utf-8", "replace")
    first = text.splitlines()[0]
    return next(csv.reader(io.StringIO(first)))


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    man = json.loads((ROOT / "ingest" / "pbj_manifest.json").read_text(encoding="utf-8"))
    quarters = dict(man["quarters"])

    # 2qky-49qq.csv self-identifies as 2020Q3 in its cy_qtr column (verified).
    if man["unresolved"] and "2020Q3" not in quarters:
        quarters["2020Q3"] = man["unresolved"][0]

    headers: dict[str, list[str]] = {}
    for q in sorted(quarters):
        try:
            headers[q] = [c.strip().lower() for c in header_of(quarters[q])]
        except Exception as exc:  # noqa: BLE001 - report and continue
            print(f"  !! {q}: {type(exc).__name__}")

    # Which lowercase names appear, and in which quarters?
    seen: dict[str, list[str]] = defaultdict(list)
    for q, cols in headers.items():
        for c in cols:
            seen[c].append(q)

    universal = {c for c, qs in seen.items() if len(qs) == len(headers)}
    drifting = {c: qs for c, qs in seen.items() if len(qs) != len(headers)}

    print(f"quarters audited      : {len(headers)}")
    print(f"column count range    : {min(len(v) for v in headers.values())}"
          f"..{max(len(v) for v in headers.values())}")
    print(f"columns in all files  : {len(universal)}")
    print(f"columns that drift    : {len(drifting)}\n")
    for c, qs in sorted(drifting.items()):
        print(f"  {c:22s} present in {len(qs):2d}/{len(headers)}: {', '.join(sorted(qs))}")

    out = {
        "quarters_audited": len(headers),
        "universal_columns": sorted(universal),
        "drifting_columns": {c: sorted(qs) for c, qs in sorted(drifting.items())},
        "headers": {q: headers[q] for q in sorted(headers)},
        "quarters": dict(sorted(quarters.items())),
    }
    (ROOT / "ingest" / "pbj_schema_audit.json").write_text(
        json.dumps(out, indent=1), encoding="utf-8"
    )
    print(f"\nwrote ingest/pbj_schema_audit.json ({len(quarters)} quarters incl. recovered 2020Q3)")


if __name__ == "__main__":
    main()
