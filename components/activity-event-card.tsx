"use client";

import { useEffect, useState } from "react";
import type { FeedItem } from "@/lib/activity/feed";
import { useActivityFocus } from "@/components/activity-focus-context";
import {
  avatarHue,
  formatNative,
  formatRelative,
  formatDate,
  shortAddress,
} from "@/components/activity-utils";
import {
  fetchWalletMiniStats,
  type WalletMiniStats,
} from "@/components/wallet-mini-stats";
import { EventReactions } from "@/components/event-reactions";

/**
 * Satu kartu event di timeline network: collapsed = kalimat ringkas
 * dengan wallet chip; expand = mini-card per wallet (data real dari
 * GET /api/reputation/[address], lazy fetch sekali), blok "what this
 * means", tx hash, tombol focus. Tanpa posting bebas, tanpa skor input.
 */

function WalletAvatar({ address }: { address: string }) {
  const hue = avatarHue(address);
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
      style={{ backgroundColor: `hsl(${hue} 45% 55%)` }}
    />
  );
}

function WalletChip({ address }: { address: string }) {
  const { focused, focusWallet } = useActivityFocus();
  const isFocused = focused === address;
  return (
    <button
      type="button"
      onClick={() => focusWallet(address)}
      title={`Focus ${shortAddress(address)}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 align-middle font-mono text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        isFocused
          ? "border-ink bg-ink text-white"
          : "border-ink/15 bg-white text-ink hover:border-ink"
      }`}
    >
      <WalletAvatar address={address} />
      {shortAddress(address)}
    </button>
  );
}

