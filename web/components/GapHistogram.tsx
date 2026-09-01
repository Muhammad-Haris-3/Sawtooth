"use client";

type Props = {
  bins: [number, number][];
  median: number;
  nDrop20: number;
  nTotal: number;
};

/** Reads gap_hist.json. Bars at or beyond the 20% criterion are amber —
 *  the same threshold the flagged list uses, shown as a distribution. */
export default function GapHistogram({ bins, median, nDrop20, nTotal }: Props) {
  const max = Math.max(...bins.map((b) => b[1]));

  return (
    <figure className="panel" style={{ margin: 0, padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", marginBottom: "1.25rem" }}>
        <span className="label">Distribution of weekend drop</span>
        <span className="mono" style={{ fontSize: "0.72rem", color: "var(--ink-3)" }}>
          {nTotal.toLocaleString()} facilities
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 130 }}>
        {bins.map(([edge, n], i) => {
          const flagged = edge >= 20;
          const h = Math.max((n / max) * 120, 3);
          return (
            <div
              key={edge}
              className="bar-y"
              title={`${edge}% · ${n.toLocaleString()}`}
              style={{
                flex: 1,
                height: h,
                borderRadius: "2px 2px 0 0",
                background: flagged
                  ? "var(--s2)"
                  : `color-mix(in oklab, var(--s1) ${55 + Math.round((n / max) * 45)}%, transparent)`,
                animationDelay: `${60 + i * 30}ms`,
              }}
            />
          );
        })}
      </div>

      <div className="mono" style={{ display: "flex", justifyContent: "space-between", marginTop: "0.6rem", fontSize: "0.7rem", color: "var(--ink-3)" }}>
        <span>{bins[0][0]}%</span>
        <span>0</span>
        <span>median {median.toFixed(1)}%</span>
        <span style={{ color: "var(--s2)" }}>20% and worse — {nDrop20.toLocaleString()}</span>
        <span>{bins[bins.length - 1][0]}%</span>
      </div>
    </figure>
  );
}
