"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { recordRecentSearch } from "@/lib/wallet/search-history";
import { normalizeAddress } from "@/lib/chain/address";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function Arrow() {
  return (
    <svg
      className="transition-transform duration-300 group-hover:translate-x-1"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function SearchWalletForm({
  hint = true,
  size = "md",
}: {
  hint?: boolean;
  size?: "md" | "sm";
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = useId();
  const errorId = useId();

  function submit() {
    if (isPending) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a wallet address.");
      return;
    }
    if (!ADDRESS_RE.test(trimmed)) {
      setError("That doesn't look like a valid 0x address.");
      return;
    }
    setError(null);
    // History records validated checks only — invalid input never reaches here.
    recordRecentSearch(trimmed);
    // Phase 0 instrumentation — analytics must never break search flow.
    // own_wallet_checked fires from OwnWalletTracker inside WagmiProvider
    // (SearchWalletForm also renders on landing, outside any provider).
    try {
      const normalized = normalizeAddress(trimmed);
      trackEvent(ANALYTICS_EVENTS.walletSearched, { address: normalized });
    } catch {
      // Invalid address already rejected above; analytics stays silent.
    }
    // ponytail: transition pending disables the form — no duplicate submit.
    startTransition(() => {
      router.push(`/wallets/${trimmed.toLowerCase()}`);
    });
  }

  const compact = size === "sm";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="w-full"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
        <label htmlFor={inputId} className="sr-only">
          Wallet address
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          disabled={isPending}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="0x..."
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          inputMode="text"
          enterKeyHint="search"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`input-brutal min-touch min-w-0 flex-1 font-mono ${
            compact ? "h-11 px-4 text-base sm:text-xs" : "h-12 px-5 text-base sm:text-sm"
          }`}
        />
        <button
          type="submit"
          disabled={isPending}
          className={`btn-brutal group min-touch w-full shrink-0 sm:w-auto ${
            compact ? "h-11 px-4 text-sm sm:text-xs" : "h-12 px-6 text-sm"
          }`}
        >
          {isPending ? "Searching…" : compact ? "Search" : "Search a Wallet"}
          {!isPending && <Arrow />}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 font-mono text-xs text-red-600">
          {error}
        </p>
      )}
      {hint && (
        <p className="mt-3 text-xs text-slate400">
          No account required. Enter any wallet address to inspect it.
        </p>
      )}
    </form>
  );
}
