"use client";

import { useState } from "react";

type Props = {
  dow: Record<string, number>;
  weekday: number;
  weekend: number;
  gapPct: number;
};

const ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SHORT = ["MON","TUE","WED","THU","FRI","SAT","SUN"];

const W = 880;
const H = 340;
const M = { top: 30, right: 30, bottom: 46, left: 62 };

export default function Sawtooth({ dow, weekday, weekend, gapPct }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const vals = ORDER.map((d) => dow[d]);
  const lo = Math.min(...vals) - 0.09;
  const hi = Math.max(...vals) + 0.06;

  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (i: number) => M.left + (i * iw) / (ORDER.length - 1);
  const y = (v: number) => M.top + ih - ((v - lo) / (hi - lo)) * ih;

  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const area = `${line} L${x(6)},${M.top + ih} L${x(0)},${M.top + ih} Z`;
  const ticks = [lo + (hi - lo) * 0.1, lo + (hi - lo) * 0.4, lo + (hi - lo) * 0.7, hi];

  const peak = vals.indexOf(Math.max(...vals));
  const trough = vals.indexOf(Math.min(...vals));
  const boxX = hover == null ? 0 : Math.min(Math.max(x(hover) - 73, 8), W - 154);

  return (
    <figure className="panel" style={{ margin: 0, padding: "1.5rem" }}>
      <div className="scroll-x">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", minWidth: 560, height: "auto", display: "block" }}
          role="img"
          aria-label={`Nurse hours per resident day by day of week. ${ORDER[peak]} peaks at ${vals[peak].toFixed(3)}; ${ORDER[trough]} falls to ${vals[trough].toFixed(3)}, a ${gapPct.toFixed(1)} percent weekday-to-weekend gap.`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="stArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--s1)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--s1)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* weekend region — an annotation, not a series */}
          <rect x={x(4.5)} y={M.top} width={x(6) + M.right - x(4.5)} height={ih} fill="var(--s2)" opacity={0.055} />
          <text x={x(5.5)} y={M.top + 16} textAnchor="middle" className="mono" fontSize="10" letterSpacing="0.14em" fill="var(--s2-ink)" opacity={0.75}>
            WEEKEND
          </text>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
              <text x={M.left - 10} y={y(t) + 4} textAnchor="end" className="mono tnum" fontSize="11" fill="var(--ink-3)">
                {t.toFixed(2)}
              </text>
            </g>
          ))}

          <path className="area" d={area} fill="url(#stArea)" />
          <path
            className="draw"
            d={line}
            fill="none"
            stroke="var(--s1)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
          />

          {/* direct labels on the peak and the trough only */}
          <text x={x(peak)} y={y(vals[peak]) - 17} textAnchor="middle" className="mono tnum" fontSize="11" fill="var(--ink-2)">
            {vals[peak].toFixed(3)}
          </text>
          <text x={x(trough)} y={y(vals[trough]) + 24} textAnchor="end" className="mono tnum" fontSize="11" fill="var(--s2-ink)">
            {vals[trough].toFixed(3)}
          </text>

          {vals.map((v, i) => (
            <circle
              key={i}
              className="dot"
              cx={x(i)}
              cy={y(v)}
              r={i >= 5 ? 5.5 : 4.5}
              fill={i >= 5 ? "var(--s2)" : "var(--s1)"}
              stroke="var(--paper)"
              strokeWidth="2"
              // each dot lands as the line reaches it: 1400ms draw, 220ms head start
              style={{ animationDelay: `${220 + (i / 6) * 1180}ms` }}
            />
          ))}

          {SHORT.map((s, i) => (
            <text key={s} x={x(i)} y={H - 18} textAnchor="middle" className="mono" fontSize="11" fill={i >= 5 ? "var(--s2-ink)" : "var(--ink-3)"}>
              {s}
            </text>
          ))}

          {/* hit bands */}
          {vals.map((_, i) => (
            <rect
              key={`hit${i}`}
              x={x(i) - iw / 12}
              y={M.top}
              width={iw / 6}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}

          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} stroke="var(--line-strong)" strokeDasharray="3 4" />
              <circle cx={x(hover)} cy={y(vals[hover])} r={8} fill="none" stroke="var(--s1)" strokeOpacity={0.5} strokeWidth={1.5} />
              <rect x={boxX} y={M.top + 10} width={146} height={46} rx={6} fill="var(--paper)" stroke="var(--line-strong)" />
              <text x={boxX + 12} y={M.top + 29} className="mono" fontSize="11" letterSpacing="0.06em" fill="var(--ink-3)">
                {ORDER[hover].toUpperCase()}
              </text>
              <text x={boxX + 12} y={M.top + 46} className="mono tnum" fontSize="13" fill="var(--ink)">
                {vals[hover].toFixed(3)} HPRD
              </text>
            </g>
          )}
        </svg>
      </div>

      <figcaption
        style={{
          marginTop: "1.1rem",
          paddingTop: "1.1rem",
          borderTop: "1px solid var(--line)",
          display: "flex",
          gap: "2.5rem",
          flexWrap: "wrap",
          fontSize: "0.86rem",
          color: "var(--ink-2)",
        }}
      >
        <span>Weekday <strong className="mono tnum" style={{ color: "var(--ink)", fontWeight: 500 }}>{weekday.toFixed(3)}</strong></span>
        <span>Weekend <strong className="mono tnum" style={{ color: "var(--s2-ink)", fontWeight: 500 }}>{weekend.toFixed(3)}</strong></span>
        <span>Gap <strong className="mono tnum" style={{ color: "var(--ink)", fontWeight: 500 }}>{gapPct.toFixed(1)}%</strong></span>
        <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>hover the chart</span>
      </figcaption>
    </figure>
  );
}
