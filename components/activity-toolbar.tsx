"use client";

import { useState } from "react";
import { FEED_KINDS, type FeedKind } from "@/lib/activity/kinds";
import { ADDRESS_RE } from "@/lib/chain/address";

const LABELS: Record<FeedKind, string> = {
  all: "All",
  attestation: "Attestations",
  vouch: "Vouches",
  dispute: "Disputes",
  claim: "Claims",
};

/**
 * Pill filter toolbar for the network feed. Kind pill aktif = hitam
 * (btn-brutal); counter = total DB per kind. Input wallet kanan =
 * langsung set focus mode (bukan navigasi URL).
 */
export function ActivityToolbar({
  kind,
  counts,
  onKindChange,
  onFocusWallet,
}: {
  kind: FeedKind;
  counts: { all: number; attestation: number; vouch: number; dispute: number; claim: number };
  onKindChange: (kind: FeedKind) => void;
  onFocusWallet: (address: string) => void;
}) {
  const [walletInput, setWalletInput] = useState("");
  const [invalid, setInvalid] = useState(false);

  const submitWallet = () => {
    const value = walletInput.trim().toLowerCase();
    if (!ADDRESS_RE.test(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setWalletInput("");
    onFocusWallet(value);
  };

  return (
    <div>
      <nav aria-label="Activity filters">
        <ul className="flex flex-wrap gap-2" role="list">
          {FEED_KINDS.map((id) => {
            const selected = id === kind;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onKindChange(id)}
                  aria-pressed={selected}
                  className={
                    selected
                      ? "btn-brutal inline-flex items-center gap-2 px-4 py-2 text-sm"
                      : "inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white px-4 py-2 text-sm text-ink transition hover:border-ink"
                  }
                >
                  {LABELS[id]}
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      selected ? "text-white/70" : "text-slate400"
                    }`}
                  >
                    {counts[id]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submitWallet();
        }}
        className="group relative mt-3 max-w-md"
      >
        <label className="sr-only" htmlFor="activity-wallet-filter">
          Filter by wallet
        </label>
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate400 transition group-focus-within:text-ink">
          <svg
            className="h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          id="activity-wallet-filter"
          value={walletInput}
          onChange={(event) => {
            setWalletInput(event.target.value);
            setInvalid(false);
          }}
          placeholder="Filter by wallet..."
          aria-invalid={invalid}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="search"
          className={`h-10 w-full rounded-full border bg-white pl-10 pr-3 font-mono text-xs text-ink shadow-brutal-sm outline-none transition placeholder:font-sans placeholder:text-slate400 hover:border-black/25 focus:border-ink/50 focus:ring-2 focus:ring-accent/25 ${
            invalid ? "border-accent" : "border-black/15"
          }`}
        />
        {invalid && (
          <p
            role="alert"
            className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-full bg-white px-3 py-1 font-mono text-[11px] text-red-600 shadow-lg"
          >
            That doesn&apos;t look like a valid 0x address.
          </p>
        )}
      </form>
    </div>
  );
}
