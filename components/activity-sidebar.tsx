import Link from "next/link";
import type { ActivitySidebarData } from "@/lib/activity/sidebar";

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

function WalletLink({ address }: { address: string }) {
  return (
    <Link
      href={`/wallets/${address}`}
      className="font-mono text-accent-ink hover:underline"
    >
      {shortAddress(address)}
    </Link>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="panel-brutal p-4">
      <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-2 text-sm text-slate400">{text}</p>;
}

/**
 * Companion panels for /activity (Spec 04 section 3.2).
 * Compact evidence links only — display, never scoring input.
 * Stacks below the feed on mobile, docks right on desktop.
 */
export function ActivitySidebar({ data }: { data: ActivitySidebarData }) {
  return (
    <aside className="w-full shrink-0 space-y-3 lg:w-80">
      <Panel title="Recently Claimed">
        {data.claims.length === 0 ? (
          <Empty text="No claimed profiles yet." />
        ) : (
          <ul className="mt-2 space-y-2">
            {data.claims.map((claim) => (
              <li key={claim.address} className="text-sm text-ink">
                <WalletLink address={claim.address} />
                <span className="mt-0.5 block font-mono text-[11px] text-slate400">
                  claimed {formatDate(claim.claimedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Active Disputes">
        {data.disputes.length === 0 ? (
          <Empty text="No open disputes." />
        ) : (
          <ul className="mt-2 space-y-2">
            {data.disputes.map((dispute) => (
              <li key={dispute.id} className="text-sm text-ink">
                <WalletLink address={dispute.reporter} /> vs{" "}
                <WalletLink address={dispute.target} />
                <span className="mt-0.5 block font-mono text-[11px] text-slate400">
                  open since {formatDate(dispute.openedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="New Attestations">
        {data.attestations.length === 0 ? (
          <Empty text="No attestations yet." />
        ) : (
          <ul className="mt-2 space-y-2">
            {data.attestations.map((attestation) => (
              <li key={attestation.id} className="text-sm text-ink">
                <WalletLink address={attestation.attester} /> →{" "}
                <WalletLink address={attestation.subject} />
                <span className="mt-0.5 block font-mono text-[11px] text-slate400">
                  {attestation.role} · {formatDate(attestation.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </aside>
  );
}
