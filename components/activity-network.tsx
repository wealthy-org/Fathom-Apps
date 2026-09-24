"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivitySidebarData } from "@/lib/activity/sidebar";
import type { FeedItem } from "@/lib/activity/feed";
import type { FeedKind } from "@/lib/activity/kinds";
import {
  ActivityFocusContext,
  type ActivityFocusValue,
} from "@/components/activity-focus-context";
import { ActivityToolbar } from "@/components/activity-toolbar";
import { ActivityFocusBar } from "@/components/activity-focus-bar";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ActivitySidebarNetwork } from "@/components/activity-sidebar-network";
import { involvedWallets, itemKey } from "@/components/activity-utils";

const PAGE_SIZE = 20;

type FeedPage = { items: FeedItem[]; nextCursor: string | null };

export interface ActivityKindCounts {
  attestation: number;
  vouch: number;
  dispute: number;
  claim: number;
}

function feedUrl(kind: FeedKind, cursor: string | null, wallet: string | null) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), kind });
  if (cursor) params.set("cursor", cursor);
  if (wallet) params.set("wallet", wallet);
  return `/api/activity?${params.toString()}`;
}

function walletStats(items: FeedItem[], wallet: string | null) {
  if (wallet === null) {
    return { events: items.length, attestations: 0, disputes: 0 };
  }
  const touching = items.filter((item) =>
    involvedWallets(item).includes(wallet),
  );
  return {
    events: touching.length,
    attestations: touching.filter((item) => item.kind === "attestation").length,
    disputes: touching.filter((item) => item.kind === "dispute").length,
  };
}

/**
 * Network feed wrapper: toolbar kind pills + timeline + focus mode +
 * sidebar sticky dalam satu FocusContext. Halaman 1 server-rendered;
 * perubahan kind/focus refetch halaman 1, sentinel memuat berikutnya.
 */
export function ActivityNetwork({
  initialItems,
  initialCursor,
  initialKind,
  initialWallet,
  counts,
  sidebar,
}: {
  initialItems: FeedItem[];
  initialCursor: string | null;
  initialKind: FeedKind;
  initialWallet: string | null;
  counts: ActivityKindCounts;
  sidebar: ActivitySidebarData;
}) {
  const [kind, setKind] = useState<FeedKind>(initialKind);
  const [focused, setFocused] = useState<string | null>(initialWallet);
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadedKeyRef = useRef(`${initialKind}:${initialWallet ?? ""}`);

  const reload = useCallback(
    async (nextKind: FeedKind, nextWallet: string | null) => {
      setLoading(true);
      try {
        const res = await fetch(feedUrl(nextKind, null, nextWallet));
        if (!res.ok) return;
        const page = (await res.json()) as FeedPage;
        if (!Array.isArray(page.items)) return;
        setItems(page.items);
        setCursor(page.nextCursor);
      } catch {
        // Diam: state server tetap tampil.
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const key = `${kind}:${focused ?? ""}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    void reload(kind, focused);
  }, [kind, focused, reload]);

  const loadMore = useCallback(async () => {
    if (cursor === null || loading) return;
    setLoading(true);
    try {
      const res = await fetch(feedUrl(kind, cursor, focused));
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
  }, [cursor, loading, kind, focused]);

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

  const focus: ActivityFocusValue = {
    focused,
    focusWallet: (address) => setFocused(address.toLowerCase()),
    clearFocus: () => setFocused(null),
  };

  const toolbarCounts = {
    all:
      counts.attestation + counts.vouch + counts.dispute + counts.claim,
    ...counts,
  };
  const stats = walletStats(items, focused);

  return (
    <ActivityFocusContext.Provider value={focus}>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="min-w-0 flex-1">
          <ActivityToolbar
            kind={kind}
            counts={toolbarCounts}
            onKindChange={setKind}
            onFocusWallet={focus.focusWallet}
          />
          <div className="mt-4">
            <ActivityFocusBar
              eventCount={stats.events}
              attestationCount={stats.attestations}
              disputeCount={stats.disputes}
            />
          </div>

          {items.length === 0 ? (
            <div className="panel-brutal mt-4 p-6 text-sm text-slate400">
              {focused !== null
                ? "No events touch this wallet yet. New matching evidence will appear as it happens."
                : "No activity recorded yet. Attestations, disputes, vouches and claims will appear here as they happen."}
            </div>
          ) : (
            <div aria-live="polite" aria-busy={loading}>
              <ActivityTimeline items={items} />
            </div>
          )}

          {cursor !== null && (
            <div ref={sentinelRef} className="mt-6 text-center" aria-live="polite">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                {loading ? "Loading…" : ""}
              </span>
            </div>
          )}
        </div>

        <ActivitySidebarNetwork data={sidebar} />
      </div>
    </ActivityFocusContext.Provider>
  );
}
