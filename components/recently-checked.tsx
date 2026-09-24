"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  clearRecentSearches,
  getRecentSearchesServerSnapshot,
  getRecentSearchesSnapshot,
  relativeTime,
  subscribeRecentSearches,
} from "@/lib/wallet/search-history";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const EXAMPLES: Array<[string, string]> = [
  ["0xa6d9e296e6833d211278faf255c76ed193c9ac19", "Active wallet"],
  ["0x1111111111111111111111111111111111111112", "Fresh wallet"],
  ["0x000000000000000000000000000000000000dead", "Busy wallet (truncated walk)"],
];

export function RecentlyChecked() {
  // ponytail: mount gate — SSR/first render identical (null), store after mount.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const items = useSyncExternalStore(
    subscribeRecentSearches,
    getRecentSearchesSnapshot,
    getRecentSearchesServerSnapshot,
  );

  if (!mounted) return null;

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
          On this device
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => clearRecentSearches()}
            className="font-mono text-[11px] text-slate400 underline hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate400">
        Your private search history, stored only in this browser.{" "}
        <Link href="/activity" className="underline hover:text-ink">
          See public activity
        </Link>
      </p>
      {items.length === 0 ? (
        <div>
          <p className="mt-3 text-sm text-slate400">
            No wallets checked yet. Try an example wallet:
          </p>
          <ul className="mt-4 space-y-2">
            {EXAMPLES.map(([address, label]) => (
              <li key={address}>
                <Link
                  href={`/wallets/${address}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-ink/80 shadow-sm transition hover:-translate-y-px"
                >
                  <span className="font-mono text-accent-ink">
                    {shortAddress(address)}
                  </span>
                  <span className="text-xs text-slate400">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.address}>
              <Link
                href={`/wallets/${item.address}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm shadow-sm transition hover:-translate-y-px"
              >
                <span>
                  <span className="font-mono text-accent-ink">
                    {shortAddress(item.address)}
                  </span>
                  <span className="ml-3 text-xs text-slate400">
                    Checked {relativeTime(item.at)}
                  </span>
                </span>
                <span className="text-xs font-medium text-ink/70">
                  Open
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
