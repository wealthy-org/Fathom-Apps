import type { Metadata } from "next";
import { z } from "zod";
import {
  FEED_KINDS,
  getActivityFeed,
  getActivityKindCounts,
  isFeedKind,
} from "@/lib/activity/feed";
import { getActivitySidebar } from "@/lib/activity/sidebar";
import { getNetworkPulse } from "@/lib/activity/pulse";
import { getSession } from "@/lib/auth/session";
import { ADDRESS_RE, normalizeAddress } from "@/lib/chain/address";
import { ActivityNetwork } from "@/components/activity-network";
import { PulseStrip } from "@/components/pulse-strip";
import { WalletShell } from "@/components/wallet-shell";

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
 * Home — live reputation network feed (was /activity).
 * Server renders page 1 (kind + wallet dari URL), sisanya client:
 * pill filter + counter, timeline per hari, expand event dengan data
 * real dari /api/reputation, focus mode, sidebar sticky.
 * Cards render structured evidence only; no free-form posting exists.
 */
export default async function Home({
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

  const session = await getSession().catch(() => null);
  const viewer =
    session && session.authenticated && session.walletAddress
      ? session.walletAddress
      : null;

  // ponytail: sequential + sekali retry, bukan Promise.all.
  // Supabase Transaction Pooler membatalkan query acak (57014, <2 dtk)
  // saat ~20 query konkuren — bahkan 2 batch paralel tak stabil.
  // Sequential: puncak = fan-out internal 1 fungsi (±8 query), teruji
  // stabil. Retry sekali untuk cancel transient; gagal dua kali =
  // error page jujur, bukan angka tebakan.
  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return await fn();
    }
  }
  const page = await withRetry(() =>
    getActivityFeed({ limit: 20, kind, tab: "signal", viewer }),
  );
  const counts = await withRetry(() => getActivityKindCounts());
  const sidebar = await withRetry(() => getActivitySidebar());
  const pulse = await withRetry(() => getNetworkPulse());

  return (
    <WalletShell>
      <div className="-mt-20">
        <PulseStrip data={pulse} />
      </div>

      <section aria-labelledby="activity-heading" className="mt-8">
        <h1 id="activity-heading" className="sr-only">
          Reputation activity feed
        </h1>
        <ActivityNetwork
          initialItems={page.items}
          initialCursor={page.nextCursor}
          initialKind={kind}
          initialWallet={wallet}
          counts={counts}
          sidebar={sidebar}
        />
      </section>

      <footer className="mt-12 border-t border-ink/10 pt-4">
        <div className="mt-4 grid gap-2 border-t border-ink/10 pt-3 md:grid-cols-2 md:items-center">
          <div className="text-xs leading-4 text-slate400">© 2026 Fathom</div>

          <p className="text-xs leading-4 text-slate400 md:text-right">
            Built for pseudonymous economic identities.
          </p>
        </div>
      </footer>
    </WalletShell>
  );
}
