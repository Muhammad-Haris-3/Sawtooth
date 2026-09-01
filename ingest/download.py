"""Download PBJ quarterly files and record an immutable fetch manifest.

Every file is hashed on arrival. Re-running skips files whose hash already
matches, so the download is resumable and the manifest is the record of what
was actually fetched rather than what was requested.
"""
from __future__ import annotations

import hashlib
import json
import sys
import time
import urllib.request as u
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
MANIFEST = ROOT / "data" / "fetch_manifest.json"
UA = {"User-Agent": "sawtooth/0.1 (portfolio research)"}
CHUNK = 1 << 20


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {}


def save_manifest(man: dict) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(man, indent=1, sort_keys=True), encoding="utf-8")


def fetch(quarter: str, url: str, man: dict) -> dict:
    RAW.mkdir(parents=True, exist_ok=True)
    dest = RAW / f"pbj_{quarter}.csv"

    if dest.exists() and quarter in man and man[quarter].get("bytes") == dest.stat().st_size:
        return man[quarter]

    started = time.time()
    h = hashlib.sha256()
    total = 0
    tmp = dest.with_suffix(".part")
    with u.urlopen(u.Request(url, headers=UA), timeout=600) as r, tmp.open("wb") as f:
        while True:
            block = r.read(CHUNK)
            if not block:
                break
            f.write(block)
            h.update(block)
            total += len(block)
            if total % (32 << 20) < CHUNK:
                print(f"    {quarter}: {total/1e6:,.0f} MB", flush=True)
    tmp.replace(dest)

    return {
        "url": url,
        "bytes": total,
        "sha256": h.hexdigest(),
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "seconds": round(time.time() - started, 1),
    }


def main(quarters: list[str]) -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    audit = json.loads((ROOT / "ingest" / "pbj_schema_audit.json").read_text(encoding="utf-8"))
    available = audit["quarters"]
    man = load_manifest()

    for q in quarters:
        if q not in available:
            print(f"  !! {q} not in manifest")
            continue
        print(f"  {q} ...", flush=True)
        try:
            man[q] = fetch(q, available[q], man)
            save_manifest(man)
            rec = man[q]
            print(f"  {q}: {rec['bytes']/1e6:,.1f} MB  sha {rec['sha256'][:12]}  "
                  f"{rec.get('seconds', 0)}s", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"  !! {q}: {type(exc).__name__}: {exc}")

    total = sum(v["bytes"] for v in man.values())
    print(f"\nheld locally: {len(man)} quarters, {total/1e9:.2f} GB")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        raise SystemExit("usage: download.py 2026Q1 [2025Q4 ...]")
    main(args)
