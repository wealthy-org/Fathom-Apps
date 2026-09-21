import type { Metadata } from "next";
import { WalletShell } from "@/components/wallet-shell";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { RecentlyChecked } from "@/components/recently-checked";

export const metadata: Metadata = {
  title: "Fathom — Search a Wallet",
  description:
    "Inspect any wallet address. Evidence before score. Public, no account required.",
};

export default function WalletsPage() {
  return (
    <WalletShell>
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-ink">
          Check a wallet
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight sm:text-5xl">
          Analyze a wallet before interacting with it.
        </h1>
        <div className="mt-8">
          <SearchWalletForm />
        </div>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
          Reputation · Evidence · Relationships · Risk
        </p>
      </div>

      <RecentlyChecked />
    </WalletShell>
  );
}
