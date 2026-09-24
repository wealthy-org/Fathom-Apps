import type { MyActivityStats } from "@/lib/activity/mine";

/**
 * Stat strip 5 kartu — angka selalu ditemani kalimat konteks,
 * tidak ada angka telanjang.
 */
export function MyActivityStats({ stats }: { stats: MyActivityStats }) {
  const cards = [
    {
      label: "Total events",
      value: String(stats.total),
      note: "Everything this wallet signed or sent on Fathom.",
    },
    {
      label: "Vouches given",
      value: String(stats.vouches),
      note: "Stake-backed endorsements you issued to other wallets.",
    },
    {
      label: "Attestations given",
      value: String(stats.attestations),
      note: "Signed statements about wallets you have worked with.",
    },
    {
      label: "Disputes opened",
      value: String(stats.disputes),
      note: "Issues you raised on the public record — neutral until resolved.",
    },
    {
      label: "Wallet status",
      value: stats.claimed ? "Claimed ✓" : "Unclaimed",
      note: stats.claimed
        ? "You own this profile on Fathom."
        : "Claim this wallet from its profile to own the trail.",
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="list">
      {cards.map((card) => (
        <li key={card.label} className="panel-brutal p-4">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-slate400">
            {card.label}
          </p>
          <p className="mt-2 font-display text-2xl text-ink tabular-nums">
            {card.value}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-slate400">{card.note}</p>
        </li>
      ))}
    </ul>
  );
}
