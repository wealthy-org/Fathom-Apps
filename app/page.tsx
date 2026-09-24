"use client";

import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LandingActivityMarquee } from "@/components/landing-activity-marquee";
import { LiveReputationEvents } from "@/components/live-reputation-events";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { LandingAct } from "@/components/landing-act";
import { LandingExplain } from "@/components/landing-explain";
import { LandingFaq } from "@/components/landing-faq";
import { LandingIdentity } from "@/components/landing-identity";
import { LandingIntegrate } from "@/components/landing-integrate";
import { LandingProve } from "@/components/landing-prove";
import { LandingTrustGraph } from "@/components/landing-trust-graph";
import { LandingUseCases } from "@/components/landing-use-cases";
import { LandingWhyScore } from "@/components/landing-why-score";
import { Logo, Navbar } from "@/components/layout/Navbar";

/** Public example wallet reused by /wallets — footer deep-links to its tabs. */
const EXAMPLE_WALLET = "0xa6d9e296e6833d211278faf255c76ed193c9ac19";

/**
 * Hero sample data — static mock mirroring what the wallet profile page
 * shows for EXAMPLE_WALLET (score trio, dimensions, KV metrics, activity,
 * risk state). Not live data; the note under the search box says so.
 */
const HERO_SAMPLE = {
  addressShort: "0xa6d9…ac19",
  verifiedAgo: "Verified 12 min ago",
  score: 812,
  maxScore: 1000,
  tier: "Established",
  breakdownHref: `/wallets/${EXAMPLE_WALLET}#evidence`,
  dimensions: [
    { label: "Economic History", pct: 82, value: "82/100" },
    { label: "Counterparty History", pct: 74, value: "74/100" },
    { label: "Contract History", pct: 61, value: "61/100" },
    { label: "Community Trust", pct: 58, value: "58/100" },
    { label: "Risk Signals", pct: 15, value: "−6 penalty", isRisk: true },
  ],
  kv: [
    { label: "Transactions", value: "1,284" },
    { label: "Vouches", value: "6" },
    { label: "Evidence", value: "14 proofs" },
  ],
  activity: [
    { label: "Vouch received", detail: "0x71c4…4a3f", at: "2 min ago" },
    { label: "Role attestation", detail: "Auditor · signed", at: "18 min ago" },
    { label: "Score updated", detail: "+24 this week", at: "47 min ago" },
    { label: "New counterparty", detail: "0x4e21…f7aa", at: "1 hr ago" },
  ],
  risk: {
    label: "Suspicious vouch clustering",
    status: "clear",
    evidence: "Vouch concentration 22% across 3 linked wallets",
    href: `/wallets/${EXAMPLE_WALLET}#risk`,
  },
  metrics: [
    { label: "Wallet age", value: "2.4 yrs" },
    { label: "Counterparties", value: "148" },
    { label: "Repeat", value: "31" },
    { label: "Disputes", value: "0" },
  ],
};

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

/**
 * Credibility strip under the hero — implemented facts only (8 proof types = ProofType union).
 */
const TRUST_STRIP: Array<[string, string]> = [
  ["Onchain", "history first"],
  ["Score", "= compression of evidence"],
  ["8 proof types", ""],
  // ["0 real-world IDs", ""],
  ["Deterministic", "engine"],
  ["Protocol", "underneath"],
];

/**
 * Salinan track marquee butuh setengah lintasan minimal selebar viewport,
 * kalau tidak loop translateX(-50%) meninggalkan celah kosong. 6 item
 * ≈ 1.500px, jadi 12 item per salinan aman sampai layar lebar.
 * Padding tampilan, bukan parameter scoring.
 */
