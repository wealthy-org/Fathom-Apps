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
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void handleShare()}
        className="btn-brutal-light px-3 py-2 text-xs sm:px-4 sm:text-sm"
      >
        Share reputation
      </button>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="px-2 py-2 font-mono text-[11px] text-slate400 underline hover:text-ink"
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
