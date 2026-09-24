"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { LandingActivitySnippet } from "@/components/landing-activity-snippet";
import { CodeCard } from "@/components/code-card";
import { Logo, Navbar } from "@/components/layout/Navbar";

const NAV_LINKS: Array<[string, string]> = [
  ["About", "#about"],
  ["How It Works", "#how"],
  ["FAQ", "#faq"],
  ["Activity", "/activity"],
  ["Docs", "/docs"],
];

/** Public example wallet reused by /wallets — footer deep-links to its tabs. */
const EXAMPLE_WALLET = "0xa6d9e296e6833d211278faf255c76ed193c9ac19";

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function Head({
  title,
  sub,
}: {
  title: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="animate-title max-w-2xl">
      <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
        {title}
      </h2>
      {sub && <p className="mt-5 text-base leading-7 text-slate400">{sub}</p>}
    </div>
  );
}

function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className="btn-brutal group px-6 py-3.5 text-sm">
      {children}
      <Arrow className="transition-transform duration-300 group-hover:translate-x-1" />
    </a>
  );
}

const HOW_STEPS: Array<[string, string, string]> = [
  [
    "01 — Check a wallet",
    "Search any public wallet address.",
    "No account needed. Anyone can inspect public wallet evidence.",
  ],
  [
    "02 — Analyze",
    "Fathom organizes available wallet, economic, relationship, and risk evidence.",
    "History, counterparties, attestations, and detected risk patterns.",
  ],
  [
    "03 — Explore evidence",
    "Inspect proofs, relationships, reputation dimensions, and risk signals.",
    "Every claim traces back to indexed evidence and raw sources.",
  ],
  [
    "04 — Decide",
    "Use the evidence and context to make your own decision.",
    "Fathom provides context. The trust decision stays yours.",
  ],
];

const FAQ: Array<[string, string]> = [
  [
    "What is Fathom?",
    "Fathom provides reputation evidence for pseudonymous wallets. It turns wallet history, economic behavior, relationships, attestations, and risk signals into verifiable, explainable evidence — so you can know a wallet before you trust it.",
  ],
  [
    "What does Fathom analyze?",
    "Available wallet history, economic behavior, counterparty relationships, structured attestations and vouches, and explainable risk signals. Everything shown traces back to indexed evidence.",
  ],
  [
    "Does Fathom know who owns a wallet?",
    "No. Fathom is pseudonymous by default and evaluates economic identity — what a wallet did — rather than requiring real-world identity. A wallet address is the identity object; no name, email, or ID is ever required.",
  ],
  [
    "Does claiming a profile create reputation?",
    "No. Claiming only proves control of the wallet address through a signed message. It does not create, increase, or modify reputation, which comes from wallet evidence alone.",
  ],
  [
    "Is the Fathom Score a guarantee that a wallet is trustworthy?",
    "No. The score is a provisional compression of the available evidence — not a verdict. Always inspect the underlying dimensions, proofs, and risk context before deciding.",
  ],
  [
    "Can I search a wallet without connecting my wallet?",
    "Yes. Public wallet inspection requires no ownership and no authentication. Connecting is only needed to claim your own profile or to attest and vouch.",
  ],
  [
    "What happens when some data is unavailable?",
    "Fathom says so explicitly — unavailable, incomplete, or not-indexed evidence is labeled as such and never treated as zero. Missing data stays missing, not silent.",
  ],
];

