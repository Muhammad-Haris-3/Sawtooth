import Link from "next/link";
import Sawtooth from "@/components/Sawtooth";
import GapHistogram from "@/components/GapHistogram";
import RedundancyBars from "@/components/RedundancyBars";
import RedundancyScatter from "@/components/RedundancyScatter";
import Reveal from "@/components/Reveal";
import { getSawtooth, getResults, getRedundancy, getGapHist } from "@/lib/data";

/** Section eyebrow + rule. Kept local: it is layout, not a component. */
function Eyebrow({ n, title, accent = "s1" }: { n?: string; title: string; accent?: "s1" | "s2" }) {
  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1.1rem" }}>
      <span className="label" style={{ color: accent === "s2" ? "var(--s2)" : "var(--s1)" }}>
        {n ? `${n} · ` : ""}{title}
      </span>
    </div>
  );
}

export default function Home() {
  const st = getSawtooth();
  const res = getResults();
  const red = getRedundancy();
  const hist = getGapHist();

  const p = res.model.primary;
  const sec = res.model.contemporaneous;
  const corr = res.diagnostics.redundancy;

  const THRESHOLD = 0.03;
  const SCALE = 0.035;                                   // bar runs 0 → 0.035
  const observedPct = Math.max((p.delta_auc / SCALE) * 100, 0);
  const thresholdPct = (THRESHOLD / SCALE) * 100;

  // AUC bars are read against a coin flip, not against zero.
  const aucPct = (v: number) => ((v - 0.5) / 0.2) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7rem" }}>
      {/* ── verdict ──────────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.6rem" }}>
        <span className="label label-accent rise">Pre-registered result · applied once</span>

        <h1
          className="display rise"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4.6rem)", maxWidth: "22ch", ["--i" as string]: 1 }}
        >
          The shape of a nursing home&rsquo;s staffing does not predict harm better
          than its level.
        </h1>

        <p className="lede rise" style={{ margin: 0, ["--i" as string]: 2 }}>
          Because the shape and the level are nearly the same number. A
          facility&rsquo;s worst staffing day correlates{" "}
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>{red.r.toFixed(3)}</strong>{" "}
          with its quarterly average. The information was never hiding in the
          daily data.
        </p>

        <div
          className="rise"
          style={{
            marginTop: "1.5rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.25rem",
            ["--i" as string]: 3,
          }}
        >
          {/* the verdict itself — the one place the polish is allowed to show */}
          <div
            className="panel lift"
            style={{
              borderColor: "color-mix(in oklab, var(--critical) 28%, transparent)",
              background:
                "linear-gradient(160deg, color-mix(in oklab, var(--critical) 9%, transparent) 0%, color-mix(in oklab, var(--surface) 90%, transparent) 55%)",
              padding: "1.75rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "1.5rem",
            }}
          >
            <span className="label" style={{ color: "var(--critical)" }}>Verdict</span>
            <div>
              <div
                className="display"
                style={{
                  fontSize: "clamp(3.4rem, 8vw, 5.2rem)",
                  lineHeight: 0.9,
                  letterSpacing: "-0.04em",
                  color: "var(--critical)",
                }}
              >
                {p.verdict}
              </div>
              <p style={{ margin: "0.9rem 0 0", fontSize: "0.9rem", color: "var(--ink-2)", maxWidth: "32ch" }}>
                Not a withholding. The power floor{" "}
                <em>(≥2,000 surveys and ≥500 events)</em> was met with room to
                spare — <span className="tnum">{p.n_test.toLocaleString()}</span>{" "}
                held-out surveys,{" "}
                <span className="tnum">{p.positives.toLocaleString()}</span> harm
                citations.
              </p>
            </div>
          </div>

          {/* observed gain against the pre-registered threshold */}
          <div className="panel" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
              <span className="label">Δ AUC observed vs required</span>
              <span className="mono" style={{ fontSize: "0.72rem", color: "var(--ink-3)" }}>0 → 0.035</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "0.84rem", color: "var(--ink-2)" }}>Observed</span>
                <span className="mono tnum" style={{ fontSize: "1.05rem" }}>
                  {p.delta_auc >= 0 ? "+" : ""}{p.delta_auc.toFixed(4)}
                </span>
              </div>

              <div style={{ position: "relative", height: 10, borderRadius: 999, background: "color-mix(in oklab, var(--ink) 6%, transparent)", overflow: "hidden" }}>
                <div
                  className="bar-x"
                  style={{
                    position: "absolute",
                    inset: "0 auto 0 0",
                    width: `${observedPct}%`,
                    borderRadius: 999,
                    background: "linear-gradient(90deg, color-mix(in oklab, var(--s1) 50%, transparent), var(--s1))",
                    animationDelay: "500ms",
                  }}
                />
              </div>

              <div style={{ position: "relative", height: 26 }}>
                <div
                  className="fade"
                  style={{
                    position: "absolute",
                    left: `${thresholdPct}%`,
                    top: -4,
                    bottom: 0,
                    width: 1,
                    background: "repeating-linear-gradient(to bottom, var(--critical) 0 4px, transparent 4px 8px)",
                    animationDelay: "1.2s",
                  }}
                />
                <span
                  className="mono fade"
                  style={{
                    position: "absolute",
                    left: `${thresholdPct}%`,
                    top: 4,
                    transform: "translateX(-100%)",
                    paddingRight: "0.5rem",
                    fontSize: "0.68rem",
                    color: "var(--critical)",
                    whiteSpace: "nowrap",
                    animationDelay: "1.3s",
                  }}
                >
                  threshold {THRESHOLD.toFixed(4)}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 1,
                background: "var(--line-strong)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div style={{ background: "var(--paper)", padding: "0.9rem 1rem" }}>
                <div className="label" style={{ fontSize: "0.62rem", marginBottom: "0.3rem" }}>95% CI</div>
                <div className="mono tnum" style={{ fontSize: "0.95rem", whiteSpace: "nowrap" }}>
                  [{p.ci_low.toFixed(4)}, {p.ci_high.toFixed(4)}]
                </div>
              </div>
              <div style={{ background: "var(--paper)", padding: "0.9rem 1rem" }}>
                <div className="label" style={{ fontSize: "0.62rem", marginBottom: "0.3rem" }}>Brier</div>
                <div className="mono tnum" style={{ fontSize: "0.95rem", color: "var(--good)", whiteSpace: "nowrap" }}>
                  {p.criterion_brier ? "no worse ✓" : "worse ✗"}
                </div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink-3)" }}>
              The interval spans zero and the gain is a fifth of the threshold.
              Both rules were fixed in{" "}
              <Link href="/method/" className="link">the pre-registration</Link>{" "}
              the day before the model ran.
            </p>
          </div>
        </div>
      </section>

      {/* ── 01 the hook ──────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <Eyebrow n="01" title="What the project went looking for" />
        <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3.2vw, 2.4rem)" }}>
          The sawtooth is real
        </h2>
        <p className="prose" style={{ margin: 0 }}>
          Nurse staffing falls every weekend, in almost every facility, all year.
          Across <span className="tnum">{st.facility_days.toLocaleString()}</span>{" "}
          facility-days at <span className="tnum">{st.facilities.toLocaleString()}</span>{" "}
          facilities, Sunday runs <span className="tnum">{st.gap_pct.toFixed(1)}%</span>{" "}
          below the weekday average. That pattern is what suggested a quarterly
          mean might be hiding something.
        </p>

        <Reveal>
          <Sawtooth dow={st.dow} weekday={st.weekday} weekend={st.weekend} gapPct={st.gap_pct} />
        </Reveal>

        <p className="prose" style={{ margin: "1rem 0 0" }}>
          But the drop is <em>modest and near-universal</em>. The median facility
          loses {st.percentiles.p50.toFixed(1)}%; only{" "}
          <span className="tnum">{st.n_drop20.toLocaleString()}</span> of{" "}
          <span className="tnum">{st.n_full_quarter.toLocaleString()}</span> lose
          20% or more, and{" "}
          <Link href="/facilities/" className="link">
            <strong className="tnum">{st.n_healthy_drop20}</strong> of those also
            carry a healthy-looking average
          </Link>
          . A real list, not a catastrophe.
        </p>

        <Reveal>
          <GapHistogram
            bins={hist.bins}
            median={st.percentiles.p50}
            nDrop20={st.n_drop20}
            nTotal={st.n_full_quarter}
          />
        </Reveal>
      </section>

      {/* ── 02 why null ──────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <Eyebrow n="02" title="Why the answer is no" />
        <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3.2vw, 2.4rem)" }}>
          The floor and the level are the same number
        </h2>
        <p className="prose" style={{ margin: 0 }}>
          The premise was that an average discards the distribution&rsquo;s shape.
          For nurse staffing it largely does not. Facilities are consistent enough
          week to week that knowing the mean tells you the floor — so every
          feature built to describe the shape turned out to be a restatement of
          the level.
        </p>

        <Reveal className="fade">
          <RedundancyScatter points={red.points} r={red.r} nTotal={red.n_total} />
        </Reveal>

        <p className="prose" style={{ margin: 0 }}>
          Ranked, the same fact reads as a scale: three of the six features are
          largely contained in the level they were built to improve on, and only
          the two agency measures are independent of it.
        </p>

        <Reveal className="fade">
          <RedundancyBars corr={corr as Record<string, { max_abs: number }>} />
        </Reveal>
      </section>

      {/* ── 03 what survived ─────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <Eyebrow n="03" title="What survived, and what it is worth" />
        <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3.2vw, 2.4rem)" }}>
          Only the agency features are new information
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
          <p style={{ color: "var(--ink-2)", margin: 0 }}>
            The two features uncorrelated with staffing level — how much of a
            facility&rsquo;s nursing is contract labour, and how much that mix
            swings day to day — are the only ones carrying independent signal.{" "}
            <code>agency_share_sd</code> is the strongest shape coefficient in the
            interpretable arm (
            {res.diagnostics.interpretable.coefficients.agency_share_sd.coef.toFixed(3)},
            p&nbsp;&lt;&nbsp;0.001), and both agency features are significant in
            the negative-binomial secondary at a Bonferroni-corrected alpha.
          </p>

          <div className="callout">
            <p style={{ margin: 0, fontSize: "0.95rem" }}>
              <strong>
                This does not rescue the claim, and is not presented as if it did.
              </strong>{" "}
              The pre-registered test was held-out discrimination, and it failed.
              The agency result is in-sample, on the training period, at a
              corrected alpha. It is a hypothesis for someone else to
              pre-register — not a finding this project earned.
            </p>
          </div>
        </div>
      </section>

      {/* ── 04 the bigger result ─────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <Eyebrow n="04" title="The result nobody was looking for" accent="s2" />
        <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3.2vw, 2.4rem)" }}>
          Staffing barely predicts cited harm at all
        </h2>
        <p className="prose" style={{ margin: 0 }}>
          Every version of the model lands near <span className="tnum">0.61</span>{" "}
          — barely better than the base rate. Pseudo R² is{" "}
          <span className="tnum">{res.diagnostics.interpretable.pseudo_r2.toFixed(3)}</span>.
          Facility <strong>bed count</strong> is a stronger and more reliably
          significant predictor than any staffing measure in the model.
        </p>

        <div className="panel" style={{ marginTop: "1rem", padding: "1.75rem 1.5rem 1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
            {([
              ["As-of reconstructed levels", p.auc_baseline, "s1"],
              ["CMS published staffing star", "withheld" in sec ? null : sec.auc_baseline, "s2"],
              ["Everything, including shape", p.auc_challenger, "s1"],
            ] as [string, number | null, "s1" | "s2"][]).map(([label, v, tone], i) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
                  <span style={{ fontSize: "0.88rem", color: "var(--ink-2)" }}>{label}</span>
                  <span className="mono tnum" style={{ fontSize: "0.95rem" }}>
                    {v == null ? "—" : v.toFixed(4)}
                  </span>
                </div>
                <div style={{ height: 14, borderRadius: 999, background: "color-mix(in oklab, var(--ink) 5%, transparent)", overflow: "hidden" }}>
                  {v != null && (
                    <div
                      className="bar-x"
                      style={{
                        height: "100%",
                        width: `${aucPct(v)}%`,
                        borderRadius: 999,
                        background: `linear-gradient(90deg, color-mix(in oklab, var(--${tone}) 35%, transparent), var(--${tone}))`,
                        animationDelay: `${100 + i * 120}ms`,
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div
            className="mono"
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "1.1rem",
              paddingTop: "0.9rem",
              borderTop: "1px solid var(--line)",
              fontSize: "0.7rem",
              color: "var(--ink-3)",
            }}
          >
            <span>AUC 0.50 — a coin flip</span>
            <span>0.70</span>
          </div>
        </div>

        <p className="prose" style={{ margin: "1rem 0 0" }}>
          That cuts at the premise shared by every version of this project. Two
          readings, and this design cannot separate them: staffing genuinely has
          weak influence on what inspections cite, or inspections are a noisy
          instrument dominated by surveyor and state. Either way, the assumption
          that staffing metrics predict inspection harm is weaker than the policy
          conversation around staffing minimums generally assumes.
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <Link href="/method/" className="btn btn-primary">How this was tested →</Link>
          <a
            href="https://github.com/Muhammad-Haris-3/Sawtooth/blob/main/FINDINGS.md"
            className="btn"
          >
            Full findings ↗
          </a>
        </div>
      </section>
    </div>
  );
}
