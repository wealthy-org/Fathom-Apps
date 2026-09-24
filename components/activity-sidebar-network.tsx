"use client";

import type { ActivitySidebarData } from "@/lib/activity/sidebar";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { useActivityFocus } from "@/components/activity-focus-context";
import { avatarHue, formatDate, shortAddress } from "@/components/activity-utils";

/**
 * Sidebar sticky network feed: kartu skor (serif italic + CHECK
 * accent), Active Disputes dan Recently Claimed — klik = fokus wallet.
 * Data dari getActivitySidebar() (server), interaksi via context.
 */

function FocusWalletButton({
  address,
  children,
}: {
  address: string;
  children: React.ReactNode;
}) {
  const { focused, focusWallet } = useActivityFocus();
  const active = focused === address;
  return (
    <button
      type="button"
      onClick={() => focusWallet(address)}
      className={`inline-flex items-center gap-1.5 font-mono text-xs transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active ? "text-ink underline" : "text-accent-ink"
      }`}
    >
      <span
        aria-hidden="true"
        className="inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10"
        style={{ backgroundColor: `hsl(${avatarHue(address)} 45% 55%)` }}
      />
      {children}
    </button>
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

export function ActivitySidebarNetwork({
  data,
}: {
  data: ActivitySidebarData;
}) {
  return (
    <aside className="w-full shrink-0 space-y-3 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:w-[340px] lg:self-start lg:overflow-y-auto">
      <section
        aria-label="What's your credibility score?"
        className="panel-brutal p-6 text-center"
      >
        <h2 className="font-serif-accent text-2xl italic text-ink">
          What&apos;s your credibility score?
        </h2>
        <p className="mt-2 text-sm text-slate400">
          Paste any wallet — public evidence only.
        </p>
        <div className="mt-4 [&_.btn-brutal]:bg-accent [&_.btn-brutal:hover]:bg-accent-ink">
          <SearchWalletForm submitLabel="CHECK" hint={false} />
        </div>
      </section>

      <Panel title="Active Disputes">
        {data.disputes.length === 0 ? (
          <p className="mt-2 text-sm text-slate400">No open disputes.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.disputes.map((dispute) => (
              <li key={dispute.id} className="text-sm text-ink">
                <FocusWalletButton address={dispute.reporter}>
                  {shortAddress(dispute.reporter)}
                </FocusWalletButton>{" "}
                vs{" "}
                <FocusWalletButton address={dispute.target}>
                  {shortAddress(dispute.target)}
                </FocusWalletButton>
                <span className="mt-0.5 block font-mono text-[11px] text-slate400">
                  open since {formatDate(dispute.openedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Recently Claimed">
        {data.claims.length === 0 ? (
          <p className="mt-2 text-sm text-slate400">No claimed profiles yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.claims.map((claim) => (
              <li key={claim.address} className="text-sm text-ink">
                <FocusWalletButton address={claim.address}>
                  {shortAddress(claim.address)}
                </FocusWalletButton>
                <span className="mt-0.5 block font-mono text-[11px] text-slate400">
                  claimed {formatDate(claim.claimedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </aside>
  );
}
