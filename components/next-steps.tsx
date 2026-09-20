"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { ShareReputation } from "@/components/share-reputation";
import type { Address } from "@/lib/score/types";

/**
 * End-of-Overview "What's next" — closes the consumer growth loop without
 * duplicating tab content. Adapts to viewer state: visitors get check-own
 * and search paths; owners viewing their own profile get community/share
 * emphasis. Checking never requires claiming; nothing here gamifies.
 */

function CheckMyWalletButton({ viewed }: { viewed: Address }) {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <p className="text-sm text-slate400">
        Connect your wallet to inspect your own public profile — checking
        never requires claiming it.
      </p>
    );
  }
  if (address.toLowerCase() === viewed.toLowerCase()) {
    return (
      <p className="text-sm text-slate400">
        You&apos;re viewing your connected wallet. Claim it above to prove
        control, or support wallets you trust from the Community tab.
      </p>
    );
  }
  return (
    <Link
      href={`/wallets/${address.toLowerCase()}`}
      className="btn-brutal-light inline-flex px-4 py-2 text-xs"
    >
      Check my wallet →
    </Link>
  );
}

export function NextSteps({
  address,
  totalScore,
  tierLabel,
}: {
  address: Address;
  totalScore: number;
  tierLabel: string | null;
}) {
  return (
    <section aria-label="What's next" className="mt-10">
      <h2 className="font-display text-lg">What&apos;s next?</h2>
      <div className="panel-brutal mt-5 grid gap-6 p-6 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
            Check your own wallet
          </div>
          <div className="mt-2">
            <CheckMyWalletButton viewed={address} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
            Share reputation
          </div>
          <div className="mt-2">
            <ShareReputation
              address={address}
              totalScore={totalScore}
              tierLabel={tierLabel}
            />
          </div>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
            Check another wallet
          </div>
          <div className="mt-2">
            <SearchWalletForm hint={false} size="sm" />
          </div>
        </div>
      </div>
    </section>
  );
}
