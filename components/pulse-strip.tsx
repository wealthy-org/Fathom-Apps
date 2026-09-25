"use client";

import type { NetworkPulse } from "@/lib/activity/pulse";
import { formatNative } from "@/components/activity-utils";

/**
 * Pulse strip — live network metrics ticker under the navbar.
 * Server passes real values via props (getNetworkPulse); this component
 * only duplicates the track for a seamless CSS loop. No mocks, no polling.
 * Motion stops under prefers-reduced-motion (globals.css).
 */
export function PulseStrip({ data }: { data: NetworkPulse }) {
  const metrics: Array<{ label: string; value: string }> = [
    { label: "Events today", value: String(data.eventsToday) },
    { label: "Open disputes", value: String(data.openDisputes) },
    { label: "Vouch stake", value: formatNative(data.vouchStakeWei) },
    { label: "Claimed wallets", value: String(data.claimedWallets) },
    {
      label: "Avg network score",
      value: data.avgScore === null ? "—" : String(data.avgScore),
    },
  ];
  const loop = [...metrics, ...metrics];

  return (
    <section
      aria-label="Live network stats"
      className="pulse-paused relative left-1/2 w-screen -translate-x-1/2 border-y border-ink/10 bg-white py-2.5"
    >
      <div className="overflow-hidden">
        <div className="pulse-track flex w-max items-center gap-8 px-5 motion-reduce:animate-none motion-reduce:overflow-x-auto lg:px-8">
          <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
            Live
          </span>
          {loop.map((metric, index) => (
            <span
              key={`${metric.label}-${index}`}
              aria-hidden={index >= metrics.length || undefined}
              className="flex items-center gap-8 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em]"
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="h-1 w-1 shrink-0 rounded-full bg-ink/20"
                />
              )}
              <span>
                <span className="text-slate400">{metric.label} </span>
                <span className="font-semibold text-ink tabular-nums">
                  {metric.value}
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
