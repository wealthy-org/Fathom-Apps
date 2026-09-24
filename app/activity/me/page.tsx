import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getMyActivity } from "@/lib/activity/mine";
import { ActivityFeedCard } from "@/components/activity-feed-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Activity — Fathom",
  description:
    "Your own reputation actions: attestations made, vouches given, disputes opened and your profile claim.",
};

const searchParamsSchema = z.object({
  cursor: z.string().datetime().optional(),
});

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * "My Activity" (Spec 04 section 3.4) — history of the connected wallet.
 * Gated on the SIWE session server-side. Same cards as the public feed.
 */
export default async function MyActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await getSession();
  if (!session.authenticated || !session.walletAddress) {
    return (
      <section aria-labelledby="my-activity-heading">
        <h1
          id="my-activity-heading"
          className="font-display text-2xl font-semibold sm:text-3xl"
        >
          My Activity
        </h1>
        <div className="panel-brutal mt-6 p-6 text-sm text-slate400">
          Connect your wallet first — use the Connect button in the header.
          Your attestations, vouches, disputes and claim will be listed here.
        </div>
      </section>
    );
  }

  const address = session.walletAddress;
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse(raw);
  const cursor = parsed.success ? parsed.data.cursor : undefined;

  const page = await getMyActivity({ address, limit: 20, cursor });

  return (
    <section aria-labelledby="my-activity-heading">
      <h1
        id="my-activity-heading"
        className="font-display text-2xl font-semibold sm:text-3xl"
      >
        My Activity
      </h1>
      <p className="mt-2 max-w-2xl font-mono text-sm text-slate400">
        {shortAddress(address)} — everything this wallet did, newest first.
      </p>

      {page.items.length === 0 ? (
        <div className="panel-brutal mt-6 p-6 text-sm text-slate400">
          No actions yet. Attest, vouch or open a dispute from any wallet
          profile and it will show up here.
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
                href={`/activity/me?cursor=${encodeURIComponent(page.nextCursor)}`}
                className="btn-brutal inline-block px-5 py-2.5 text-sm"
              >
                Load more
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
