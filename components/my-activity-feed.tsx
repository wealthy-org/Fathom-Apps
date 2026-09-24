"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/lib/activity/feed";
import { MyActivityEvent } from "@/components/my-activity-event";
import { dayKey, itemKey } from "@/components/activity-utils";

const PAGE_SIZE = 20;
const PREVIEW_PER_DAY = 3;

type FeedPage = { items: FeedItem[]; nextCursor: string | null };

interface DayGroup {
  key: string;
  items: FeedItem[];
}

function groupByDay(items: FeedItem[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const item of items) {
    const key = dayKey(item.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, items: [item] });
    }
  }
  return groups;
}

/**
 * Feed personal dengan infinite scroll — halaman pertama server-rendered,
 * berikutnya di-fetch otomatis. Event dikelompokkan per hari; hari dengan
 * lebih dari 3 event menyembunyikan sisanya di balik <details> native.
 */
export function MyActivityFeed({
  initialItems,
  initialCursor,
}: {
  initialItems: FeedItem[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (cursor === null || loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/activity/me?${params.toString()}`);
      if (!res.ok) return;
      const page = (await res.json()) as FeedPage;
      if (!Array.isArray(page.items)) return;
      setItems((prev) => {
        const seen = new Set(prev.map(itemKey));
        return [...prev, ...page.items.filter((item) => !seen.has(itemKey(item)))];
      });
      setCursor(page.nextCursor);
    } catch {
      // Diam: sentinel tetap ada, scroll ulang akan mencoba lagi.
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (sentinel === null || cursor === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, cursor]);

  return (
    <div>
      <ol className="space-y-6" role="list" aria-live="polite" aria-busy={loading}>
        {groupByDay(items).map((group) => {
          const preview = group.items.slice(0, PREVIEW_PER_DAY);
          const rest = group.items.slice(PREVIEW_PER_DAY);
          return (
            <li key={group.key}>
              <div className="flex items-center gap-3">
                <h3 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-slate400">
                  {group.key}
                </h3>
                <span aria-hidden="true" className="h-px flex-1 bg-ink/10" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "event" : "events"}
                </span>
              </div>
              <ol className="mt-3 space-y-3" role="list">
                {preview.map((item) => (
                  <MyActivityEvent key={itemKey(item)} item={item} />
                ))}
                {rest.length > 0 && (
                  <li>
                    <details className="group">
                      <summary className="cursor-pointer select-none font-mono text-[10.5px] uppercase tracking-[0.09em] text-accent-ink hover:underline [&::-webkit-details-marker]:hidden">
                        + {rest.length} more{" "}
                        {rest.length === 1 ? "event" : "events"} this day →
                      </summary>
                      <ol className="mt-3 space-y-3" role="list">
                        {rest.map((item) => (
                          <MyActivityEvent key={itemKey(item)} item={item} />
                        ))}
                      </ol>
                    </details>
                  </li>
                )}
              </ol>
            </li>
          );
        })}
      </ol>
      {cursor !== null && (
        <div ref={sentinelRef} className="mt-6 text-center" aria-live="polite">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
            {loading ? "Loading…" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
