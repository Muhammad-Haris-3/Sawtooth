"""Build a clean quarter -> URL manifest for the CMS PBJ daily nurse staffing files.

CMS has published these under three different naming conventions since 2017.
The catalogue does not carry a quarter field, so the quarter has to be recovered
from the file name, and one era encodes it nowhere at all.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request as u
from pathlib import Path

CATALOG = "https://data.cms.gov/data.json"
TITLE = "Payroll Based Journal Daily Nurse Staffing"
ROOT = Path(__file__).resolve().parent.parent

# Three observed naming conventions, newest first.
PATTERNS = (
    re.compile(r"PBJ_dailynursestaffing_CY(\d{4})Q(\d)\.csv$", re.I),
    re.compile(r"pbj_daily_nurse_staffing_cy_(\d{4})q(\d)\.csv$", re.I),
    re.compile(r"PBJ_Nurse_(?:Q(\d)_(\d{4})|(\d{4})_Q(\d))_", re.I),
)


def quarter_from_url(url: str) -> str | None:
    name = url.rsplit("/", 1)[-1]
    for i, pat in enumerate(PATTERNS):
        m = pat.search(name)
        if not m:
            continue
        if i < 2:
            year, q = m.group(1), m.group(2)
        else:
            # Either Q<q>_<year> or <year>_Q<q> depending on the vintage.
            year, q = (m.group(2), m.group(1)) if m.group(1) else (m.group(3), m.group(4))
        return f"{year}Q{q}"
    return None


def fetch_manifest() -> dict:
    with u.urlopen(CATALOG, timeout=90) as r:
        cat = json.loads(r.read())
    ds = next(x for x in cat["dataset"] if x.get("title") == TITLE)

    resolved: dict[str, str] = {}
    unresolved: list[str] = []
    for dist in ds.get("distribution") or []:
        url = dist.get("downloadURL") or ""
        if not url.lower().endswith(".csv"):
            continue
        q = quarter_from_url(url)
        if q:
            resolved[q] = url
        else:
            unresolved.append(url)

    return {
        "source_title": TITLE,
        "catalog_modified": ds.get("modified"),
        "quarters": dict(sorted(resolved.items())),
        "unresolved": unresolved,
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    man = fetch_manifest()
    out = ROOT / "ingest" / "pbj_manifest.json"
    out.write_text(json.dumps(man, indent=1), encoding="utf-8")

    qs = list(man["quarters"])
    print(f"resolved quarters : {len(qs)}  ({qs[0]} .. {qs[-1]})")
    print(f"unresolved files  : {len(man['unresolved'])}")
    for url in man["unresolved"]:
        print("   ", url.rsplit("/", 1)[-1])

    # Report gaps in the quarterly sequence.
    years = sorted({int(q[:4]) for q in qs})
    expected = [f"{y}Q{n}" for y in range(years[0], years[-1] + 1) for n in (1, 2, 3, 4)]
    expected = [q for q in expected if q >= qs[0] and q <= qs[-1]]
    missing = [q for q in expected if q not in man["quarters"]]
    print(f"gaps in sequence  : {len(missing)}  {missing}")
