"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

// ponytail: presentation-only stages — no percentages, no backend claims.
const STAGES = [
  "Analyzing wallet activity…",
  "Loading wallet history…",
  "Analyzing relationships…",
  "Building reputation evidence…",
  "Preparing trust graph…",
];

function shortAddress(address: string) {
  return address.length > 13
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

export function ProfileLoadingHeader() {
  const params = useParams();
  const raw = params?.address;
  const address = typeof raw === "string" ? raw.toLowerCase() : null;
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setStage((s) => (s + 1) % STAGES.length),
      2400,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate400">
        Wallet profile
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium sm:text-4xl">
        {address ? shortAddress(address) : "…"}
      </h1>
      {address && (
        <p className="mt-3 break-all font-mono text-xs text-slate400">
          {address}
        </p>
      )}
      <p
        aria-live="polite"
        className="mt-3 font-mono text-xs text-accent-ink"
      >
        {STAGES[stage]}
      </p>
    </div>
  );
}
