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
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
          Recently checked
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
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate400">
          No wallets checked yet. Search a wallet to start building your
          history.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.address}>
              <Link
                href={`/wallets/${item.address}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-ink bg-white px-4 py-3 text-sm shadow-[2px_2px_0_#0b0f17] transition hover:-translate-y-px"
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
                  Open →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
