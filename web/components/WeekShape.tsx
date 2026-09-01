"use client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WeekShape({
  values,
  width = 168,
  height = 46,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
}) {
  const vals = values.map((v) => (v == null ? NaN : v));
  const ok = vals.filter((v) => !Number.isNaN(v));
  if (!ok.length) return null;
  const lo = Math.min(...ok) * 0.94;
  const hi = Math.max(...ok) * 1.03;
  const pad = 4;
  const x = (i: number) => pad + (i * (width - pad * 2)) / 6;
  const y = (v: number) =>
    height - pad - ((v - lo) / Math.max(hi - lo, 1e-6)) * (height - pad * 2);

  const d = vals
    .map((v, i) => (Number.isNaN(v) ? "" : `${i ? "L" : "M"}${x(i)},${y(v)}`))
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      role="img"
      aria-label={DAYS.map((d2, i) => `${d2} ${Number.isNaN(vals[i]) ? "n/a" : vals[i].toFixed(2)}`).join(", ")}
    >
      <rect x={x(4.5)} y={0} width={width - x(4.5)} height={height} fill="var(--s2)" opacity={0.07} />
      <path d={d} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v, i) =>
        Number.isNaN(v) ? null : (
          <circle key={i} cx={x(i)} cy={y(v)} r={i >= 5 ? 2.8 : 2} fill={i >= 5 ? "var(--s2)" : "var(--s1)"} />
        )
      )}
    </svg>
  );
}
