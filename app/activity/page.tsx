import type { Metadata } from "next";
import { z } from "zod";
import {
  FEED_KINDS,
  getActivityFeed,
  getActivityKindCounts,
  isFeedKind,
} from "@/lib/activity/feed";
import { getActivitySidebar } from "@/lib/activity/sidebar";
import { ADDRESS_RE, normalizeAddress } from "@/lib/chain/address";
import { ActivityNetwork } from "@/components/activity-network";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activity — Fathom",
  description:
    "Latest public reputation evidence: attestations, disputes, vouches and profile claims across all wallets.",
};

const searchParamsSchema = z.object({
  kind: z.enum(FEED_KINDS).optional(),
  wallet: z.string().regex(ADDRESS_RE).optional(),
});

/**
 * Live reputation network feed — /activity.
 * Server renders page 1 (kind + wallet dari URL), sisanya client:
 * pill filter + counter, timeline per hari, expand event dengan data
 * real dari /api/reputation, focus mode, sidebar sticky.
 * Cards render structured evidence only; no free-form posting exists.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; wallet?: string }>;
}) {
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse(raw);
  const kind =
    parsed.success && parsed.data.kind && isFeedKind(parsed.data.kind)
      ? parsed.data.kind
      : "all";
  const wallet =
    parsed.success && parsed.data.wallet
      ? normalizeAddress(parsed.data.wallet)
      : null;

  const [page, counts, sidebar] = await Promise.all([
    getActivityFeed({ limit: 20, kind }),
    getActivityKindCounts(),
    getActivitySidebar(),
  ]);

  return (
    <>
      {/* <LandingActivityMarquee viewAll={false} bleed /> */}

      <section aria-labelledby="activity-heading -mt-10">
        <h1
          id="activity-heading"
          className="font-serif-accent text-4xl leading-tight text-ink sm:text-5xl"
        >
          The reputation network,{" "}
          <span className="italic bg-accent text-white">alive</span> in public.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate400">
          Attestations, vouches, disputes and claims as they happen. Expand an
          event to see both wallets and the evidence behind it — click any
          wallet to focus the network on it.
        </p>

        <div className="mt-8">
          <ActivityNetwork
            initialItems={page.items}
            initialCursor={page.nextCursor}
            initialKind={kind}
            initialWallet={wallet}
            counts={counts}
            sidebar={sidebar}
          />
        </div>
      </section>

      <footer className="mt-12 border-t border-ink/10 pt-4">
        <div className="mt-4 grid gap-2 border-t border-ink/10 pt-3 md:grid-cols-2 md:items-center">
          <div className="text-xs leading-4 text-slate400">© 2026 Fathom</div>

          <p className="text-xs leading-4 text-slate400 md:text-right">
            Built for pseudonymous economic identities.
          </p>
        </div>
      </footer>
    </>
  );
}
