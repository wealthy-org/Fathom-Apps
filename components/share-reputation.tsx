"use client";

import { useState } from "react";
import { profileUrl } from "@/lib/wallet/profile-url";
import type { Address } from "@/lib/score/types";

/**
 * Share Reputation control (client-only, no auth required).
 *
 * Shares the canonical wallet profile URL — the OG card unfurls
 * automatically from it, so there is exactly one share URL. Uses the
 * native Web Share API when available, clipboard fallback otherwise.
 * Absolute URL comes from the current origin; nothing is hardcoded.
 */

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ShareReputation({
  address,
  totalScore,
  tierLabel,
}: {
  address: Address;
  totalScore: number;
  tierLabel: string | null;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  const url = () =>
    `${window.location.origin}${profileUrl(address)}`;
  const text = () =>
    `Know the wallet before you trust it. ${shortAddress(address)} — Fathom Score ${totalScore}${tierLabel ? ` (${tierLabel})` : ""}.`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url());
      setNotice("Profile link copied.");
      // ponytail: auto-hilang seperti "Copied" — notice bukan isi permanen.
      window.setTimeout(() => setNotice(null), 2000);
    } catch {
      setNotice("Copy failed — long-press the address instead.");
    }
  }

  async function handleShare() {
    setNotice(null);
    const data = {
      title: `Fathom — ${shortAddress(address)}`,
      text: text(),
      url: url(),
    };
    if (
      typeof navigator.share === "function" &&
      navigator.canShare?.(data)
    ) {
      try {
        await navigator.share(data);
      } catch {
        // User dismissed the sheet — not an error worth surfacing.
      }
      return;
    }
    await copyLink();
  }

  return (
    <span className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        onClick={() => void handleShare()}
        className="btn-brutal-light min-touch w-full px-4 py-2 text-xs sm:w-auto"
      >
        Share reputation
      </button>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="btn-brutal-light min-touch w-full px-4 py-2 text-xs sm:w-auto"
      >
        Copy link
      </button>
      {notice && (
        <span role="status" className="font-mono text-[11px] text-slate400">
          {notice}
        </span>
      )}
    </span>
  );
}