function SignalPills({ item }: { item: FeedItem }) {
  const signals = item.signals ?? [];
  if (signals.length === 0) return null;
  const labels: Record<string, { text: string; className: string }> = {
    "risk-news": {
      text: "fresh risk",
      className: "border-accent/40 bg-accent/10 text-accent-ink",
    },
    "first-clean": {
      text: "first dispute",
      className: "border-accent/40 bg-accent/10 text-accent-ink",
    },
    personal: {
      text: "for you",
      className: "border-purple/40 bg-purple/10 text-purple",
    },
    established: {
      text: "established actor",
      className: "border-ink/30 bg-mist text-ink",
    },
    disputed: {
      text: "disputed",
      className: "border-ink/15 bg-white text-slate400",
    },
  };
  return (
    <>
      {signals.map((signal) => {
        const label = labels[signal];
        if (!label) return null;
        return (
          <span
            key={signal}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.09em] ${label.className}`}
          >
            {label.text}
          </span>
        );
      })}
    </>
  );
}

function StatusPill({ item }: { item: FeedItem }) {
  if (item.kind === "dispute") {
    const open = item.status === "open";
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.09em] ${
          open
            ? "border-accent/40 bg-accent/10 text-accent-ink"
            : "border-ink/15 bg-white text-slate400"
        }`}
      >
        {item.status}
      </span>
    );
  }
  if (item.kind === "vouch" && item.status !== "active") {
    return (
      <span className="inline-flex items-center rounded-full border border-ink/15 bg-white px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
        {item.status}
      </span>
    );
  }
  return null;
}

function OriginPill({ item }: { item: FeedItem }) {
  if (item.kind === "claim") return null;
  if (item.kind === "vouch") {
    return (
      <span className="inline-flex items-center rounded-full border border-ink/15 bg-white px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
        on-chain
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-ink/15 bg-white px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
      {item.onchain ? "on-chain" : "signed"}
    </span>
  );
}

function sentenceFor(item: FeedItem): React.ReactNode {
  switch (item.kind) {
    case "attestation":
      return (
        <>
          <WalletChip address={item.attester} /> attested{" "}
          <WalletChip address={item.subject} /> as{" "}
          <strong className="font-semibold">{item.role}</strong>
        </>
      );
    case "dispute":
      return (
        <>
          <WalletChip address={item.reporter} /> opened a dispute against{" "}
          <WalletChip address={item.target} />
        </>
      );
    case "vouch":
      return (
        <>
          <WalletChip address={item.from} /> vouched for{" "}
          <WalletChip address={item.to} /> with{" "}
          <strong className="font-semibold tabular-nums">
            {formatNative(item.stakeWei)}
          </strong>
        </>
      );
    case "claim":
      return (
        <>
          <WalletChip address={item.address} /> was claimed by its owner
        </>
      );
  }
}

function metaFor(item: FeedItem): string | null {
  switch (item.kind) {
    case "attestation": {
      const parts = [item.relationship];
      if (item.durationMonths !== null) parts.push(`${item.durationMonths} month`);
      return parts.filter(Boolean).join(" · ") || null;
    }
    case "dispute":
      return item.reason;
    case "vouch":
      return null;
    case "claim":
      return null;
  }
}

function meaningFor(item: FeedItem): string {
  switch (item.kind) {
    case "attestation":
      return "A signed statement about how these wallets know each other. Attestations carry economic weight once stake and history back them.";
    case "dispute":
      return "A public, on-chain record that something went wrong. Disputes are facts, not votes — the engine weighs them against the target wallet.";
    case "vouch":
      return "Stake locked to back another wallet's reputation. Withdrawing early weakens the vouch; disputes can slash it.";
    case "claim":
      return "The owner proved control of this wallet with a signature. Claiming only links the address — it never adds reputation.";
  }
}

function txHashFor(item: FeedItem): string | null {
  switch (item.kind) {
    case "attestation":
      return item.txHash;
    case "dispute":
      return item.txHash;
    case "vouch":
      return item.txHash;
    case "claim":
      return null;
  }
}

interface FetchState {
  address: string;
  stats: WalletMiniStats | null;
  failed: boolean;
}

function WalletMiniCard({
  address,
  role,
  active,
}: {
  address: string;
  role: string;
  /** Fetch hanya saat kartu expanded — collapsed tak boleh request. */
  active: boolean;
}) {
  const [state, setState] = useState<FetchState | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetchWalletMiniStats(address)
      .then((stats) => {
        if (!cancelled) setState({ address, stats, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ address, stats: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [address, active]);

  // address berbeda = masih memuat ulang; state lama tidak dipakai.
  const loaded = state !== null && state.address === address ? state : null;
  const failed = loaded?.failed ?? false;
  const stats = loaded?.stats ?? null;

  return (
    <div className="min-w-0 rounded-2xl border border-ink/10 bg-mist p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
          {role}
        </span>
        <WalletChip address={address} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {stats === null && !failed ? (
          <>
            <dt className="sr-only">Loading</dt>
            <dd className="col-span-2 h-4 animate-pulse rounded bg-black/10 motion-reduce:animate-none" />
            <dd className="h-4 animate-pulse rounded bg-black/10 motion-reduce:animate-none" />
            <dd className="h-4 animate-pulse rounded bg-black/10 motion-reduce:animate-none" />
          </>
        ) : (
          <>
            <div>
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
                Score
              </dt>
              <dd className="font-display text-lg tabular-nums">
                {failed || stats?.score === null ? "—" : stats?.score}
                {stats?.tierLabel && (
                  <span className="ml-1.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-accent-ink">
                    {stats.tierLabel}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
                Attested
              </dt>
              <dd className="font-display text-lg tabular-nums">
                {failed || stats?.attestations === null ? "—" : stats?.attestations}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
                Disputes
              </dt>
              <dd className="font-display text-lg tabular-nums">
                {failed || stats?.activeDisputes === null ? "—" : stats?.activeDisputes}
              </dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}

function FocusButton({ address, label }: { address: string; label: string }) {
  const { focused, focusWallet } = useActivityFocus();
  const active = focused === address;
  return (
    <button
      type="button"
      onClick={() => focusWallet(address)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.09em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active
          ? "border-ink bg-ink text-white"
          : "border-ink/20 bg-white text-ink hover:border-ink"
      }`}
    >
      {label}
    </button>
  );
}

const KIND_BORDER: Record<FeedItem["kind"], string> = {
  attestation: "border-l-ink",
  vouch: "border-l-purple",
  dispute: "border-l-accent",
  claim: "border-l-slate400",
};

export function ActivityEventCard({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false);
  const hash = txHashFor(item);
  const meta = metaFor(item);

  const pairs: Array<{ address: string; role: string; label: string }> =
    item.kind === "attestation"
      ? [
          { address: item.attester, role: "Attester", label: "Focus attester" },
          { address: item.subject, role: "Subject", label: "Focus subject" },
        ]
      : item.kind === "dispute"
        ? [
            { address: item.reporter, role: "Reporter", label: "Focus reporter" },
            { address: item.target, role: "Target", label: "Focus target" },
          ]
        : item.kind === "vouch"
          ? [
              { address: item.from, role: "Voucher", label: "Focus voucher" },
              { address: item.to, role: "Vouched", label: "Focus vouched" },
            ]
          : [{ address: item.address, role: "Owner", label: "Focus wallet" }];

  return (
    <div
      className={`rounded-3xl border border-ink/10 bg-white border-l-[3px] ${KIND_BORDER[item.kind]} shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-3xl p-4 pb-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5 sm:pb-0"
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
          {item.kind}
        </span>
        <span className="flex items-center gap-2 font-mono text-[11px] text-slate400">
          {/* relative time dihitung dari Date.now() — SSR/client bisa
              beda beberapa detik; suppress mencegah hydration warning. */}
          <span suppressHydrationWarning>
            {formatDate(item.occurredAt)} · {formatRelative(item.occurredAt)}
          </span>
          <span
            aria-hidden="true"
            className={`grid h-5 w-5 place-items-center rounded-full border border-ink/15 text-[11px] leading-none transition-transform duration-200 motion-reduce:transition-none ${
              expanded ? "rotate-45" : ""
            }`}
          >
            +
          </span>
        </span>
      </button>

      <div className="px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
        <p className="text-sm leading-6 text-ink">{sentenceFor(item)}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <SignalPills item={item} />
          <StatusPill item={item} />
          <OriginPill item={item} />
          {meta && (
            <span className="min-w-0 truncate font-mono text-[11px] text-slate400">
              {meta}
            </span>
          )}
        </div>
        {/* Reaksi non-scoring (Spec 04 3.3) — selalu tampil, count di-seed
            server; klik anonim membuka modal sign-in, tanpa POST. */}
        <div className="mt-3">
          <EventReactions
            kind={item.kind}
            targetId={String(item.id)}
            initialHelpful={item.reactions?.helpful ?? 0}
            initialNotHelpful={item.reactions?.notHelpful ?? 0}
            initialMyVote={item.reactions?.myVote ?? null}
          />
        </div>
      </div>

      {/* grid-rows 0fr→1fr expand — reduced-motion langsung tanpa transisi */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          expanded ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-ink/10 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
            <div
              className={`grid gap-3 ${
                pairs.length === 1 ? "" : "sm:grid-cols-2"
              }`}
            >
              {pairs.map((pair) => (
                <WalletMiniCard
                  key={`${pair.address}-${pair.role}`}
                  address={pair.address}
                  role={pair.role}
                  active={expanded}
                />
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate400">
              {meaningFor(item)}
            </p>
            {hash && (
              <p className="mt-3 break-all font-mono text-[11px] text-slate400">
                tx <span className="text-ink">{hash}</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {pairs.map((pair) => (
                <FocusButton
                  key={`${pair.address}-${pair.role}-focus`}
                  address={pair.address}
                  label={pair.label}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
