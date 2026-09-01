import Link from "next/link";
import Sawtooth from "@/components/Sawtooth";
import RedundancyScatter from "@/components/RedundancyScatter";
import { getSawtooth, getResults, getRedundancy } from "@/lib/data";

const SHAPE_LABEL: Record<string, string> = {
  hprd_p10: "hprd_p10 — the floor",
  low_day_freq: "low_day_freq — share of days under 3.0",
  max_low_run: "max_low_run — longest thin streak",
  hprd_cv: "hprd_cv — day-to-day variability",
  agency_share_sd: "agency_share_sd — swing in agency mix",
  agency_share: "agency_share — contract hours",
};

export default function Home() {
  const st = getSawtooth();
  const res = getResults();
  const red = getRedundancy();
  const p = res.model.primary;
  const sec = res.model.contemporaneous;
  const corr = res.diagnostics.redundancy;

  const ordered = Object.entries(corr).sort(
    (a, b) => b[1].max_abs - a[1].max_abs
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4rem" }}>
      {/* ── verdict ─────────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
        <span className="label">Pre-registered result · applied once</span>
        <h1
          className="display"
          style={{
            fontSize: "clamp(2.6rem, 6.5vw, 4.4rem)",
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
          }}
        >
          The shape of a nursing home&rsquo;s staffing does not predict harm
          better than its level.
        </h1>
        <p
          className="display"
          style={{
            fontSize: "clamp(1.15rem, 2.3vw, 1.5rem)",
            lineHeight: 1.45,
            color: "var(--ink-2)",
            maxWidth: "var(--measure)",
          }}
        >
          Because the shape and the level are nearly the same number. A
          facility&rsquo;s worst staffing day correlates{" "}
          <strong style={{ color: "var(--ink)" }}>{red.r.toFixed(3)}</strong> with
          its quarterly average. The information was never hiding in the daily
          data.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1px",
            background: "var(--rule)",
            border: "1px solid var(--rule)",
          }}
        >
          {[
            ["Δ AUC observed", p.delta_auc >= 0 ? `+${p.delta_auc.toFixed(4)}` : p.delta_auc.toFixed(4)],
            ["Threshold required", "0.0300"],
            ["95% CI", `[${p.ci_low.toFixed(4)}, ${p.ci_high.toFixed(4)}]`],
            ["Verdict", p.verdict],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "var(--surface)", padding: "1.1rem" }}>
              <div className="label" style={{ marginBottom: "0.35rem" }}>
                {k}
              </div>
              <div
                className="mono tnum"
                style={{
                  fontSize: "clamp(1rem, 1.6vw, 1.3rem)",
                  color: v === "NULL" ? "var(--critical)" : "var(--ink)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>

        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          Tested on{" "}
          <strong className="tnum">{p.n_test.toLocaleString()}</strong> held-out
          surveys containing{" "}
          <strong className="tnum">{p.positives.toLocaleString()}</strong>{" "}
          harm-level citations. The power floor{" "}
          <em>(≥2,000 surveys and ≥500 events)</em> was met with room to spare, so
          this is a null result and not a withholding. The threshold, the
          confidence-interval rule and the floor were all fixed in{" "}
          <Link href="/method/" style={{ color: "var(--s1)" }}>
            the pre-registration
          </Link>{" "}
          the day before the model ran.
        </p>
      </section>

      {/* ── the hook ────────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <div style={{ borderTop: "1px solid var(--rule-hard)", paddingTop: "1rem" }}>
          <span className="label">01 · What the project went looking for</span>
        </div>
        <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
          The sawtooth is real
        </h2>
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          Nurse staffing falls every weekend, in almost every facility, all year.
          Across{" "}
          <span className="tnum">{st.facility_days.toLocaleString()}</span>{" "}
          facility-days at{" "}
          <span className="tnum">{st.facilities.toLocaleString()}</span>{" "}
          facilities, Sunday runs{" "}
          <span className="tnum">{st.gap_pct.toFixed(1)}%</span> below the weekday
          average. That pattern is what suggested a quarterly mean might be
          hiding something.
        </p>
        <Sawtooth
          dow={st.dow}
          weekday={st.weekday}
          weekend={st.weekend}
          gapPct={st.gap_pct}
        />
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          But the drop is <em>modest and near-universal</em>. The median facility
          loses {st.percentiles.p50.toFixed(1)}%; only{" "}
          <span className="tnum">{st.n_drop20.toLocaleString()}</span> of{" "}
          <span className="tnum">{st.n_full_quarter.toLocaleString()}</span> lose
          20% or more, and{" "}
          <Link href="/facilities/" style={{ color: "var(--s1)" }}>
            <strong className="tnum">{st.n_healthy_drop20}</strong> of those also
            carry a healthy-looking average
          </Link>
          . A real list, not a catastrophe.
        </p>
      </section>

      {/* ── why null ────────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <div style={{ borderTop: "1px solid var(--rule-hard)", paddingTop: "1rem" }}>
          <span className="label">02 · Why the answer is no</span>
        </div>
        <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
          The floor and the level are the same number
        </h2>
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          The premise was that an average discards the distribution&rsquo;s shape.
          For nurse staffing it largely does not. Facilities are consistent enough
          week to week that knowing the mean tells you the floor.
        </p>

        <RedundancyScatter points={red.points} r={red.r} nTotal={red.n_total} />

        <div className="scroll-x" style={{ border: "1px solid var(--rule)", background: "var(--surface)" }}>
          <table>
            <thead>
              <tr>
                <th>Feature that was supposed to add information</th>
                <th className="mono">max |r| with a level feature</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordered.map(([k, v]) => {
                const w = Math.round(v.max_abs * 100);
                const redundant = v.max_abs > 0.5;
                return (
                  <tr key={k}>
                    <td className="mono" style={{ fontSize: "0.82rem" }}>
                      {SHAPE_LABEL[k] ?? k}
                    </td>
                    <td
                      className="mono tnum"
                      style={{
                        color: redundant ? "var(--critical)" : "var(--good)",
                        fontWeight: 600,
                      }}
                    >
                      {v.max_abs.toFixed(3)}
                    </td>
                    <td style={{ width: "45%", minWidth: 140 }}>
                      <div
                        style={{
                          height: 8,
                          background: "var(--panel)",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: `${w}%`,
                            background: redundant ? "var(--critical)" : "var(--good)",
                            opacity: 0.85,
                            borderRadius: "0 4px 4px 0",
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ color: "var(--ink-3)", fontSize: "0.85rem" }}>
          Red — already contained in the level. Green — genuinely independent of it.
        </p>
      </section>

      {/* ── what survived ───────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <div style={{ borderTop: "1px solid var(--rule-hard)", paddingTop: "1rem" }}>
          <span className="label">03 · What survived, and what it is worth</span>
        </div>
        <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
          Only the agency features are new information
        </h2>
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          The two features uncorrelated with staffing level — how much of a
          facility&rsquo;s nursing is contract labour, and how much that mix swings
          day to day — are the only ones carrying independent signal.{" "}
          <code>agency_share_sd</code> is the strongest shape coefficient in the
          interpretable arm ({res.diagnostics.interpretable.coefficients.agency_share_sd.coef.toFixed(
            3
          )}
          , p&nbsp;&lt;&nbsp;0.001), and both agency features are significant in the
          negative-binomial secondary at a Bonferroni-corrected alpha.
        </p>
        <div
          style={{
            borderLeft: "3px solid var(--critical)",
            background: "var(--panel)",
            padding: "1.2rem 1.4rem",
            maxWidth: "var(--measure)",
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>This does not rescue the claim, and is not presented as if it
            did.</strong>{" "}
            The pre-registered test was held-out discrimination, and it failed. The
            agency result is in-sample, on the training period, at a corrected
            alpha. It is a hypothesis for someone else to pre-register — not a
            finding this project earned.
          </p>
        </div>
      </section>

      {/* ── the bigger result ───────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <div style={{ borderTop: "1px solid var(--rule-hard)", paddingTop: "1rem" }}>
          <span className="label">04 · The result nobody was looking for</span>
        </div>
        <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
          Staffing barely predicts cited harm at all
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1px",
            background: "var(--rule)",
            border: "1px solid var(--rule)",
          }}
        >
          {[
            ["As-of reconstructed levels", p.auc_baseline],
            [
              "CMS published staffing star",
              "withheld" in sec ? null : sec.auc_baseline,
            ],
            ["Everything, including shape", p.auc_challenger],
          ].map(([k, v]) => (
            <div key={k as string} style={{ background: "var(--surface)", padding: "1.1rem" }}>
              <div className="label" style={{ marginBottom: "0.35rem" }}>
                {k as string}
              </div>
              <div className="mono tnum" style={{ fontSize: "1.55rem", fontWeight: 600 }}>
                {v === null ? "—" : (v as number).toFixed(4)}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--ink-3)" }}>AUC</div>
            </div>
          ))}
        </div>

        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          Every version of the model lands near{" "}
          <span className="tnum">0.61</span> — barely better than the base rate.
          Pseudo R² is{" "}
          <span className="tnum">
            {res.diagnostics.interpretable.pseudo_r2.toFixed(3)}
          </span>
          . Facility <strong>bed count</strong> is a stronger and more reliably
          significant predictor than any staffing measure in the model.
        </p>
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          That cuts at the premise shared by every version of this project. Two
          readings, and this design cannot separate them: staffing genuinely has
          weak influence on what inspections cite, or inspections are a noisy
          instrument dominated by surveyor and state. Either way, the assumption
          that staffing metrics predict inspection harm is weaker than the policy
          conversation around staffing minimums generally assumes.
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          <Link
            href="/method/"
            style={{
              padding: "0.7rem 1.2rem",
              border: "1px solid var(--rule-hard)",
              background: "var(--surface)",
              textDecoration: "none",
              fontSize: "0.9rem",
            }}
          >
            How this was tested →
          </Link>
          <a
            href="https://github.com/Muhammad-Haris-3/Sawtooth/blob/main/FINDINGS.md"
            style={{
              padding: "0.7rem 1.2rem",
              border: "1px solid var(--rule-hard)",
              background: "var(--surface)",
              textDecoration: "none",
              fontSize: "0.9rem",
            }}
          >
            Full findings ↗
          </a>
        </div>
      </section>
    </div>
  );
}
