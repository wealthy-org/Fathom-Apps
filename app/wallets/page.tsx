import type { Metadata } from "next";
import Link from "next/link";
import { WalletShell } from "@/components/wallet-shell";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { RecentlyChecked } from "@/components/recently-checked";

export const metadata: Metadata = {
  title: "Fathom — Search a Wallet",
  description:
    "Inspect any wallet address. Evidence before score. Public, no account required.",
};

const EXAMPLES: Array<[string, string]> = [
  ["0xa6d9e296e6833d211278faf255c76ed193c9ac19", "Active wallet"],
  ["0x1111111111111111111111111111111111111112", "Fresh wallet"],
  ["0x000000000000000000000000000000000000dead", "Busy wallet (truncated walk)"],
];

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function WalletsPage() {
  return (
    <WalletShell>
      {/* <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-ink">
        Wallet profile
      </p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-tight sm:text-5xl">
        Know the wallet
        <span className="block bg-gradient-to-b from-ink to-ink/50 bg-clip-text text-transparent">
          before you trust it.
        </span>
      </h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-slate400">
        Enter any wallet address above to inspect its on-chain history, proofs,
        and relationships. Fathom shows evidence — never a number it cannot
        justify.
      </p> */}

      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-ink">
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

      <div className="mt-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
          Try an example wallet
        </div>
        <ul className="mt-4 space-y-2">
          {EXAMPLES.map(([address, label]) => (
            <li key={address}>
              <Link
                href={`/wallets/${address}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-ink/80 shadow-sm transition hover:-translate-y-px"
              >
                <span className="font-mono text-accent-ink">
                  {shortAddress(address)}
                </span>
                <span className="text-xs text-slate400">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </WalletShell>
  );
}
