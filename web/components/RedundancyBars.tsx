"use client";

type Corr = Record<string, { max_abs: number }>;

const LABEL: Record<string, [string, string]> = {
  hprd_p10: ["hprd_p10", "the floor"],
  low_day_freq: ["low_day_freq", "days under 3.0"],
  max_low_run: ["max_low_run", "longest thin streak"],
  hprd_cv: ["hprd_cv", "day-to-day variability"],
  agency_share_sd: ["agency_share_sd", "swing in agency mix"],
  agency_share: ["agency_share", "contract hours"],
};

/** Replaces the old bar-in-a-table-cell markup: same numbers, read as
 *  one ranked scale instead of six unrelated rows. */
export default function RedundancyBars({ corr }: { corr: Corr }) {
  const ordered = Object.entries(corr).sort((a, b) => b[1].max_abs - a[1].max_abs);
  let ruled = false;

  return (
    <div className="panel" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem" }}>
        <span className="label">max |r| with a level feature</span>
        <span className="mono" style={{ fontSize: "0.72rem", color: "var(--ink-3)" }}>0 ————— 1.0</span>
      </div>

      {ordered.map(([k, v], i) => {
        const redundant = v.max_abs > 0.5;
        const [name, gloss] = LABEL[k] ?? [k, ""];
        const divider = !redundant && !ruled && (ruled = true);

        return (
          <div key={k}>
            {divider && <div style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "0.7rem 0.5rem",
                borderRadius: 6,
                transition: "background var(--dur-1) var(--ease)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--tint)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="mono" style={{ fontSize: "0.8rem", color: "var(--ink)", width: 190, flexShrink: 0 }}>{name}</span>
              <span style={{ fontSize: "0.82rem", color: "var(--ink-3)", width: 150, flexShrink: 0 }}>{gloss}</span>
              <div style={{ flex: 1, minWidth: 90, height: 22, borderRadius: 4, background: "color-mix(in oklab, var(--ink) 5%, transparent)", overflow: "hidden" }}>
                <div
                  className="bar-x"
                  style={{
                    height: "100%",
                    width: `${(v.max_abs * 100).toFixed(1)}%`,
                    borderRadius: 4,
                    background: redundant
                      ? "linear-gradient(90deg, color-mix(in oklab, var(--critical) 45%, transparent), var(--critical))"
                      : "linear-gradient(90deg, color-mix(in oklab, var(--s1) 45%, transparent), var(--s1))",
                    animationDelay: `${80 * (i + 1)}ms`,
                  }}
                />
              </div>
              <span className="mono tnum" style={{ fontSize: "0.86rem", width: 52, textAlign: "right", flexShrink: 0, color: redundant ? "var(--critical)" : "var(--s1)" }}>
                {v.max_abs.toFixed(3)}
              </span>
            </div>
          </div>
        );
      })}

      <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", color: "var(--ink-3)" }}>
        <span style={{ color: "var(--critical)" }}>Rose</span> — already contained in the level.{" "}
        <span style={{ color: "var(--s1)" }}>Mint</span> — genuinely independent of it.
      </p>
    </div>
  );
}