const TRUST_STRIP_COPIES = Math.max(2, Math.ceil(12 / TRUST_STRIP.length));

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
      {/* ponytail: Sign In + search inline + links disediakan Navbar sendiri. */}
      <Navbar />
      <LandingActivityMarquee />

      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-8">
        <main id="main-content" className="relative z-10">
          {/* HERO */}
          <section className="px-6 pb-20 pt-14 sm:pt-20 lg:px-10 lg:pb-28 xl:px-12">
              <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
                <div>
                  <p className="animate-title">
                    <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/70 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                      Proof of Reputation · Pseudonymous by default
                    </span>
                  </p>
                  <h1 className="animate-title mt-7 font-display text-5xl font-medium leading-[0.95] tracking-tighter sm:text-6xl lg:text-7xl">
                    Know the wallet{" "}
                    <span className="font-serif-accent italic">
                      <span className="bg-accent px-2 text-white">before</span>
                    </span>{" "}
                    you trust it.
                  </h1>
                  <p className="animate-title mt-7 max-w-xl text-base leading-7 text-slate400 sm:text-lg">
                    Wallet history, economic relationships, and attestations
                    become trust evidence — no real name required. Every score
                    opens into the evidence behind it.
                  </p>
                  <div className="animate-title mt-9 max-w-xl">
                    <SearchWalletForm
                      defaultValue={EXAMPLE_WALLET}
                      submitLabel="CHECK"
                    />
                  </div>
                  <div className="animate-title mt-4 flex flex-wrap gap-2">
                    {[
                      "No account needed",
                      "Public data only",
                      "Every signal inspectable",
                    ].map((pill) => (
                      <span key={pill} className="chip-mono text-slate400">
                        {pill}
                      </span>
                    ))}
                  </div>
                  <dl className="animate-title mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-ink/10 pt-6 sm:grid-cols-4">
                    {HERO_SAMPLE.metrics.map((metric) => (
                      <div key={metric.label}>
                        <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate400">
                          {metric.label}
                        </dt>
                        <dd className="mt-1 font-display text-2xl text-ink tabular-nums">
                          {metric.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="relative">
                  <div className="card panel-brutal bg-mist p-7 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm text-ink">
                        {HERO_SAMPLE.addressShort}
                      </span>
                      <span className="chip-mono gap-1.5 text-slate400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                        {HERO_SAMPLE.verifiedAgo}
                      </span>
                    </div>
                    <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate400">
                          Fathom Score
                        </div>
                        <div className="mt-1 font-display text-5xl font-semibold leading-none text-ink tabular-nums sm:text-6xl">
                          {HERO_SAMPLE.score}{" "}
                          <span className="text-xl font-medium text-slate400">
                            / {HERO_SAMPLE.maxScore}
                          </span>
                        </div>
                      </div>
                      <span className="chip-mono text-accent-ink">
                        {HERO_SAMPLE.tier}
                      </span>
                    </div>
                    <div className="mt-6 space-y-3">
                      {HERO_SAMPLE.dimensions.map((dimension) => (
                        <div
                          key={dimension.label}
                          className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[150px_1fr_auto] sm:items-center sm:gap-4"
                        >
                          <span className="min-w-0 truncate text-sm text-ink">
                            {dimension.label}
                          </span>
                          <div
                            role="progressbar"
                            aria-label={dimension.label}
                            aria-valuenow={dimension.pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="h-3 min-w-0 overflow-hidden rounded-full border border-black/10 bg-white"
                          >
                            <div
                              className={`h-full ${dimension.isRisk ? "bg-purple" : "bg-accent"}`}
                              style={{ width: `${dimension.pct}%` }}
                            />
                          </div>
                          <span className="shrink-0 font-mono text-xs text-ink tabular-nums sm:text-sm">
                            {dimension.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-t border-black/10 pt-5">
                      {HERO_SAMPLE.kv.map((item) => (
                        <div key={item.label}>
                          <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate400">
                            {item.label}
                          </dt>
                          <dd className="mt-1 font-display text-xl text-ink tabular-nums">
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
                      <p className="text-sm text-slate400">
                        Evidence before score — inspect what this wallet did.
                      </p>
                      <a
                        href={HERO_SAMPLE.breakdownHref}
                        className="group inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink hover:underline"
                      >
                        Why {HERO_SAMPLE.score}? View score breakdown
                        <Arrow className="transition-transform duration-300 group-hover:translate-x-1" />
                      </a>
                    </div>
                  </div>

                  {/* <div className="card panel-brutal mt-4 p-5 lg:absolute lg:-bottom-12 lg:-left-12 lg:z-10 lg:mt-0 lg:w-80">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                      Live activity
                    </span>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {HERO_SAMPLE.activity.map((entry) => (
                      <li
                        key={entry.label}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="min-w-0 text-sm text-ink">
                          {entry.label}{" "}
                          <span className="font-mono text-[11px] text-slate400">
                            {entry.detail}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-slate400">
                          {entry.at}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div> */}

                  {/* <div className="card panel-brutal mt-4 p-5 lg:absolute lg:-right-6 lg:top-16 lg:z-10 lg:mt-0 lg:w-72">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                      Risk signal
                    </span>
                    <span className="chip-mono text-accent-ink">
                      {HERO_SAMPLE.risk.status}
                    </span>
                  </div>
                  <div className="mt-2 font-display text-base text-ink">
                    {HERO_SAMPLE.risk.label}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate400">
                    {HERO_SAMPLE.risk.evidence}.
                  </p>
                  <a
                    href={HERO_SAMPLE.risk.href}
                    className="mt-2 inline-block font-mono text-[11px] text-accent-ink hover:underline"
                  >
                    Inspect risk →
                  </a>
                </div> */}
                </div>
              </div>
            </section>

            {/* TRUST STRIP — marquee 1 baris endless (pola .animate-marquee globals). */}
            <section
              aria-label="Fathom credibility points"
              className="marquee-paused relative left-1/2 w-screen -translate-x-1/2 border-y border-ink/10 bg-black py-5"
            >
              <div className="overflow-hidden">
                <div className="animate-marquee flex w-max items-center gap-6 px-5 motion-reduce:animate-none motion-reduce:overflow-x-auto lg:px-8">
                  {Array.from({ length: TRUST_STRIP_COPIES }, () => TRUST_STRIP)
                    .flat()
                    .map(([key, rest], index) => (
                      <span
                        key={`${key}-${index}`}
                        aria-hidden={index >= TRUST_STRIP.length || undefined}
                        className="flex items-center gap-6 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em] text-white"
                      >
                        {index > 0 && (
                          <span
                            aria-hidden="true"
                            className="h-1 w-1 shrink-0 rounded-full bg-red-700 text-white"
                          />
                        )}
                        <span>
                          <span className="font-semibold text-white">
                            {key}
                          </span>
                          {rest && (
                            <span className="text-white opacity-60">
                              {" "}
                              {rest}
                            </span>
                          )}
                        </span>
                      </span>
                    ))}
                </div>
              </div>
            </section>

            {/* LIVE REPUTATION EVENTS */}
            {/* <LiveReputationEvents /> */}

            {/* 01 — INTRODUCE */}
            <LandingWhyScore />

            {/* 02 — SHOW */}
            <LandingTrustGraph />

            {/* 03 — EXPLAIN */}
            <LandingExplain />

            {/* 04 — PROVE */}
            <LandingProve />

            {/* 05 — EXPAND */}
            {/* <LandingUseCases /> */}

            {/* 06 — TRUST */}
            {/* <LandingIdentity /> */}

            {/* 07 — INTEGRATE */}
            <LandingIntegrate />

            {/* FAQ */}
            <LandingFaq />

            {/* 08 — ACT */}
            <LandingAct />
          </main>
      </div>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-ink/10 px-5 py-4 sm:px-6 lg:px-8 font-mono">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="max-w-xs">
              <Logo />

              <p className="mt-2 text-sm leading-5 text-slate400">
                Proof of reputation for pseudonymous wallets.
              </p>
            </div>

            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                Product
              </div>

              <ul className="mt-1.5">
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
                      className="flex min-h-9 items-center text-sm leading-5 text-ink/70 transition hover:text-ink"
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

              <ul className="mt-1.5">
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
                      className="flex min-h-9 items-center text-sm leading-5 text-ink/70 transition hover:text-ink"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 grid gap-2 border-t border-ink/10 pt-3 md:grid-cols-2 md:items-center">
            <div className="text-xs leading-4 text-slate400">
              © 2026 Fathom
            </div>

            <p className="text-xs leading-4 text-slate400 md:text-right">
              Built for pseudonymous economic identities.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
