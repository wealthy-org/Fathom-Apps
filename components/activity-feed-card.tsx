import Link from "next/link";
import type { FeedItem } from "@/lib/activity/feed";

const WEI_PER_ETH = BigInt(10) ** BigInt(18);

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Format nilai wei ke native unit untuk tampilan (AGENTS §9: hanya di boundary presentasi). */
function formatNative(wei: string): string {
  try {
    const value = BigInt(wei);
    const whole = value / WEI_PER_ETH;
    const fraction = value % WEI_PER_ETH;
    if (fraction === BigInt(0)) return `${whole} ETH`;
    const padded = fraction.toString().padStart(18, "0").replace(/0+$/, "");
    return `${whole}.${padded} ETH`;
  } catch {
    return `${wei} wei`;
  }
}

function WalletLink({
  address,
  strong = false,
}: {
  address: string;
  strong?: boolean;
}) {
  return (
    <Link
      href={`/wallets/${address}`}
      className={`font-mono hover:underline ${
        strong ? "font-semibold text-ink" : "text-accent-ink"
      }`}
    >
      {shortAddress(address)}
    </Link>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
      {children}
    </span>
  );
}

/**
 * Satu kartu feed — ringkasan terstruktur siapa-melakukan-apa-ke-siapa
 * (Spec 04 section 2.2). Tanpa posting bebas, tanpa comment, tanpa vote.
 * Tidak membaca dan tidak menulis skor dalam bentuk apapun.
 */
export function ActivityFeedCard({ item }: { item: FeedItem }) {
  return (
    <li className="panel-brutal p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge>{item.kind}</Badge>
        <span className="font-mono text-[11px] text-slate400">
          {formatDate(item.occurredAt)}
        </span>
      </div>

      {item.kind === "attestation" && (
        <p className="mt-2 text-sm leading-6 text-ink">
          <WalletLink address={item.attester} strong /> attested{" "}
          <WalletLink address={item.subject} /> as{" "}
          <strong className="font-semibold">{item.role}</strong>
          <span className="text-slate400">
            {" "}
            · {item.relationship}
            {item.durationMonths !== null && `, ${item.durationMonths} months`}
          </span>
        </p>
      )}

      {item.kind === "dispute" && (
        <p className="mt-2 text-sm leading-6 text-ink">
          <WalletLink address={item.reporter} strong /> opened a dispute
          against <WalletLink address={item.target} />
          {item.reason && (
            <span className="mt-1 block text-slate400">{item.reason}</span>
          )}
        </p>
      )}

      {item.kind === "vouch" && (
        <p className="mt-2 text-sm leading-6 text-ink">
          <WalletLink address={item.from} strong /> vouched for{" "}
          <WalletLink address={item.to} />{" "}
          <strong className="font-semibold tabular-nums">
            {formatNative(item.stakeWei)}
          </strong>
        </p>
      )}

      {item.kind === "claim" && (
        <p className="mt-2 text-sm leading-6 text-ink">
          <WalletLink address={item.address} strong /> was claimed by its owner
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-slate400">
        {(item.kind === "attestation" || item.kind === "dispute") && (
          <span>{item.onchain ? "on-chain" : "signed"}</span>
        )}
        {item.kind === "dispute" && (
          <span>
            status:{" "}
            <span
              className={
                item.status === "open"
                  ? "font-medium text-accent-ink"
                  : undefined
              }
            >
              {item.status}
            </span>
          </span>
        )}
        {item.kind === "vouch" && item.status !== "active" && (
          <span>status: {item.status}</span>
        )}
      </div>
    </li>
  );
}