export default function Home() {
  useLayoutEffect(() => {
    // Gate yang sama dengan components/loading-stages.tsx: reduced motion =
    // konten tampil penuh, tanpa animasi GSAP / ScrollTrigger.
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Title stagger — eyebrow / headline / copy masuk berurutan.
      gsap.utils.toArray<HTMLElement>(".animate-title").forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1.2,
            delay: i * 0.08,
            ease: "power3.out",
          },
        );
      });

      // Card scroll reveal.
      gsap.utils.toArray<HTMLElement>(".card").forEach((card) => {
        gsap.fromTo(
          card,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          },
        );
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="font-sans text-ink">
      <Navbar
        links={NAV_LINKS}
        actions={
          <Link
            href="/wallets"
            className="btn-brutal w-full px-5 py-2.5 text-sm md:w-auto"
          >
            Check a Wallet
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-8">
        <main id="main-content" className="relative z-10">
        {/* HERO */}
        <section className="px-6 pb-20 pt-14 sm:pt-20 lg:px-10 lg:py-28 xl:px-12">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="animate-title mb-7 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                Live on Robinhood Chain Testnet
              </p>
              <h1 className="animate-title font-display text-5xl font-medium leading-[0.95] tracking-tighter sm:text-7xl">
                Proof of Reputation
                <span className="font-serif-accent block">
                  for pseudonymous wallets.
                </span>
              </h1>
              <p className="animate-title mt-7 max-w-xl text-base leading-7 text-slate400 sm:text-lg">
                Know the wallet before you trust it.
              </p>
              <div className="animate-title mt-9 max-w-xl">
                <SearchWalletForm />
              </div>
            <div className="animate-title mt-6">
              <a
                href="#how"
                className="text-sm font-medium text-ink/70 transition hover:text-ink hover:underline"
              >
                Explore How It Works
              </a>
            </div>
          </div>

          <div className="card panel-brutal p-7 sm:p-8">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-ink">0xa6d9…ac19</span>
                <span className="chip-mono text-slate400">Illustrative</span>
              </div>
              <div className="mt-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  Fathom Score
                </div>
                <div className="mt-1 font-display text-5xl font-semibold tabular-nums">
                  176{" "}
                  <span className="text-lg font-medium text-accent-ink">
                    New
                  </span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  ["Economic History", 76],
                  ["Counterparty History", 84],
                  ["Risk Signals", 18],
                ].map(([label, pct]) => (
                  <div key={label as string}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-ink">{label}</span>
                      <span className="font-mono text-sm text-ink tabular-nums">
                        {pct}
                      </span>
                    </div>
                    <div className="mt-1 h-2 min-w-0 overflow-hidden rounded-full bg-black/10">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 font-mono text-[11px] uppercase leading-5 tracking-[0.18em] text-slate400">
                Sample values — a real score traces to evidence on the
                profile.
              </p>
            </div>
          </div>
        </section>

          {/* ACTIVITY */}
          <section className="px-6 py-14 lg:px-10 lg:py-20 xl:px-12">
            <div className="mx-auto max-w-7xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">
                Network activity
              </p>
              <h2 className="mt-3 font-display text-3xl font-medium tracking-tighter sm:text-4xl">
                Live reputation events.
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate400">
                Attestations, disputes, vouches, and claims as they happen.
                No posts, no comments, just on-chain and signed events.
              </p>
              <div className="mt-8">
                <LandingActivitySnippet />
              </div>
            </div>
          </section>

          {/* ABOUT */}
          <section id="about" className="px-6 py-20 lg:px-10 lg:py-24 xl:px-12">
            <div className="mx-auto grid max-w-7xl items-start gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <h2 className="animate-title font-display text-3xl font-medium tracking-tight sm:text-5xl">
                  Don&apos;t trust the profile.
                  <span className="font-serif-accent block">
                    Verify the wallet.
                  </span>
                </h2>
                <div className="mt-8 space-y-5 text-base leading-8 text-slate400">
                  <p>
                    Fathom evaluates{" "}
                    <span className="text-ink">economic identity</span>, not
                    real-world identity. No name, email, or ID is ever
                    required.
                  </p>
                </div>
              </div>
              <div className="card panel-brutal p-7 sm:p-8">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  Wallet
                </div>
                <ul className="mt-4 space-y-3">
                  {[
                    ["History", "What the wallet did"],
                    ["Relationships", "Who it interacted with"],
                    ["Evidence", "Proofs behind every claim"],
                    ["Risk", "Patterns worth a second look"],
                  ].map(([t, d]) => (
                    <li
                      key={t}
                      className="flex items-baseline justify-between gap-4 border-b border-ink/10 pb-3 last:border-b-0 last:pb-0"
                    >
                      <span className="font-display text-lg font-medium">
                        {t}
                      </span>
                      <span className="text-right text-sm text-slate400">
                        {d}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section id="how" className="px-6 py-16 lg:px-10 lg:py-20 xl:px-12">
            <div className="mx-auto max-w-7xl">
              <Head
                title="From an unknown wallet to your own decision."
                sub="Four steps. Every claim traces back to evidence you can inspect."
              />
              <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {HOW_STEPS.map(([title, body, note]) => (
                  <li key={title} className="card panel-brutal flex flex-col p-7">
                    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">
                      {title}
                    </div>
                    <p className="mt-3 font-display text-xl font-medium">
                      {body}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate400">
                      {note}
                    </p>
                  </li>
                ))}
              </ol>
              <div className="card mt-10">
                <PrimaryLink href="/wallets">Check a Wallet</PrimaryLink>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="px-6 py-20 lg:px-10 lg:py-24 xl:px-12">
            <div className="mx-auto max-w-5xl">
              <Head title="What you need to know." />
              <div className="mt-14 space-y-3">
                {FAQ.map(([q, a], i) => (
                  <details
                    key={q}
                    id={i === 2 ? "faq-identity" : undefined}
                    className="card panel-brutal scroll-mt-28 p-6 sm:p-7"
                  >
                    <summary className="cursor-pointer font-display text-lg font-medium">
                      {q}
                    </summary>
                    <p className="mt-3 text-sm leading-7 text-slate400">{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </main>

        {/* API */}
        <section id="api" className="px-6 py-20 lg:px-10 lg:py-28 xl:px-12">
          <div className="mx-auto max-w-7xl">
            <Head
              title={
                <>
                  Reputation evidence,{" "}
                  <span className="font-serif-accent">
                    in your own product.
                  </span>
                </>
              }
              sub="One read-only endpoint. No API key. CORS-open for browser apps."
            />
            <div className="mt-14 grid gap-4 lg:grid-cols-2">
              <div className="card">
                <CodeCard
                  title="request.js"
                  language="js"
                  code={`const res = await fetch(
  "https://YOUR-APP/api/reputation/0x71c4…4a3f"
);
const profile = await res.json();
// profile.score, profile.riskLevel, profile.proofs[]`}
                />
              </div>
              <div className="card">
                <CodeCard
                  title="response.json"
                  language="json"
                  code={`{
  "score": 332,
  "tier": { "id": "emerging" },
  "riskLevel": "medium",
  "vouchesCount": 2,
  "completeness": "complete"
}`}
                />
              </div>
            </div>
            <div className="card mt-10">
              <PrimaryLink href="/docs">Read the docs</PrimaryLink>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="relative z-10 border-t border-ink/10 px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              <div className="max-w-xs">
                <Logo />
                <p className="mt-4 text-sm leading-6 text-slate400">
                  Proof of reputation for pseudonymous wallets.
                </p>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  Product
                </div>
                <ul className="mt-4 space-y-2">
                  {(
                    [
                      ["Check a Wallet", "/wallets"],
                      ["Activity", "/activity"],
                      ["How It Works", "/#how"],
                      ["Trust Graph", `/wallets/${EXAMPLE_WALLET}#graph`],
                      ["Risk", `/wallets/${EXAMPLE_WALLET}#risk`],
                      ["Community", `/wallets/${EXAMPLE_WALLET}#community`],
                    ] as Array<[string, string]>
                  ).map(([label, href]) => (
                    <li key={label}>
                      <a
                        href={href}
                        className="flex min-h-11 items-center text-sm text-ink/70 transition hover:text-ink"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  Resources
                </div>
                <ul className="mt-4 space-y-2">
                  {(
                    [
                      ["About", "/#about"],
                      ["FAQ", "/#faq"],
                      ["Privacy Model", "/#faq-identity"],
                      ["Reputation Card", `/wallets/${EXAMPLE_WALLET}`],
                      ["Docs", "/docs"],
                    ] as Array<[string, string]>
                  ).map(([label, href]) => (
                    <li key={label}>
                      <a
                        href={href}
                        className="flex min-h-11 items-center text-sm text-ink/70 transition hover:text-ink"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-14 grid gap-6 border-t border-ink/10 pt-8 md:grid-cols-2 md:items-end">
              <div className="text-xs leading-5 text-slate400">
                <p>© 2026 Fathom</p>
              </div>
              <p className="text-xs leading-5 text-slate400 text-right md:mt-0">
                Built for pseudonymous economic identities.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
