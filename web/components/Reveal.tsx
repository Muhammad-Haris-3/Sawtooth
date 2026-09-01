"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Adds `className` once the element is ~15% visible, then stops
 * observing. Children render immediately either way — this gates the
 * animation, never the content, so nothing is hidden from crawlers
 * or from a reader without JS.
 */
export default function Reveal({
  children,
  className = "chart-in",
  amount = 0.15,
}: {
  children: React.ReactNode;
  className?: string;
  amount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setSeen(true);
      return;
    }

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: amount, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, amount]);

  return (
    <div ref={ref} className={seen ? className : undefined}>
      {children}
    </div>
  );
}
