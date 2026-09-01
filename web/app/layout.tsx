import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Sawtooth",
  description:
    "A pre-registered test of whether the shape of a nursing home's daily staffing predicts inspection harm better than its level. It does not — because the shape and the level are nearly the same number.",
};

const NAV = [
  { href: "/", label: "The result" },
  { href: "/facilities/", label: "Facilities" },
  { href: "/method/", label: "Method" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <header
          style={{
            borderBottom: "1px solid var(--rule-hard)",
            background: "var(--surface)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <nav
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              padding: "0.75rem 1.375rem",
              display: "flex",
              alignItems: "baseline",
              gap: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/"
              className="display"
              style={{
                fontSize: "1.35rem",
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "-0.02em",
              }}
            >
              Sawtooth
            </Link>
            <div style={{ display: "flex", gap: "1.1rem", flexWrap: "wrap" }}>
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--ink-2)",
                    textDecoration: "none",
                  }}
                >
                  {n.label}
                </Link>
              ))}
            </div>
            <a
              href="https://github.com/Muhammad-Haris-3/Sawtooth"
              style={{
                marginLeft: "auto",
                fontSize: "0.82rem",
                color: "var(--ink-3)",
                textDecoration: "none",
              }}
              className="mono"
            >
              source ↗
            </a>
          </nav>
        </header>
        <main
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "3rem 1.375rem 5rem",
          }}
        >
          {children}
        </main>
        <footer
          style={{
            borderTop: "1px solid var(--rule)",
            padding: "1.5rem 1.375rem 3rem",
          }}
        >
          <div
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              color: "var(--ink-3)",
              fontSize: "0.85rem",
            }}
          >
            Sawtooth · CMS Payroll-Based Journal, 37 quarters, 49,202,720
            facility-days · pre-registration committed before any feature was
            joined to any outcome · all sources free, public and keyless
          </div>
        </footer>
      </body>
    </html>
  );
}
