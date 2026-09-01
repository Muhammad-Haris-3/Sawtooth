"""Repair mixed-encoding PBJ CSVs into clean UTF-8.

CMS ships these files as cp1252, not UTF-8. In CY2026Q1 exactly two facilities
carry cp1252 punctuation in their names (0x92 right quote, 0x96 en dash),
which is enough to abort a strict CSV read of all 1.3M rows.

Decoding the whole file as latin-1 would suppress the error but turn those
bytes into control characters. Decoding as cp1252 unconditionally would
mojibake any genuine UTF-8 sequence elsewhere in the file. So each line is
tried as UTF-8 first and only falls back to cp1252 when that fails, and the
number of repaired lines is reported rather than swallowed.
"""
from __future__ import annotations

from pathlib import Path


def transcode(src: Path, dest: Path) -> dict:
    repaired = 0
    total = 0
    with src.open("rb") as fin, dest.open("wb") as fout:
        for raw in fin:
            total += 1
            try:
                raw.decode("utf-8")
            except UnicodeDecodeError:
                raw = raw.decode("cp1252").encode("utf-8")
                repaired += 1
            fout.write(raw)
    return {"lines": total, "repaired_lines": repaired}
