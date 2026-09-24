import type { FeedItem } from "@/lib/activity/feed";
import { formatNative, shortAddress } from "@/components/activity-utils";

/** Border-left color per tipe event: vouch ink, dispute accent, attestation abu, claim ungu. */
const KIND_EDGE: Record<FeedItem["kind"], string> = {
  vouch: "border-l-ink",
  dispute: "border-l-accent",
  attestation: "border-l-slate400",
  claim: "border-l-purple",
};

const KIND_LABEL: Record<FeedItem["kind"], string> = {
  vouch: "Vouch",
  dispute: "Dispute",
  attestation: "Attestation",
  claim: "Claim",
};

function AddressSpan({ address }: { address: string }) {
  return (
    <span className="font-mono text-accent-ink">{shortAddress(address)}</span>
  );
}

function sentence(item: FeedItem): React.ReactNode {
  switch (item.kind) {
    case "attestation":
      return (
        <>
          You attested <AddressSpan address={item.subject} /> as{" "}
          <strong className="font-semibold text-ink">{item.role}</strong>
        </>
      );
    case "vouch":
      return (
        <>
          You vouched for <AddressSpan address={item.to} /> with{" "}
          <strong className="font-semibold text-ink tabular-nums">
            {formatNative(item.stakeWei)}
          </strong>
        </>
      );
    case "dispute":
      return (
        <>
          You opened a dispute on <AddressSpan address={item.target} />
        </>
      );
    case "claim":
      return <>You claimed this profile as yours</>;
  }
}

/**
 * Kartu event compact My Activity — border-left warna per tipe,
 * kalimat utama + meta on-chain/signed + status pill untuk dispute open.
 */
export function MyActivityEvent({ item }: { item: FeedItem }) {
  return (
    <li
      className={`rounded-r-2xl border border-ink/10 border-l-[3px] bg-white p-4 shadow-[0_8px_20px_-12px_rgba(35,36,39,0.25)] ${KIND_EDGE[item.kind]}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-slate400">
          {KIND_LABEL[item.kind]}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
          {item.kind === "attestation" || item.kind === "dispute"
            ? item.onchain
              ? "on-chain"
              : "signed"
            : item.kind === "vouch"
              ? "on-chain"
              : null}
        </span>
        {item.kind === "dispute" && item.status === "open" && (
          <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-accent-ink">
            open
          </span>
        )}
        {item.kind === "vouch" && item.status !== "active" && (
          <span className="rounded-full border border-ink/15 bg-ink/5 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
            {item.status}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-6 text-ink">{sentence(item)}</p>
      {item.kind === "attestation" && (
        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
          {item.relationship}
          {item.durationMonths !== null && ` · ${item.durationMonths} months`}
        </p>
      )}
      {item.kind === "dispute" && item.reason && (
        <p className="mt-1 text-xs leading-5 text-slate400">{item.reason}</p>
      )}
    </li>
  );
}
