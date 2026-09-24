"use client";

import type { FeedItem } from "@/lib/activity/feed";
import { ActivityEventCard } from "@/components/activity-event-card";
import { dayKey, itemKey } from "@/components/activity-utils";

/**
 * Feed timeline: group per hari (header mono uppercase + garis), garis
 * vertikal tipis di kiri, marker bulat per kind. Marker: attestation ✓
 * ink, vouch ◈ ungu, dispute ! accent (merah), claim ● abu.
 */

const MARKERS: Record<
  FeedItem["kind"],
  { glyph: string; className: string }
> = {
  attestation: { glyph: "✓", className: "border-ink/30 bg-white text-ink" },
  vouch: { glyph: "◈", className: "border-purple/40 bg-white text-purple" },
  dispute: { glyph: "!", className: "border-accent/40 bg-white text-accent-ink" },
  claim: { glyph: "●", className: "border-ink/15 bg-white text-slate400" },
};

export function ActivityTimeline({ items }: { items: FeedItem[] }) {
  const groups: Array<{ key: string; items: FeedItem[] }> = [];
  for (const item of items) {
    const key = dayKey(item.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, items: [item] });
    }
  }

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute bottom-2 left-[13px] top-2 w-px bg-ink/10"
      />
      {groups.map((group) => (
        <section key={group.key} aria-label={group.key} className="relative">
          <div className="flex items-center gap-3 py-4">
            <span className="relative z-10 h-7 w-7 shrink-0 rounded-full border border-ink/15 bg-canvas" />
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
              {group.key}
            </h3>
            <span aria-hidden="true" className="h-px min-w-8 flex-1 bg-ink/10" />
          </div>
          <ul className="space-y-3">
            {group.items.map((item) => {
              const marker = MARKERS[item.kind];
              return (
                <li
                  key={itemKey(item)}
                  className="relative flex gap-3 sm:gap-4"
                >
                  <span
                    aria-hidden="true"
                    className={`relative z-10 mt-3 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] leading-none ${marker.className}`}
                  >
                    {marker.glyph}
                  </span>
                  <div className="min-w-0 flex-1 pb-1">
                    <ActivityEventCard item={item} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
