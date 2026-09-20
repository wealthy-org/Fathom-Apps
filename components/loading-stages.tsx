"use client";

import { useEffect, useState } from "react";

/**
 * Staged narration for the wallet-analysis loading skeleton.
 *
 * Rotates honest activity lines — never percentages, never completion
 * claims. Static first stage when reduced motion is preferred.
 */

const STAGES = [
  "Analyzing wallet history…",
  "Building reputation evidence…",
  "Analyzing relationships…",
  "Preparing trust signals…",
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function LoadingStages() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % STAGES.length),
      2400,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <p
      role="status"
      aria-live="polite"
      className="mt-6 text-center font-mono text-xs text-slate400"
    >
      {STAGES[index]}
    </p>
  );
}
