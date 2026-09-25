import { WalletShell } from "@/components/wallet-shell";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { RecentlyChecked } from "@/components/recently-checked";

/**
 * Wallet index — "Check a Wallet". Semua angka berasal dari backend;
 * tanpa data karangan. Struktur: hero, search, contoh wallet nyata,
 * explainer statis, riwayat check perangkat ini (skor real via API).
 */

/** Wallet indexed nyata (seed) — label jujur per kondisi datanya. */
const TRY_WALLETS: Array<[string, string]> = [
  ["0xa6d9e296e6833d211278faf255c76ed193c9ac19", "Active wallet"],
  ["0x1111111111111111111111111111111111111112", "Fresh wallet"],
  [
    "0x000000000000000000000000000000000000dead",
    "Busy wallet (truncated walk)",
  ],
];

const EXPLAINERS: Array<{ title: string; body: string }> = [
  {
    title: "Reputation",
    body: "A score built from evidence, not votes — economic history, counterparties, contracts and community trust, each with its proof.",
  },
  {
    title: "Evidence",
    body: "Every claim traces back to indexed on-chain history. If the data is missing, the field reads unknown — never a guess.",
  },
  {
    title: "Relationships",
    body: "Who a wallet transacts and interacts with, mapped from real transfers and registry events — the counterparty graph behind the score.",
  },
  {
    title: "Risk",
    body: "Disputes and risk registries weigh against a wallet openly. Risk is evidence too — it is shown, not hidden.",
  },
];

export default function WalletsPage() {
  return (
    <WalletShell>
      <section
        aria-labelledby="wallet-index-heading"
        className="mx-auto max-w-3xl text-center"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-ink">
          Check a wallet
        </p>
        <h1
          id="wallet-index-heading"
          className="mt-4 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl"
        >
          Analyze a wallet before you trust it.
        </h1>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
          Reputation · Evidence · Relationships · Risk
        </p>

        <div className="mx-auto mt-8 max-w-xl">
          <SearchWalletForm submitLabel="Check" />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-slate400">
            Try
          </span>
          {TRY_WALLETS.map(([address, label]) => (
            <a
              key={address}
              href={`/wallets/${address}`}
              title={label}
              className="inline-flex min-touch items-center rounded-full border border-black/10 bg-white px-3 py-1.5 font-mono text-xs text-accent-ink shadow-sm transition hover:-translate-y-px hover:border-ink"
            >
              {`${address.slice(0, 6)}…${address.slice(-4)}`}
            </a>
          ))}
        </div>
      </section>

      {/* <section
        aria-label="What a wallet check covers"
        className="mx-auto mt-12 max-w-3xl"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {EXPLAINERS.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm"
            >
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate400">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section> */}

      <div className="mx-auto mt-12 max-w-3xl">
        <RecentlyChecked />
      </div>
    </WalletShell>
  );
}
