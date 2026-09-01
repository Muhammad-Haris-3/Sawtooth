"use client";

import { useState } from "react";

type Props = {
  dow: Record<string, number>;
  weekday: number;
  weekend: number;
  gapPct: number;
};

const ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const W = 760;
const H = 300;
const M = { top: 26, right: 22, bottom: 40, left: 52 };

export default function Sawtooth({ dow, weekday, weekend, gapPct }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const vals = ORDER.map((d) => dow[d]);
  const lo = Math.min(...vals) - 0.09;
  const hi = Math.max(...vals) + 0.06;

  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (i: number) => M.left + (i * iw) / (ORDER.length - 1);
  const y = (v: number) => M.top + ih - ((v - lo) / (hi - lo)) * ih;

  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v * 100) / 100);
  const path = vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");

  return (
    <figure style={{ margin: 0 }}>
      <div className="scroll-x">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", minWidth: 520, height: "auto", display: "block" }}
          role="img"
          aria-label={`Nurse hours per resident day by day of week. Wednesday peaks at ${vals[2].toFixed(
            3
          )}; Sunday falls to ${vals[6].toFixed(3)}, a ${gapPct.toFixed(
            1
          )} percent weekday-to-weekend gap.`}
          onMouseLeave={() => setHover(null)}
        >
          {/* weekend region — an annotation, not a series */}
          <rect
            x={x(4.5)}
            y={M.top}
            width={x(6) + M.right - x(4.5)}
            height={ih}
            fill="var(--critical)"
            opacity={0.06}
          />
          <text
            x={x(5.5)}
            y={M.top + 14}
            textAnchor="middle"
            className="mono"
            fontSize="10"
            fill="var(--ink-3)"
            letterSpacing="0.1em"
          >
            WEEKEND
          </text>

          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                x2={W - M.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--grid)"
                strokeWidth="1"
              />
              <text
                x={M.left - 10}
                y={y(t) + 4}
                textAnchor="end"
                className="mono tnum"
                fontSize="11"
                fill="var(--ink-3)"
              >
                {t.toFixed(2)}
              </text>
            </g>
          ))}

          <path
            d={path}
            fill="none"
            stroke="var(--s1)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {vals.map((v, i) => (
            <g key={i}>
              <circle
                cx={x(i)}
                cy={y(v)}
                r={hover === i ? 7 : 5}
                fill={i >= 5 ? "var(--s2)" : "var(--s1)"}
                stroke="var(--surface)"
                strokeWidth="2"
              />
              <rect
                x={x(i) - iw / 14}
                y={M.top}
                width={iw / 7}
                height={ih}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          ))}

          {/* direct labels on the peak and the trough only */}
          <text
            x={x(2)}
            y={y(vals[2]) - 14}
            textAnchor="middle"
            className="mono tnum"
            fontSize="11"
            fill="var(--ink-2)"
          >
            {vals[2].toFixed(3)}
          </text>
          <text
            x={x(6)}
            y={y(vals[6]) + 22}
            textAnchor="middle"
            className="mono tnum"
            fontSize="11"
            fill="var(--ink-2)"
          >
            {vals[6].toFixed(3)}
          </text>

          {SHORT.map((s, i) => (
            <text
              key={s}
              x={x(i)}
              y={H - 14}
              textAnchor="middle"
              className="mono"
              fontSize="11"
              fill={i >= 5 ? "var(--s2)" : "var(--ink-3)"}
            >
              {s.toUpperCase()}
            </text>
          ))}

          {hover !== null && (
            <g pointerEvents="none">
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={M.top}
                y2={M.top + ih}
                stroke="var(--rule-hard)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <rect
                x={Math.min(Math.max(x(hover) - 62, 2), W - 126)}
                y={M.top + 4}
                width={124}
                height={38}
                rx={3}
                fill="var(--surface)"
                stroke="var(--rule-hard)"
              />
              <text
                x={Math.min(Math.max(x(hover) - 62, 2), W - 126) + 10}
                y={M.top + 20}
                fontSize="11"
                fill="var(--ink-2)"
                className="mono"
              >
                {ORDER[hover]}
              </text>
              <text
                x={Math.min(Math.max(x(hover) - 62, 2), W - 126) + 10}
                y={M.top + 35}
                fontSize="12"
                fill="var(--ink)"
                className="mono tnum"
              >
                {vals[hover].toFixed(3)} HPRD
              </text>
            </g>
          )}
        </svg>
      </div>
      <figcaption
        style={{
          marginTop: "0.75rem",
          fontSize: "0.85rem",
          color: "var(--ink-2)",
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <span>
          Weekday <strong className="tnum">{weekday.toFixed(3)}</strong>
        </span>
        <span>
          Weekend <strong className="tnum">{weekend.toFixed(3)}</strong>
        </span>
        <span>
          Gap <strong className="tnum">{gapPct.toFixed(1)}%</strong>
        </span>
      </figcaption>
    </figure>
  );
}
