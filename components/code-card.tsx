"use client";

import { useState } from "react";

/**
 * Code snippet card with filename/language header + Copy button.
 * Reused on the landing #api section and the /docs page.
 */
export function CodeCard({
  title,
  language,
  code,
}: {
  title: string;
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="panel-brutal overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-xs font-medium text-ink">
            {title}
          </span>
          <span className="chip-mono shrink-0 text-slate400">{language}</span>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-full border border-ink/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/70 transition hover:text-ink"
          aria-live="polite"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-black/5 p-4 font-mono text-xs leading-6 text-ink">
        {code}
      </pre>
    </div>
  );
}
