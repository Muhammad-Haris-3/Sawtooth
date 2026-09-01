import type { Metadata } from "next";
import FacilitySearch from "@/components/FacilitySearch";
import { getFlagged, getSawtooth } from "@/lib/data";

export const metadata: Metadata = {
  title: "Facilities · Sawtooth",
  description:
    "The 188 nursing homes whose healthy-looking quarterly staffing average conceals a weekend drop of 20% or more, plus a lookup for every facility.",
};

export default function Facilities() {
  const st = getSawtooth();
  const fl = getFlagged();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <span className="label">The specific list</span>
        <h1
          className="display"
          style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", lineHeight: 1.05 }}
        >
          {fl.rows.length} facilities whose average hides their weekend
        </h1>
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          Of{" "}
          <span className="tnum">{st.n_full_quarter.toLocaleString()}</span>{" "}
          facilities with a full quarter of data in {fl.criteria.quarter},{" "}
          <span className="tnum">{st.n_drop20.toLocaleString()}</span> drop{" "}
          {fl.criteria.weekend_drop_min_pct}% or more at weekends. These{" "}
          <strong className="tnum">{fl.rows.length}</strong> also carry a
          quarterly average at or above{" "}
          <span className="tnum">{fl.criteria.mean_hprd_min}</span> hours per
          resident day — the kind of number that looks fine on a scorecard.
        </p>
        <div
          style={{
            borderLeft: "3px solid var(--s2)",
            background: "var(--panel)",
            padding: "1.1rem 1.3rem",
            maxWidth: "var(--measure)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.95rem" }}>
            This list is descriptive, and it is <strong>not</strong> evidence that
            these facilities cause more harm. The pre-registered test of whether
            weekend and distribution features predict inspection harm{" "}
            <strong>returned null</strong>. A large weekend drop is a real fact
            about a schedule; it is not a demonstrated risk signal.
          </p>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <div className="scroll-x" style={{ border: "1px solid var(--rule)", background: "var(--surface)" }}>
          <table>
            <thead>
              <tr>
                <th>Facility</th>
                <th>City</th>
                <th className="mono">State</th>
                <th className="mono">Weekend drop</th>
                <th className="mono">Mean HPRD</th>
                <th className="mono">Staffing star</th>
              </tr>
            </thead>
            <tbody>
              {fl.rows.map((r) => (
                <tr key={r[0]}>
                  <td style={{ fontWeight: 500 }}>{r[1]}</td>
                  <td style={{ color: "var(--ink-2)" }}>{r[2]}</td>
                  <td className="mono">{r[3]}</td>
                  <td
                    className="mono tnum"
                    style={{ color: "var(--critical)", fontWeight: 600 }}
                  >
                    {r[4].toFixed(1)}%
                  </td>
                  <td className="mono tnum">{r[5].toFixed(2)}</td>
                  <td className="mono tnum">{r[6] ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ borderTop: "1px solid var(--rule-hard)", paddingTop: "1rem" }}>
          <span className="label">Look up any facility</span>
        </div>
        <h2 className="display" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>
          Every facility&rsquo;s week
        </h2>
        <p style={{ color: "var(--ink-2)", maxWidth: "var(--measure)" }}>
          Daily nurse hours per resident day, averaged by day of week over{" "}
          {fl.criteria.quarter}. Weekend days are marked; the shaded band is
          Saturday and Sunday.
        </p>
        <FacilitySearch />
      </section>
    </div>
  );
}
