"use client";

import { useState } from "react";
import { LandingSectionHead } from "./landing-section-head";

/**
 * Section 07 — Integrate. Product first, protocol underneath: the read-only
 * reputation API request/response as dark code blocks, plus stack cards.
 * CodeCard is not reused because its tokenizer colors target light surfaces.
 */

const ENDPOINT = `# Reputation API — read-only, no key required
curl https://app.fathom.example/api/reputation/0x71c4e296e6833d211278faf255c76ed193c9ac19`;

const RESPONSE = `{
  "address": "0x71c4e296e6833d211278faf255c76ed193c9ac19",
  "score": 812,
  "tier": { "id": "established", "label": "Established" },
  "walletAgeDays": 876,
  "uniqueCounterparties": 148,
  "repeatCounterparties": 31,
  "attestations": 4,
  "activeDisputes": 0,
  "riskLevel": "low",
  "formulaVersion": "1.1.0-provisional"
}`;

/** Split one code line into colorable tokens (spaces stay separate items). */
function tokenize(line: string): string[] {
  return line
    .split(/(\s+|"[^"]*"?|[{}:,]|https?:\/\/\S+)/)
    .filter((part) => part !== "");
}

function CodeBlock({
  title,
  code,
}: {
  title: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permission / insecure context) — keep quiet.
    }
  }

  return (
    <div className="rounded-3xl bg-coal">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
          {title}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="h-2 w-2 rounded-full bg-accent/70" />
          </span>
          <button
            type="button"
            onClick={copy}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60 transition hover:border-white/30 hover:text-white"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="min-w-0 p-5 font-mono text-xs leading-6 text-mist">
        <code>
          {code.split("\n").map((line, i) => {
            if (line.trimStart().startsWith("#")) {
              return (
                <span key={i} className="block text-white/40">
                  {line}
                </span>
              );
            }
            const parts = tokenize(line);
            if (parts.length === 0) {
              return <span key={i} className="block" />;
            }
            return (
              <span key={i} className="flex flex-wrap">
                {parts.map((part, j) => {
                  if (/^\s+$/.test(part)) {
                    return (
                      <span key={j} className="whitespace-pre">
                        {part}
                      </span>
                    );
                  }
                  if (part.startsWith('"')) {
                    const next = parts
                      .slice(j + 1)
                      .find((p) => !/^\s+$/.test(p));
                    return (
                      <span
                        key={j}
                        className={next === ":" ? "text-sky-300" : "text-emerald-300"}
                      >
                        {part}
                      </span>
                    );
                  }
                  if (part.startsWith("http")) {
                    return (
                      <span
                        key={j}
                        className="whitespace-normal break-all text-sky-300 [overflow-wrap:anywhere]"
                      >
                        {part}
                      </span>
                    );
                  }
                  if (/^[{}:,]$/.test(part)) {
                    return (
                      <span key={j} className="text-white/50">
                        {part}
                      </span>
                    );
                  }
                  if (part === "curl") {
                    return (
                      <span key={j} className="font-semibold text-white">
                        {part}
                      </span>
                    );
                  }
                  if (/^\d+$/.test(part)) {
                    return (
                      <span key={j} className="text-emerald-300">
                        {part}
                      </span>
                    );
                  }
                  return <span key={j}>{part}</span>;
                })}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

const STACK_CARDS = [
  {
    title: "Phase 11 — Reputation API",
    body: "Read-only, no key, CORS-open. Shaped for wallets, marketplaces, and DAOs.",
  },
  {
    title: "Contracts",
    body: "Fathom registry on Robinhood Chain — vouches, attestations, disputes.",
  },
  {
    title: "Stack",
    body: "Next.js · PostgreSQL · Drizzle · Foundry · viem.",
  },
  {
    title: "Status",
    body: "Live on testnet 46630. Deterministic engine, stable response shape.",
  },
];

export function LandingIntegrate() {
  return (
    <section id="integrate" className="px-6 py-20 sm:py-24 lg:px-10 xl:px-12">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHead
          title="Product first. Protocol underneath."
          sub="Everything the product shows is reachable over a plain read-only API. No key, no SDK lock-in, no hidden endpoints."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <CodeBlock title="Request" code={ENDPOINT} />
          <CodeBlock title="Response · 200 OK" code={RESPONSE} />
        </div>

        {/* <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STACK_CARDS.map((card) => (
            <div key={card.title} className="card panel-brutal p-5">
              <h3 className="font-display text-base text-ink">
                {card.title}
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-slate400">
                {card.body}
              </p>
            </div>
          ))}
        </div> */}
      </div>
    </section>
  );
}
