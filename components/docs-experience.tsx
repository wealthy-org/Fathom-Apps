"use client";

import { useEffect, useRef, useState } from "react";
import { DocsCode } from "@/components/docs-code";
import {
  DocsPlayground,
  type DocsPlaygroundHandle,
} from "@/components/docs-playground";

const DEFAULT_INPUT_ADDRESS = "0x71c4e2a9b30d18f6a5e7c4b2d91f04a83b6c4a3f";

const TOC = [
  { id: "playground", label: "Playground" },
  { id: "endpoint", label: "Endpoint" },
  { id: "fields", label: "Response fields" },
  { id: "errors", label: "Errors" },
  { id: "limits", label: "Limits & notes" },
  { id: "build", label: "Build with it" },
  { id: "changelog", label: "Changelog" },
];

const FACTS = [
  { label: "Access", value: "Read-only" },
  { label: "Auth", value: "No API key" },
  { label: "Browsers", value: "CORS-open" },
  { label: "Edge cache", value: "60 seconds" },
  { label: "Coverage", value: "Robinhood Testnet" },
];

/** 17 field nyata dari GET /api/reputation/{address} — nullability akurat. */
const FIELDS: Array<{
  name: string;
  type: string;
  nullable: boolean;
  desc: string;
}> = [
  {
    name: "address",
    type: "string",
    nullable: false,
    desc: "Lowercase wallet address — the identity this whole object describes.",
  },
  {
    name: "walletAgeDays",
    type: "number",
    nullable: true,
    desc: "Days since the wallet's first indexed activity. null = not indexed yet.",
  },
  {
    name: "uniqueCounterparties",
    type: "number",
    nullable: true,
    desc: "Distinct wallets this address has transacted with. null = graph walk incomplete.",
  },
  {
    name: "repeatCounterparties",
    type: "number",
    nullable: true,
    desc: "How many of those relationships repeat. null = graph walk incomplete.",
  },
  {
    name: "attestations",
    type: "number",
    nullable: false,
    desc: "Signed role attestations received. Zero is a real, confirmed zero.",
  },
  {
    name: "activeDisputes",
    type: "number",
    nullable: false,
    desc: "Open disputes on the public record. Zero is a real, confirmed zero.",
  },
  {
    name: "riskSignals",
    type: "RiskSignal[]",
    nullable: false,
    desc: "Detected risk signals with severity — evidence, not a verdict.",
  },
  {
    name: "riskLevel",
    type: "string",
    nullable: true,
    desc: "low | medium | high, derived from riskSignals. null = risk sources not evaluable.",
  },
  {
    name: "proofs",
    type: "Proof[]",
    nullable: false,
    desc: "Reproducible proof objects, each with an evidence reference you can inspect.",
  },
  {
    name: "claim",
    type: "object",
    nullable: true,
    desc: "{ status, claimedAt } when the owner proved ownership. null = unclaimed.",
  },
  {
    name: "vouches",
    type: "Vouch[]",
    nullable: true,
    desc: "On-chain stake-backed vouches. null = vouch index has not run. Empty = confirmed zero.",
  },
  {
    name: "vouchesCount",
    type: "number",
    nullable: true,
    desc: "Length of vouches, null for the same reason.",
  },
  {
    name: "dimensions",
    type: "Dimension[]",
    nullable: false,
    desc: "Per-dimension contributions with evidence references and explanations.",
  },
  {
    name: "score",
    type: "number",
    nullable: true,
    desc: "Compressed reputation score, 0–1000. Provisional — inspect the evidence.",
  },
  {
    name: "tier",
    type: "object",
    nullable: true,
    desc: "{ id, label }: new, emerging, established or exceptional. null = not enough evidence.",
  },
  {
    name: "formulaVersion",
    type: "string",
    nullable: false,
    desc: "Scoring formula version that produced this object (audit field).",
  },
  {
    name: "completeness",
    type: "string",
    nullable: false,
    desc: "complete | partial | unavailable — how much evidence could be evaluated.",
  },
];

const ERRORS = [
  {
    status: "400",
    code: "invalid_address",
    message: "Address must be a valid EVM address.",
  },
  {
    status: "405",
    code: "method_not_allowed",
    message: "Only GET (and CORS preflight OPTIONS) are served.",
  },
  {
    status: "500",
    code: "server_error",
    message: "Wallet data is temporarily unavailable.",
  },
];

const BUILD_CARDS = [
  {
    title: "Wallet badge",
    desc: "Show the tier label anywhere a wallet appears.",
    code: 'const badge = profile.tier?.label ?? "Unrated";',
  },
  {
    title: "Access gate",
    desc: "Let wallets with enough peer attestations into gated spaces.",
    code: "const allowed = profile.attestations >= 3;",
  },
  {
    title: "Pre-trade check",
    desc: "Surface open disputes before a trade, never after.",
    code: "const blocked = profile.activeDisputes > 0;",
  },
];

