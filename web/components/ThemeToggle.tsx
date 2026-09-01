"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark";

/** Runs before paint, inlined in <head>, so the stamp is set before first
 *  render and the page never flashes the wrong theme. Kept in sync with the
 *  component below by hand — it is deliberately tiny. */
export const THEME_INIT = `(function(){try{
var s=localStorage.getItem('sawtooth-theme');
if(s==='light'||s==='dark')document.documentElement.dataset.theme=s;
}catch(e){}})();`;

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode | null>(null);

  // Resolve the current mode after mount: an explicit stamp if the visitor has
  // chosen one, otherwise whatever the OS is asking for.
  useEffect(() => {
    const stamped = document.documentElement.dataset.theme as Mode | undefined;
    if (stamped === "light" || stamped === "dark") {
      setMode(stamped);
      return;
    }
    setMode(
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    );
  }, []);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("sawtooth-theme", next);
    } catch {
      /* private mode — the choice just won't persist */
    }
    setMode(next);
  }

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        mode === null
          ? "Switch colour theme"
          : `Switch to ${isDark ? "light" : "dark"} theme`
      }
      aria-pressed={isDark}
      title={mode === null ? "Switch theme" : isDark ? "Switch to light" : "Switch to dark"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 999,
        border: "1px solid var(--line)",
        background: "transparent",
        color: "var(--ink-3)",
        cursor: "pointer",
        padding: 0,
        transition: "color var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease), background var(--dur-1) var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--s1)";
        e.currentTarget.style.borderColor = "var(--line-strong)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--ink-3)";
        e.currentTarget.style.borderColor = "var(--line)";
      }}
    >
      {/* Rendered only once the mode is known, so SSR and client agree. */}
      {mode === null ? (
        <span style={{ width: 15, height: 15 }} aria-hidden />
      ) : isDark ? (
        // sun — click to go light
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // moon — click to go dark
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
