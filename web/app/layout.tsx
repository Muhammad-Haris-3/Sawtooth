import type { Metadata } from "next";
import { Literata, Figtree, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import ThemeToggle, { THEME_INIT } from "@/components/ThemeToggle";
import "./globals.css";

const display = Literata({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});
const body = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Stamp the stored theme before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            borderBottom: "1px solid var(--line)",
            // 72% surface + blur: the rule reads as a seam, not a wall
            background: "color-mix(in oklab, var(--paper) 72%, transparent)",
            backdropFilter: "blur(14px) saturate(1.5)",
            WebkitBackdropFilter: "blur(14px) saturate(1.5)",
          }}
        >
          <nav
            style={{
              maxWidth: 1220,
              margin: "0 auto",
              padding: "0.9rem 1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/"
              className="display"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                fontSize: "1.3rem",
                fontWeight: 600,
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              <span className="pulse-dot" aria-hidden />
              Sawtooth
            </Link>

            <div style={{ display: "flex", gap: "1.6rem", flexWrap: "wrap" }}>
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="nav-link">
                  {n.label}
                </Link>
              ))}
            </div>

            <a
              href="https://github.com/Muhammad-Haris-3/Sawtooth"
              className="mono"
              style={{
                marginLeft: "auto",
                fontSize: "0.76rem",
                letterSpacing: "0.04em",
                color: "var(--ink-3)",
                border: "1px solid var(--line)",
                borderRadius: 999,
                padding: "0.35rem 0.85rem",
                textDecoration: "none",
                transition: "all var(--dur-2) var(--ease-out)",
              }}
            >
              source ↗
            </a>

            <ThemeToggle />
          </nav>
        </header>

        <main
          className="rise"
          style={{
            maxWidth: 1220,
            margin: "0 auto",
            padding: "5rem 1.5rem 7rem",
          }}
        >
          {children}
        </main>

        <footer
          style={{
            borderTop: "1px solid var(--line)",
            padding: "2.5rem 1.5rem 4rem",
          }}
        >
          <div
            style={{
              maxWidth: 1220,
              margin: "0 auto",
              display: "flex",
              justifyContent: "space-between",
              gap: "2rem",
              flexWrap: "wrap",
              color: "var(--ink-3)",
              fontSize: "0.84rem",
            }}
          >
            <p style={{ margin: 0, maxWidth: "62ch" }}>
              Sawtooth · CMS Payroll-Based Journal, 37 quarters, 49,202,720
              facility-days · pre-registration committed before any feature was
              joined to any outcome · all sources free, public and keyless
            </p>
            <span className="mono" style={{ fontSize: "0.76rem" }}>
              2026Q1
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