const CHANGELOG = [
  {
    version: "1.1.0-provisional",
    note: "Added riskLevel and vouchesCount; conservative calibration floors.",
  },
  {
    version: "1.0.0",
    note: "Initial public shape: score, tier, proofs, dimensions, completeness.",
  },
];

function SectionHead({
  no,
  title,
  sub,
}: {
  no: string;
  title: React.ReactNode;
  sub: string;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
        {no}
      </p>
      <h2 className="mt-3 max-w-2xl font-serif-accent text-3xl leading-tight text-ink sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate400 sm:text-base">
        {sub}
      </p>
    </div>
  );
}

function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
    // ids stabil (konstanta modul).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return active;
}

/**
 * Developer experience page untuk /docs (Phase 11). Semua konten dari
 * data array di file ini; playground fetch nyata; sample hero dikirim
 * dari server (data sungguhan EXAMPLE_WALLET).
 */
export function DocsExperience({ sampleCode }: { sampleCode: string }) {
  const playgroundRef = useRef<DocsPlaygroundHandle | null>(null);
  const active = useActiveSection(TOC.map((item) => item.id));

  const tryAnAddress = () => {
    document
      .getElementById("playground")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    playgroundRef.current?.focusInput();
  };

  const runFromCta = (raw: string) => {
    document
      .getElementById("playground")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    playgroundRef.current?.run(raw);
  };

  const [selectedField, setSelectedField] = useState(0);
  const [selectedError, setSelectedError] = useState(0);
  const [ctaAddress, setCtaAddress] = useState("");

  const field = FIELDS[selectedField];
  const error = ERRORS[selectedError];

  return (
    <div className="relative">
      {/* Grid 44px samar, fade radial — ala landing canvas. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(35,36,39,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(35,36,39,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 75%)",
        }}
      />

      {/* HERO */}
      <header className="grid items-center gap-10 pt-10 lg:grid-cols-2 lg:pt-16">
        <div>
          <span className="chip-mono gap-1.5 text-slate400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
            Reputation API
          </span>
          <h1 className="mt-6 font-serif-accent text-4xl leading-tight text-ink sm:text-5xl lg:text-6xl">
            Query any wallet&apos;s <span className="bg-accent text-white">proof of reputation</span>.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate400">
            One GET returns the evidence behind a wallet: score, tier, proofs,
            counterparties, attestations, risk. Read-only, no key, CORS-open —
            built for browsers.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={tryAnAddress}
              className="btn-brutal bg-accent px-6 py-2.5 text-sm hover:bg-accent-ink"
            >
              Try an address
            </button>
            <a
              href="#endpoint"
              className="btn-brutal-light px-6 py-2.5 text-sm"
            >
              View endpoint
            </a>
          </div>
        </div>
        <DocsCode
          badge="GET"
          title="/api/reputation/{address}"
          status="200 · 38 ms"
          code={sampleCode}
          bodyClassName="max-h-[420px]"
          className="min-w-0"
        />
      </header>

      {/* FACT STRIP */}
      <ul
        className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-ink/10 bg-ink/10 sm:grid-cols-3 lg:grid-cols-5"
        role="list"
      >
        {FACTS.map((fact) => (
          <li key={fact.label} className="bg-white p-5">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-slate400">
              {fact.label}
            </p>
            <p className="mt-1.5 font-serif-accent text-2xl text-ink">
              {fact.value}
            </p>
          </li>
        ))}
      </ul>

      {/* BODY: TOC + sections */}
      <div className="mt-14 flex flex-col gap-10 lg:flex-row">
        <nav
          aria-label="On this page"
          className="shrink-0 lg:sticky lg:top-28 lg:w-[200px] lg:self-start"
        >
          <ul
            className="hidden flex-col gap-1 border-l border-ink/10 lg:flex"
            role="list"
          >
            {TOC.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={active === item.id ? "true" : undefined}
                  className={`-ml-px block border-l-2 py-1.5 pl-4 font-mono text-xs transition ${
                    active === item.id
                      ? "border-ink font-medium text-ink"
                      : "border-transparent text-slate400 hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.09em] ${
                  active === item.id
                    ? "border-ink bg-ink text-white"
                    : "border-ink/20 bg-white text-slate400"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {/* 01 PLAYGROUND */}
          <section id="playground" className="scroll-mt-28">
            <SectionHead
              no="01 · Playground"
              title={
                <>
                  Send a request, <span className="bg-accent text-white">see the evidence</span>.
                </>
              }
              sub="Real calls against Robinhood Testnet. Try the sample, an invalid address, or an unknown wallet — each shows what the API actually returns."
            />
            <div className="mt-7">
              <DocsPlayground
                ref={playgroundRef}
                defaultAddress={DEFAULT_INPUT_ADDRESS}
              />
            </div>
          </section>

          {/* 02 ENDPOINT */}
          <section id="endpoint" className="mt-20 scroll-mt-28">
            <SectionHead
              no="02 · Endpoint"
              title={
                <>
                  One route, <span className="bg-accent text-white">one wallet</span>.
                </>
              }
              sub="No endpoints per resource, no pagination, no keys. The wallet address is the only parameter — replace the path segment and go."
            />
            <DocsCode
              className="mt-7"
              badge="GET"
              title="request.http"
              code={`GET /api/reputation/{address}`}
            />
            <p className="mt-3 text-sm leading-6 text-slate400">
              Addresses are matched case-insensitively and normalized to
              lowercase. Unknown wallets still return{" "}
              <span className="font-mono">200</span> — fields that cannot be
              evaluated are <span className="font-mono">null</span>, never
              fabricated.
            </p>
          </section>

          {/* 03 FIELDS */}
          <section id="fields" className="mt-20 scroll-mt-28">
            <SectionHead
              no="03 · Response fields"
              title={
                <>
                  Click any field to <span className="bg-accent text-white">decode it</span>.
                </>
              }
              sub="Seventeen fields, two honest null rules: null means unknown, and a confirmed zero is a real zero."
            />
            <div className="mt-7 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div className="overflow-hidden rounded-2xl bg-coal">
                <div className="border-b border-white/10 px-4 py-2.5 font-mono text-[11px] text-white/60">
                  response.json — 17 fields
                </div>
                <ul className="overflow-x-auto p-2" role="list">
                  {FIELDS.map((item, index) => (
                    <li key={item.name}>
                      <button
                        type="button"
                        onClick={() => setSelectedField(index)}
                        aria-pressed={selectedField === index}
                        className={`flex w-full items-baseline gap-2 rounded-lg px-3 py-1.5 text-left font-mono text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                          selectedField === index
                            ? "bg-white/10"
                            : "hover:bg-white/5"
                        }`}
                        style={
                          selectedField === index
                            ? { borderLeft: "2px solid #D7FF45" }
                            : { borderLeft: "2px solid transparent" }
                        }
                      >
                        <span style={{ color: "#D7FF45" }}>{item.name}</span>
                        <span style={{ color: "#8B8A80" }}>:</span>
                        <span style={{ color: "#F0B45A" }}>{item.type}</span>
                        {!item.nullable && (
                          <span
                            className="ml-auto hidden shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] sm:inline"
                            style={{ color: "#8B8A80" }}
                          >
                            never null
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:sticky lg:top-28 lg:self-start">
                <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-[0_14px_30px_-18px_rgba(35,36,39,0.25)]">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
                    Field {selectedField + 1} of {FIELDS.length}
                  </p>
                  <p className="mt-2 font-mono text-xl text-ink">
                    {field.name}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="chip-mono text-slate400">
                      {field.type}
                    </span>
                    {field.nullable ? (
                      <span className="chip-mono text-accent-ink">
                        nullable
                      </span>
                    ) : (
                      <span className="chip-mono text-slate400">
                        never null
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate400">
                    {field.desc}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-2xl bg-coal px-6 py-5">
              <p className="font-serif-accent text-xl text-white">
                null means unknown. Never treat it as zero.
              </p>
            </div>
          </section>

          {/* 04 ERRORS */}
          <section id="errors" className="mt-20 scroll-mt-28">
            <SectionHead
              no="04 · Errors"
              title={
                <>
                  Errors that <span className="bg-accent text-white">tell you why</span>.
                </>
              }
              sub="Three failure modes, one shape. Click a card to see its exact body."
            />
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {ERRORS.map((item, index) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setSelectedError(index)}
                  aria-pressed={selectedError === index}
                  className={`rounded-2xl border p-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    selectedError === index
                      ? "border-ink bg-white shadow-[0_14px_30px_-18px_rgba(35,36,39,0.25)]"
                      : "border-ink/10 bg-white/60 hover:border-ink/40"
                  }`}
                >
                  <span
                    className={`font-mono text-2xl ${
                      item.status === "500" ? "text-accent-ink" : "text-ink"
                    }`}
                  >
                    {item.status}
                  </span>
                  <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
                    {item.code}
                  </span>
                </button>
              ))}
            </div>
            <DocsCode
              className="mt-5"
              title="error.json"
              code={JSON.stringify(
                { error: { code: error.code, message: error.message } },
                null,
                2,
              )}
            />
            <p className="mt-3 text-sm text-slate400">
              Always this shape. Never a stack trace.
            </p>
          </section>

          {/* 05 LIMITS */}
          <section id="limits" className="mt-20 scroll-mt-28">
            <SectionHead
              no="05 · Limits & notes"
              title={
                <>
                  Read before you <span className="bg-accent text-white">ship</span>.
                </>
              }
              sub="Four things that keep integrations honest."
            />
            <ul className="mt-7 grid gap-3 sm:grid-cols-2" role="list">
              {(
                [
                  [
                    "No key, no enforced limits",
                    "No API key required. No rate limits yet — be reasonable, responses cache at the edge for 60 seconds.",
                    false,
                  ],
                  [
                    "Testnet only",
                    "Coverage is Robinhood Chain Testnet (chain 46630). Scores reset between testnet and mainnet.",
                    false,
                  ],
                  [
                    "A score is not a verdict",
                    "The number is provisional compression over evidence. Surface proofs and risk signals in your own UI before users act on it.",
                    true,
                  ],
                  [
                    "Null is not zero",
                    "Fields that cannot be evaluated return null. Treat unknown as unknown — never as a confirmed zero.",
                    false,
                  ],
                ] as Array<[string, string, boolean]>
              ).map(([title, body, warn]) => (
                <li
                  key={title}
                  className={`rounded-2xl border border-ink/10 bg-white p-5 shadow-[0_8px_20px_-12px_rgba(35,36,39,0.25)] ${
                    warn ? "border-l-[3px] border-l-accent" : ""
                  }`}
                >
                  <p className="font-display text-base text-ink">{title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate400">
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* 06 BUILD */}
          <section id="build" className="mt-20 scroll-mt-28">
            <SectionHead
              no="06 · Build with it"
              title={
                <>
                  What you can <span className="bg-accent text-white">build</span>.
                </>
              }
              sub="Three lines each — badge, gate, check. All read-only, all from the same response."
            />
            <div className="mt-7 grid gap-4 lg:grid-cols-3">
              {BUILD_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="flex flex-col rounded-2xl border border-ink/10 bg-white p-5 shadow-[0_8px_20px_-12px_rgba(35,36,39,0.25)]"
                >
                  <p className="font-display text-base text-ink">
                    {card.title}
                  </p>
                  <p className="mt-1.5 flex-1 text-sm leading-6 text-slate400">
                    {card.desc}
                  </p>
                  <DocsCode
                    className="mt-4"
                    title="app.js"
                    language="js"
                    code={card.code}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 07 CHANGELOG */}
          <section id="changelog" className="mt-20 scroll-mt-28">
            <SectionHead
              no="07 · Changelog"
              title={
                <>
                  The formula <span className="bg-accent text-white">tells you</span> what changed.
                </>
              }
              sub="Every response carries formulaVersion, so your integration can react to calibration changes."
            />
            <ol
              className="mt-7 space-y-6 border-l border-ink/10 pl-6"
              role="list"
            >
              {CHANGELOG.map((entry, index) => (
                <li key={entry.version} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-canvas"
                    style={{
                      backgroundColor: index === 0 ? "#e34a32" : "#777980",
                    }}
                  />
                  <p className="font-mono text-sm text-ink">{entry.version}</p>
                  <p className="mt-1 text-sm leading-6 text-slate400">
                    {entry.note}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* CTA */}
          <section className="mt-20 rounded-[2.5rem] bg-coal px-6 py-12 text-center sm:px-10">
            <h2 className="mx-auto max-w-2xl font-serif-accent text-3xl leading-tight text-white sm:text-4xl">
              Check a wallet <span className="bg-accent text-white">before you trust it</span>.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/60">
              Paste any address — the playground above runs it for real.
            </p>
            <form
              className="mx-auto mt-6 flex max-w-xl flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                if (ctaAddress.trim() !== "") runFromCta(ctaAddress.trim());
              }}
            >
              <input
                value={ctaAddress}
                onChange={(event) => setCtaAddress(event.target.value)}
                spellCheck={false}
                aria-label="Wallet address"
                placeholder="0x…"
                className="h-12 min-w-0 flex-1 rounded-2xl border border-white/20 bg-white/5 px-4 font-mono text-sm text-white outline-none transition placeholder:text-white/40 focus:border-white/50 focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="submit"
                className="btn-brutal h-12 shrink-0 bg-accent px-7 text-sm hover:bg-accent-ink"
              >
                Try
              </button>
            </form>
          </section>

          <footer className="mt-10 border-t border-ink/10 pt-5">
            <div className="mt-4 grid gap-2 border-t border-ink/10 pt-3 md:grid-cols-2 md:items-center">
              <div className="text-xs leading-4 text-slate400">
                © 2026 Fathom
              </div>

              <p className="text-xs leading-4 text-slate400 md:text-right">
                Built for pseudonymous economic identities.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
