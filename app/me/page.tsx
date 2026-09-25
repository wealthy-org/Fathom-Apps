import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import {
  getMyActivity,
  getMyActivityInsight,
  getMyActivityStats,
} from "@/lib/activity/mine";
import { MyActivityHero } from "@/components/my-activity-hero";
import { MyActivityStats } from "@/components/my-activity-stats";
import { MyActivityFeed } from "@/components/my-activity-feed";
import { MyActivityInsightPanel } from "@/components/my-activity-insight";
import { WalletShell } from "@/components/wallet-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Activity — Fathom",
  description:
    "Your own reputation actions: attestations made, vouches given, disputes opened and your profile claim.",
};

/**
 * "My Activity" — jejak reputasi personal wallet yang ter-autentikasi.
 * Gate server-side via SIWE session. Feed page 1 server-rendered,
 * halaman berikutnya via /api/activity/me (infinite scroll).
 */
export default async function MyActivityPage() {
  const session = await getSession();
  if (!session.authenticated || !session.walletAddress) {
    return (
      <WalletShell>
        <section aria-labelledby="my-activity-heading">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
            Personal reputation surface
          </p>
          <h1
            id="my-activity-heading"
            className="mt-3 font-serif-accent text-4xl text-ink sm:text-5xl"
          >
            My Activity
          </h1>
          <div className="panel-brutal mt-6 p-6 text-sm leading-6 text-slate400">
            Connect your wallet first — use the Connect button in the header.
            Your attestations, vouches, disputes and claim will show up here as
            your personal reputation trail.
          </div>
        </section>
      </WalletShell>
    );
  }

  const address = session.walletAddress;
  const [page, stats, insight] = await Promise.all([
    getMyActivity({ address, limit: 20 }),
    getMyActivityStats(address),
    getMyActivityInsight(address),
  ]);

  return (
    <WalletShell>
      <section aria-labelledby="my-activity-heading">
        <h2 id="my-activity-heading" className="sr-only">
          My Activity
        </h2>
        <MyActivityHero address={address} />

        <div className="mt-8">
          <MyActivityStats stats={stats} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.7fr_1fr]">
          <div className="min-w-0">
            {page.items.length === 0 ? (
              <div className="panel-brutal p-6 text-sm leading-6 text-slate400">
                No actions yet. Attest, vouch or open a dispute from any wallet
                profile and it will show up here — every entry is public
                evidence you signed.
              </div>
            ) : (
              <MyActivityFeed
                initialItems={page.items}
                initialCursor={page.nextCursor}
              />
            )}
          </div>
          <aside className="min-w-0">
            <MyActivityInsightPanel insight={insight} address={address} />
          </aside>
        </div>
      </section>

      <footer className="mt-12 border-t border-ink/10 pt-5">
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
