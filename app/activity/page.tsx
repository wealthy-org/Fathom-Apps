import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { FEED_TABS, getActivityFeed, isFeedTab } from "@/lib/activity/feed";
import { getActivitySidebar } from "@/lib/activity/sidebar";
import { ActivityFeedCard } from "@/components/activity-feed-card";
import { ActivitySidebar } from "@/components/activity-sidebar";
import { ActivityTabs } from "@/components/activity-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activity — Fathom",
  description:
    "Latest public reputation evidence: attestations, disputes, vouches and profile claims across all wallets.",
};

const searchParamsSchema = z.object({
  cursor: z.string().datetime().optional(),
  tab: z.enum(FEED_TABS).optional(),
});

const TAB_BLURBS: Record<string, string> = {
  signal:
    "Highest evidence weight first — established actors and open disputes, then time.",
  latest: "Latest reputation evidence across all wallets — newest first.",
  established:
    "Attestations and vouches from Established-tier wallets, newest first.",
  disputed:
    "Activity touching wallets with an open dispute — on-chain fact, not votes.",
};

/**
 * Public activity feed with tab filters (S1+S2) and companion
 * sidebar (S3: Recently Claimed, Active Disputes, New Attestations).
 * Server-rendered page 1 + cursor "load more" link — zero client JS.
 * Cards render structured evidence only; no free-form posting exists here.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; tab?: string }>;
}) {
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse(raw);
  const cursor = parsed.success ? parsed.data.cursor : undefined;
  const tab =
    parsed.success && parsed.data.tab && isFeedTab(parsed.data.tab)
      ? parsed.data.tab
      : "latest";

  const [page, sidebar] = await Promise.all([
    getActivityFeed({ limit: 20, cursor, tab }),
    getActivitySidebar(),
  ]);
  const moreHref =
    tab === "latest"
      ? `/activity?cursor=${encodeURIComponent(page.nextCursor ?? "")}`
      : `/activity?tab=${tab}&cursor=${encodeURIComponent(page.nextCursor ?? "")}`;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <section aria-labelledby="activity-heading" className="min-w-0 flex-1">
        <h1
          id="activity-heading"
          className="font-display text-2xl font-semibold sm:text-3xl"
        >
          Activity
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate400">
          {TAB_BLURBS[tab]}
        </p>

        <ActivityTabs active={tab} />

        {page.items.length === 0 ? (
          <div className="panel-brutal mt-6 p-6 text-sm text-slate400">
            {tab === "latest"
              ? "No activity recorded yet. Attestations, disputes, vouches and claims will appear here as they happen."
              : "Nothing in this view yet. New matching evidence will appear here as it happens."}
          </div>
        ) : (
          <>
            <ul className="mt-6 space-y-3">
              {page.items.map((item) => (
                <ActivityFeedCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                />
              ))}
            </ul>
            {page.nextCursor !== null && (
              <div className="mt-6 text-center">
                <Link
                  href={moreHref}
                  className="btn-brutal inline-block px-5 py-2.5 text-sm"
                >
                  Load more
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      <ActivitySidebar data={sidebar} />
    </div>
  );
}
