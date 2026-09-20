"use client";

import { useState } from "react";

export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard diblokir — address tetap terlihat penuh di halaman.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded-full border border-black/10 bg-white px-4 py-1.5 font-mono text-xs text-slate400 shadow-sm transition hover:text-ink"
    >
      {copied ? "Copied" : "Copy address"}
    </button>
  );
}
