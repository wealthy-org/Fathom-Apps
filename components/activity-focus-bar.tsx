"use client";

import { useActivityFocus } from "@/components/activity-focus-context";
import { shortAddress } from "@/components/activity-utils";

/**
 * Bar hitam fokus wallet: address (serif) + ringkasan event terfilter
 * + CLEAR. Muncul di atas feed saat focus mode aktif.
 */
export function ActivityFocusBar({
  eventCount,
  attestationCount,
  disputeCount,
}: {
  eventCount: number;
  attestationCount: number;
  disputeCount: number;
}) {
  const { focused, clearFocus } = useActivityFocus();
  if (focused === null) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-3xl bg-coal px-5 py-4 text-white">
      <span className="font-serif-accent text-xl italic">
        {shortAddress(focused)}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60 tabular-nums">
        {eventCount} events · {attestationCount} attestations ·{" "}
        {disputeCount} disputes
      </span>
      <button
        type="button"
        onClick={clearFocus}
        className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/80 transition hover:border-white hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Clear ✕
      </button>
    </div>
  );
}
