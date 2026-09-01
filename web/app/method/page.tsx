import type { Metadata } from "next";
import { getResults } from "@/lib/data";

export const metadata: Metadata = {
  title: "Method · Sawtooth",
  description:
    "How Sawtooth was tested: the pre-registered decision rule, the leakage and staleness guards, the amendment, and the four defects in the published CMS files.",
};

const GH = "https://github.com/Muhammad-Haris-3/Sawtooth";

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "1rem" }}>
        <span className="label">
          {n} · {title}
        </span>
      </div>
      {children}
    </section>
  );
}

export default function Method() {
  const res = getResults();
  const p = res.model.primary;
  const sec = res.model.contemporaneous;
  const co = res.diagnostics.interpretable.coefficients;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3.2rem" }}>
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <span className="label">Method</span>
        <h1
          className="display"
          style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", lineHeight: 1.05 }}
        >
          The rule was fixed before the answer existed
        </h1>
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          The pre-registration was committed on 1 September 2026. The model ran on
          2 September. In between, no feature was ever joined to an outcome. Both
          commits are public, in order, and the timestamps are what make the null
          worth reading.
        </p>
        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
          {[
            ["Pre-registration", `${GH}/blob/main/PREREGISTRATION.md`],
            ["Findings", `${GH}/blob/main/FINDINGS.md`],
            ["M0 summary", `${GH}/blob/main/Sawtooth_M0_Summary.md`],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              style={{
                padding: "0.6rem 1rem",
                border: "1px solid var(--line-strong)",
                background: "var(--surface)",
                textDecoration: "none",
                fontSize: "0.88rem",
              }}
            >
              {label} ↗
            </a>
          ))}
        </div>
      </section>

      <Section n="01" title="The decision rule">
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          Confirmation required <em>all three</em>. Any other outcome is a null
          and is published as one.
        </p>
        <div className="scroll-x" style={{ border: "1px solid var(--line)", background: "var(--surface)" }}>
          <table>
            <thead>
              <tr>
                <th>Criterion, fixed in advance</th>
                <th className="mono">Observed</th>
                <th className="mono">Result</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Δ AUC ≥ 0.03", p.delta_auc.toFixed(4), p.criterion_delta],
                [
                  "95% paired bootstrap CI excludes 0",
                  `[${p.ci_low.toFixed(4)}, ${p.ci_high.toFixed(4)}]`,
                  p.criterion_ci,
                ],
                [
                  "Challenger Brier no worse",
                  `${p.brier_challenger.toFixed(5)} vs ${p.brier_baseline.toFixed(5)}`,
                  p.criterion_brier,
                ],
                [
                  "Power floor ≥2,000 surveys and ≥500 events",
                  `${p.n_test.toLocaleString()} / ${p.positives.toLocaleString()}`,
                  true,
                ],
              ].map(([k, v, ok]) => (
                <tr key={k as string}>
                  <td>{k as string}</td>
                  <td className="mono tnum">{v as string}</td>
                  <td
                    className="mono"
                    style={{
                      color: ok ? "var(--good)" : "var(--critical)",
                      fontWeight: 600,
                    }}
                  >
                    {ok ? "PASS" : "FAIL"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n="02" title="Two guards, and the bug one of them caught">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.2rem",
          }}
        >
          <div style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: "1.2rem" }}>
            <div className="label" style={{ color: "var(--s1)", marginBottom: "0.5rem" }}>
              Leakage guard
            </div>
            <p style={{ margin: 0, fontSize: "0.93rem" }}>
              Every feature comes from quarters ending <em>strictly before</em>{" "}
              the survey date. A survey can itself change staffing behaviour, so
              no part of the survey&rsquo;s own quarter enters the window. Asserted
              in code; a violation raises rather than warns.
            </p>
          </div>
          <div style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: "1.2rem" }}>
            <div className="label" style={{ color: "var(--s2)", marginBottom: "0.5rem" }}>
              Staleness guard
            </div>
            <p style={{ margin: 0, fontSize: "0.93rem" }}>
              &ldquo;The two quarters ending before the survey&rdquo; is not the
              same as &ldquo;the two quarters <em>preceding</em> it.&rdquo; Run
              against a partial panel, the first rule silently supplied a
              four-year-old exposure window and produced a clean-looking table
              that was mostly wrong. The window must now end within 180 days of
              the survey.
            </p>
          </div>
        </div>
      </Section>

      <Section n="03" title="The amendment, and why the baseline changed">
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          Version 1.0 named CMS&rsquo;s published staffing star and turnover
          measures as the baseline. Those are published as a{" "}
          <strong>single current snapshot</strong> with no archive — so a 2026
          value would have been predicting a 2023 survey. v1.0 applied its leakage
          guard to the challenger features and left the baseline exempt. That was
          an error, and it is recorded as an amendment rather than quietly fixed.
        </p>
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          The baseline is now rebuilt from the daily data as of the same window:
          mean, weekend and RN hours per resident day, plus beds, ownership and
          state. This makes the test <em>harder</em> — continuous as-of levels
          carry more information than a 1–5 star discretisation.
        </p>
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          The star-rating comparison survives as a bounded secondary, on surveys
          from August 2025 where the published snapshot is roughly
          contemporaneous. It is also null
          {"withheld" in sec
            ? "."
            : `: Δ AUC ${sec.delta_auc >= 0 ? "+" : ""}${sec.delta_auc.toFixed(
                4
              )}, CI [${sec.ci_low.toFixed(4)}, ${sec.ci_high.toFixed(4)}].`}
        </p>
      </Section>

      <Section n="04" title="What the published files actually required">
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          None of this is visible from the CMS catalogue. Each would corrupt a
          naive load.
        </p>
        <div className="scroll-x" style={{ border: "1px solid var(--line)", background: "var(--surface)" }}>
          <table>
            <thead>
              <tr>
                <th>Defect</th>
                <th>What it would have done</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Three naming conventions</strong> across 37 quarters; one
                  file encodes its quarter nowhere in its name
                </td>
                <td>
                  Silently lose quarters. <code>2qky-49qq.csv</code> was identified
                  as <strong>2020Q3</strong> by reading its <code>cy_qtr</code>{" "}
                  column — the single gap in the sequence.
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Eight drifting column names.</strong> 2017 uses{" "}
                  <code>hrs_lpn_admin</code>, <code>hrs_na_trn</code>,{" "}
                  <code>hrs_rn_donadmin</code>; 2017Q2 carries both DON spellings;
                  case flips at 2020Q1
                </td>
                <td>Columns silently become null.</td>
              </tr>
              <tr>
                <td>
                  <strong>The files are cp1252, not UTF-8.</strong> Two facilities
                  carry <code>0x92</code>/<code>0x96</code> in their names
                </td>
                <td>
                  360 rows of 1.3M abort a strict read of the whole file.{" "}
                  <code>ignore_errors</code> would drop rows silently; latin-1 would
                  turn those bytes into control characters. Each line is tried as
                  UTF-8 and falls back to cp1252, with repairs counted — 10,485
                  across the panel.
                </td>
              </tr>
              <tr>
                <td>
                  <strong>882 facilities (6.0%) had zero standard deficiencies</strong>
                </td>
                <td>
                  Building the survey universe from the citations file drops 6% of
                  surveys, every one of them clean, inflating the positive rate by
                  construction. The frame comes from the rating-cycle dates instead.
                </td>
              </tr>
              <tr>
                <td>
                  An <code>incomplete</code> quality flag published for{" "}
                  <strong>2021Q4 only</strong> (1.1% of rows)
                </td>
                <td>
                  Equivalent rows cannot be identified in any other quarter. Carried
                  through and declared as a limitation.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section n="05" title="The interpretable arm">
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          Standardised logistic regression on the training period, reported so
          coefficient signs can be inspected. Pseudo R²{" "}
          <span className="tnum">
            {res.diagnostics.interpretable.pseudo_r2.toFixed(4)}
          </span>{" "}
          on <span className="tnum">{res.diagnostics.interpretable.n.toLocaleString()}</span>{" "}
          surveys.
        </p>
        <div className="scroll-x" style={{ border: "1px solid var(--line)", background: "var(--surface)" }}>
          <table>
            <thead>
              <tr>
                <th className="mono">Feature</th>
                <th className="mono">Coef</th>
                <th className="mono">p</th>
                <th>Direction</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(co)
                .sort((a, b) => Math.abs(b[1].coef) - Math.abs(a[1].coef))
                .map(([k, v]) => (
                  <tr key={k}>
                    <td className="mono">{k}</td>
                    <td className="mono tnum">{v.coef.toFixed(3)}</td>
                    <td
                      className="mono tnum"
                      style={{ fontWeight: v.significant ? 600 : 400 }}
                    >
                      {v.p < 0.001 ? "<0.001" : v.p.toFixed(3)}
                    </td>
                    <td
                      style={{
                        color:
                          v.observed === v.expected ? "var(--ink-2)" : "var(--critical)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {v.observed === v.expected ? "as expected" : "opposite"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p style={{ color: "var(--ink-3)", fontSize: "0.85rem", maxWidth: "var(--measure)" }}>
          A caveat that matters: with <code>hprd_p10</code> correlating 0.958 with{" "}
          <code>mean_hprd</code>, the individual coefficients here are barely
          identified. That <code>mean_hprd</code> is not significant should be read
          as collinearity, not as evidence that staffing level does not matter.
        </p>
      </Section>

      <Section n="06" title="Why there is no backend">
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          The result is fixed. There is no live register and nothing to compute at
          request time — every number on this site is a precomputed aggregate, and
          the largest object is under two megabytes. An API here would serve static
          rows and call itself an architecture. The site is exported as plain files
          and hosted for free; the analysis that produced them is in the
          repository, with the sha256 of every source file it read.
        </p>
      </Section>
    </div>
  );
}
