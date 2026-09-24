"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { normalizeAddress, ADDRESS_RE } from "@/lib/chain/address";
import { recordRecentSearch } from "@/lib/wallet/search-history";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-slate400"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/**
 * Inline search untuk navbar — validasi + redirect identik dengan
 * SearchWalletForm hero (regex, history, analytics, /wallets/{address}).
 * Lebar terbatas; di layar sempit (< md) collapse jadi ikon menuju /wallets.
 */
export function NavbarSearch() {
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
    recordRecentSearch(trimmed);
    try {
      const normalized = normalizeAddress(trimmed);
      trackEvent(ANALYTICS_EVENTS.walletSearched, { address: normalized });
    } catch {
      // Invalid address already rejected above; analytics stays silent.
    }
    startTransition(() => {
      router.push(`/wallets/${trimmed.toLowerCase()}`);
    });
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="group relative hidden w-52 min-w-0 md:block lg:w-64"
        role="search"
      >
        <label htmlFor={inputId} className="sr-only">
          Search a wallet
        </label>
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate400 transition group-focus-within:text-ink">
          <SearchIcon />
        </span>
        <input
          id={inputId}
          type="text"
          value={value}
          disabled={isPending}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Search a wallet..."
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="search"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-10 w-full rounded-full border border-black/15 bg-white pl-10 pr-3 font-mono text-xs text-ink shadow-brutal-sm outline-none transition placeholder:font-sans placeholder:text-slate400 hover:border-black/25 focus:border-ink/50 focus:ring-2 focus:ring-accent/25"
        />
        {error && (
          <p
            id={errorId}
            role="alert"
            className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-full bg-white px-3 py-1 font-mono text-[11px] text-red-600 shadow-lg"
          >
            {error}
          </p>
        )}
      </form>
      <Link
        href="/wallets"
        aria-label="Search a wallet"
        className="inline-flex min-touch items-center justify-center rounded-full p-2 text-slate400 transition hover:text-ink md:hidden"
      >
        <SearchIcon />
      </Link>
    </>
  );
}
