"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Copy address to clipboard — small client island inside the server hero.
 * Shows "Copied ✓" for 2s, then reverts.
 */
export function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions/http) — leave state untouched.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="btn-brutal-light px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em]"
    >
      {copied ? "Copied ✓" : "Copy address"}
    </button>
  );
}
