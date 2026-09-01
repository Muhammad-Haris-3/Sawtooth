"use client";

import { useMemo, useState } from "react";

type Props = {
  points: [number, number, number][]; // mean_hprd, hprd_p10, harm
  r: number;
  nTotal: number;
};

const W = 720;
const H = 460;
const M = { top: 24, right: 22, bottom: 52, left: 58 };
const LO = 1.5;
const HI = 7.0;

export default function RedundancyScatter({ points, r, nTotal }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; a: number; b: number } | null>(
    null
  );

  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (v: number) => M.left + ((v - LO) / (HI - LO)) * iw;
  const y = (v: number) => M.top + ih - ((v - LO) / (HI - LO)) * ih;

  const shown = useMemo(
    () => points.filter((p) => p[0] >= LO && p[0] <= HI && p[1] >= LO && p[1] <= HI),
    [points]
  );

  const ticks = [2, 3, 4, 5, 6, 7];

  return (
    <figure className="panel" style={{ margin: 0, padding: "1.5rem" }}>
      <div className="scroll-x">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", minWidth: 480, height: "auto", display: "block" }}
          role="img"
          aria-label={`Scatter of each facility's quarterly mean staffing against its 10th-percentile day. The points hug a straight line: correlation ${r.toFixed(
            3
          )} across ${nTotal.toLocaleString()} surveys.`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={M.top}
                y2={M.top + ih}
                stroke="var(--grid)"
              />
              <line
                x1={M.left}
                x2={M.left + iw}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--grid)"
              />
              <text
                x={x(t)}
                y={H - 30}
                textAnchor="middle"
                className="mono tnum"
                fontSize="11"
                fill="var(--ink-3)"
              >
                {t}
              </text>
              <text
                x={M.left - 10}
                y={y(t) + 4}
                textAnchor="end"
                className="mono tnum"
                fontSize="11"
                fill="var(--ink-3)"
              >
                {t}
              </text>
            </g>
          ))}

          {/* identity line: where floor would exactly equal level */}
          <line
            x1={x(LO)}
            y1={y(LO)}
            x2={x(HI)}
            y2={y(HI)}
            stroke="var(--ink-3)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text
            x={x(6.1)}
            y={y(6.1) - 8}
            className="mono"
            fontSize="10"
            fill="var(--ink-3)"
            transform={`rotate(-45 ${x(6.1)} ${y(6.1) - 8})`}
          >
            floor = level
          </text>

          {/* Dense overplotted cloud: needs enough presence to read as a mass
              on a dark surface, but stay translucent so density is visible. */}
          <g fill="var(--s1)" opacity={0.5}>
            {shown.map((p, i) => (
              <circle key={i} cx={x(p[0])} cy={y(p[1])} r={2.3} />
            ))}
          </g>

          {/* invisible hit grid for the tooltip */}
          <rect
            x={M.left}
            y={M.top}
            width={iw}
            height={ih}
            fill="transparent"
            onMouseMove={(e) => {
              const svg = e.currentTarget.ownerSVGElement!;
              const pt = svg.createSVGPoint();
              pt.x = e.clientX;
              pt.y = e.clientY;
              const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
              let best: [number, number, number] | null = null;
              let bd = Infinity;
              for (const p of shown) {
                const d = (x(p[0]) - loc.x) ** 2 + (y(p[1]) - loc.y) ** 2;
                if (d < bd) {
                  bd = d;
                  best = p;
                }
              }
              if (best && bd < 900)
                setHover({ x: x(best[0]), y: y(best[1]), a: best[0], b: best[1] });
              else setHover(null);
            }}
          />

          {hover && (
            <g pointerEvents="none">
              <circle
                cx={hover.x}
                cy={hover.y}
                r={5}
                fill="var(--s2)"
                stroke="var(--paper)"
                strokeWidth="2"
              />
              <rect
                x={Math.min(hover.x + 10, W - 158)}
                y={Math.max(hover.y - 42, M.top)}
                width={150}
                height={38}
                rx={3}
                fill="var(--paper)"
                stroke="var(--line-strong)"
              />
              <text
                x={Math.min(hover.x + 10, W - 158) + 9}
                y={Math.max(hover.y - 42, M.top) + 16}
                fontSize="11"
                className="mono tnum"
                fill="var(--ink-2)"
              >
                mean {hover.a.toFixed(2)}
              </text>
              <text
                x={Math.min(hover.x + 10, W - 158) + 9}
                y={Math.max(hover.y - 42, M.top) + 31}
                fontSize="11"
                className="mono tnum"
                fill="var(--ink-2)"
              >
                floor {hover.b.toFixed(2)}
              </text>
            </g>
          )}

          <text
            x={M.left + iw / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize="12"
            fill="var(--ink-2)"
          >
            Quarterly mean HPRD — the published kind of number
          </text>
          <text
            transform={`rotate(-90 14 ${M.top + ih / 2})`}
            x={14}
            y={M.top + ih / 2}
            textAnchor="middle"
            fontSize="12"
            fill="var(--ink-2)"
          >
            10th-percentile day — the &ldquo;floor&rdquo;
          </text>
        </svg>
      </div>
      <figcaption
        style={{ marginTop: "1.1rem", paddingTop: "1.1rem", borderTop: "1px solid var(--line)", fontSize: "0.86rem", color: "var(--ink-2)" }}
      >
        <strong className="tnum">r = {r.toFixed(3)}</strong> across{" "}
        <span className="tnum">{nTotal.toLocaleString()}</span> surveys.{" "}
        {shown.length.toLocaleString()} plotted (a random sample, for page weight).
        Every point sits almost on the dashed identity line: a facility&rsquo;s worst
        days are predictable from its average.
      </figcaption>
    </figure>
  );
}
