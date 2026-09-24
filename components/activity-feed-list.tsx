"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedItem, FeedTab } from "@/lib/activity/feed";
import { ActivityFeedCard } from "@/components/activity-feed-card";

const PAGE_SIZE = 20;

type FeedPage = { items: FeedItem[]; nextCursor: string | null };

function itemKey(item: FeedItem): string {
  return `${item.kind}:${item.id}`;
}

/**
 * Feed list dengan infinite scroll (Spec 04 section 3.4 UX): halaman
 * pertama server-rendered, halaman berikutnya di-fetch otomatis saat
 * sentinel menyentuh viewport — tanpa tombol. Kursor + tab + filter
 * wallet dipertahankan antar halaman.
 */
export function ActivityFeedList({
  initialItems,
  initialCursor,
  tab,
  wallet,
}: {
  initialItems: FeedItem[];
  initialCursor: string | null;
  tab: FeedTab;
  wallet?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (cursor === null || loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        tab,
      });
      if (cursor) params.set("cursor", cursor);
      if (wallet) params.set("wallet", wallet);
      const res = await fetch(`/api/activity?${params.toString()}`);
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
  }, [cursor, loading, tab, wallet]);

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
    <>
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <ActivityFeedCard key={itemKey(item)} item={item} />
        ))}
      </ul>
      {cursor !== null && (
        <div ref={sentinelRef} className="mt-6 text-center" aria-live="polite">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
            {loading ? "Loading…" : ""}
          </span>
        </div>
      )}
    </>
  );
}
