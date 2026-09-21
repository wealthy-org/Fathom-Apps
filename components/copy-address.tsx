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
      className="btn-brutal-light px-4 py-2 text-xs"
    >
      {copied ? "Copied" : "Copy address"}
    </button>
  );
}
