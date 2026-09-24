import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { FEED_TABS, getActivityFeed, isFeedTab } from "@/lib/activity/feed";
import { getActivitySidebar } from "@/lib/activity/sidebar";
import { ADDRESS_RE, normalizeAddress } from "@/lib/chain/address";
import { shortAddress } from "@/components/activity-feed-card";
import { ActivityFeedList } from "@/components/activity-feed-list";
import { ActivitySidebar } from "@/components/activity-sidebar";
import { ActivityTabs } from "@/components/activity-tabs";
import { LandingActivityMarquee } from "@/components/landing-activity-marquee";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activity — Fathom",
  description:
    "Latest public reputation evidence: attestations, disputes, vouches and profile claims across all wallets.",
};

const searchParamsSchema = z.object({
  cursor: z.string().datetime().optional(),
  tab: z.enum(FEED_TABS).optional(),
  wallet: z.string().regex(ADDRESS_RE).optional(),
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
  searchParams: Promise<{ cursor?: string; tab?: string; wallet?: string }>;
}) {
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse(raw);
  const cursor = parsed.success ? parsed.data.cursor : undefined;
  const tab =
    parsed.success && parsed.data.tab && isFeedTab(parsed.data.tab)
      ? parsed.data.tab
      : "latest";
  const wallet =
    parsed.success && parsed.data.wallet
      ? normalizeAddress(parsed.data.wallet)
      : undefined;
  const [page, sidebar] = await Promise.all([
    getActivityFeed({ limit: 20, cursor, tab, wallet }),
    getActivitySidebar(),
  ]);

  return (
    <>
      <LandingActivityMarquee viewAll={false} bleed />
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

          <ActivityTabs active={tab} wallet={wallet} />

          {wallet && (
            <p className="mt-3 text-sm text-slate400">
              Filtered to wallet{" "}
              <Link
                href={`/wallets/${wallet}`}
                className="font-mono text-accent-ink hover:underline"
              >
                {shortAddress(wallet)}
              </Link>{" "}
              ·{" "}
              <Link
                href={wallet ? `/activity?tab=${tab}` : "/activity"}
                className="text-accent-ink hover:underline"
              >
                Clear filter
              </Link>
            </p>
          )}

          {page.items.length === 0 ? (
            <div className="panel-brutal mt-6 p-6 text-sm text-slate400">
              {tab === "latest"
                ? "No activity recorded yet. Attestations, disputes, vouches and claims will appear here as they happen."
                : "Nothing in this view yet. New matching evidence will appear here as it happens."}
            </div>
          ) : (
            <ActivityFeedList
              initialItems={page.items}
              initialCursor={page.nextCursor}
              tab={tab}
              wallet={wallet}
            />
          )}
        </section>

        <ActivitySidebar data={sidebar} />
      </div>
    </>
  );
}
