"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WeekShape from "./WeekShape";

type Row = (string | number | null)[];

const IDX = {
  ccn: 0, name: 1, city: 2, state: 3,
  mon: 4, tue: 5, wed: 6, thu: 7, fri: 8, sat: 9, sun: 10,
  mean: 11, p10: 12, agency: 13, star: 14, overall: 15, beds: 16,
};

export default function FacilitySearch() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  // 1.8 MB of facility summaries — fetched only when someone actually searches.
  useEffect(() => {
    if (!q.trim() || started.current) return;
    started.current = true;
    setLoading(true);
    fetch("/data/facilities.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setRows(d.rows as Row[]))
      .catch((e) => setErr(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [q]);

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !rows) return [];
    const out: Row[] = [];
    for (const r of rows) {
      const hay = `${r[IDX.name]} ${r[IDX.city]} ${r[IDX.state]} ${r[IDX.ccn]}`.toLowerCase();
      if (hay.includes(s)) {
        out.push(r);
        if (out.length >= 40) break;
      }
    }
    return out;
  }, [q, rows]);

  const gap = (r: Row) => {
    const wd = [4, 5, 6, 7, 8].map((i) => r[i] as number).filter((v) => v != null);
    const we = [9, 10].map((i) => r[i] as number).filter((v) => v != null);
    if (!wd.length || !we.length) return null;
    const a = wd.reduce((x, y) => x + y, 0) / wd.length;
    const b = we.reduce((x, y) => x + y, 0) / we.length;
    return a > 0 ? (100 * (a - b)) / a : null;
  };

  return (
    <div className="panel" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <span className="label">Search 14,000+ facilities by name, city, state or CCN</span>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Sequoias, or Jackson, or MS"
        />
      </label>

      {/* Skeleton, not a sentence: 1.8 MB arrives late and the layout
          must not jump when it does. */}
      {loading && (
        <div className="fade" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="label">Loading 14,000 facilities…</span>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="shimmer"
              style={{ height: 44, borderRadius: 5, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      )}

      {err && (
        <p style={{ color: "var(--critical)", margin: 0 }}>
          Could not load facility data ({err}). Try reloading the page.
        </p>
      )}

      {q.trim() && rows && hits.length === 0 && !loading && (
        <p style={{ color: "var(--ink-2)", margin: 0 }}>
          No facility matches &ldquo;{q}&rdquo;. Try a shorter search, or a state code.
        </p>
      )}

      {hits.length > 0 && (
        <div className="scroll-x" style={{ border: "1px solid var(--line)", borderRadius: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Facility</th>
                <th>Week shape</th>
                <th className="mono">Mean</th>
                <th className="mono">Floor</th>
                <th className="mono">Wknd drop</th>
                <th className="mono">Star</th>
              </tr>
            </thead>
            <tbody>
              {hits.map((r, i) => {
                const g = gap(r);
                return (
                  // key includes the query so a new search yields new nodes —
                  // otherwise React reuses rows and the stagger only ever
                  // plays on the first search.
                  <tr
                    key={`${q}:${r[IDX.ccn]}`}
                    className="rise-tight"
                    style={{ ["--i" as string]: i }}
                  >
                    <td>
                      <div style={{ fontWeight: 500 }}>{r[IDX.name]}</div>
                      <div className="mono" style={{ color: "var(--ink-3)", fontSize: "0.78rem" }}>
                        {r[IDX.city]}, {r[IDX.state]} · {r[IDX.ccn]}
                      </div>
                    </td>
                    <td>
                      <WeekShape values={[4, 5, 6, 7, 8, 9, 10].map((j) => r[j] as number | null)} />
                    </td>
                    <td className="mono tnum">{(r[IDX.mean] as number)?.toFixed(2) ?? "—"}</td>
                    <td className="mono tnum">{(r[IDX.p10] as number)?.toFixed(2) ?? "—"}</td>
                    <td
                      className="mono tnum"
                      style={{
                        color: g != null && g >= 20 ? "var(--critical)" : "var(--ink)",
                        fontWeight: g != null && g >= 20 ? 600 : 400,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {g == null ? "—" : `${g.toFixed(1)}%`}
                    </td>
                    <td className="mono tnum" style={{ color: "var(--s2-ink)" }}>{r[IDX.star] ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hits.length >= 40 && (
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "0.8rem" }}>
          Showing the first 40 matches. Narrow the search to see more.
        </p>
      )}
    </div>
  );
}
