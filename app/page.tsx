"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ConnectButton } from "@/components/connect-button";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { PrivacyModel } from "@/components/privacy-model";

const ICON_PATHS: Record<string, React.ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </>
  ),
  layers: (
    <>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 12.08-8.58 3.91a2 2 0 0 1-1.66 0L2 12.08" />
      <path d="m22 17.08-8.58 3.91a2 2 0 0 1-1.66 0L2 17.08" />
    </>
  ),
  gauge: (
    <>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 16v-3" />
      <path d="M11 16V8" />
      <path d="M15 16v-5" />
      <path d="M19 16V5" />
    </>
  ),
  shieldCheck: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  coins: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  boxes: (
    <>
      <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3z" />
      <path d="m7 16.5-4.74-2.85" />
      <path d="m7 16.5 5-3" />
      <path d="M7 16.5v5.17" />
      <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5z" />
      <path d="m17 16.5-5-3" />
      <path d="m17 16.5 4.74-2.85" />
      <path d="M17 16.5v5.17" />
      <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0z" />
      <path d="M12 8 7.26 5.15" />
      <path d="m12 8 4.74-2.85" />
      <path d="M12 13.5V8" />
    </>
  ),
  network: (
    <>
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
      <path d="M12 12V8" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  repeat: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
  fileCheck: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h6" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  store: (
    <>
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
    </>
  ),
  rocket: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),
  trendingUp: (
    <>
      <path d="M16 7h6v6" />
      <path d="m22 7-8.5 8.5-5-5L2 17" />
    </>
  ),
  briefcase: (
    <>
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </>
  ),
  menu: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </>
  ),
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
};

type IconName = keyof typeof ICON_PATHS;

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function IconBox({
  name,
  tone = "accent",
}: {
  name: IconName;
  tone?: "accent" | "purple" | "danger";
}) {
  const tones = {
    accent: "border-accent-ink/10 bg-accent/5 text-accent-ink",
    purple: "border-purple/20 bg-purple/5 text-purple",
    danger: "border-red-400/20 bg-red-400/5 text-red-600",
  };
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-md border-2 shadow-[2px_2px_0_#0b0f17] ${tones[tone]}`}
    >
      <Icon name={name} />
    </div>
  );
}

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

function Kick({ children }: { children: string }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-ink">
      {children}
    </span>
  );
}

function Head({
  kick,
  title,
  sub,
}: {
  kick: string;
  title: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="animate-title max-w-2xl">
      <Kick>{kick}</Kick>
      <h2 className="mt-4 font-display text-4xl font-medium tracking-tight sm:text-5xl">
        {title}
      </h2>
      {sub && <p className="mt-5 text-base leading-7 text-slate400">{sub}</p>}
    </div>
  );
}

function ExampleTag() {
  return (
    <span className="chip-mono bg-ink/5 text-slate400">
      Example
    </span>
  );
}

const NAV_LINKS: Array<[string, string]> = [
  ["How It Works", "#how"],
  ["Proof", "#proof"],
  ["Trust Graph", "#trust-graph"],
  ["For Builders", "#builders"],
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image
        src="/logo-no-bg.png"
        alt="Fathom"
        width={40}
        height={40}
        className="h-10 w-10"
        priority
      />
      <span className="font-display text-lg font-semibold tracking-tight">
        Fathom
      </span>
    </Link>
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
    <a
      href={href}
      className="btn-brutal group px-6 py-3.5 text-sm"
    >
      {children}
      <Arrow className="transition-transform duration-300 group-hover:translate-x-1" />
    </a>
  );
}

function StatStrip() {
  const stats: Array<[string, string]> = [
    ["Evidence before score", "On-chain foundation"],
    ["Pseudonymous by design", "Wallet-based identity"],
    ["Human context", "Structured attestations"],
    ["Open to inspect", "Every proof verifiable"],
  ];
  return (
    <section className="border-y border-ink/10 bg-white/70 backdrop-blur-sm">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-8 sm:px-6 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-y-6 lg:px-8">
        {stats.map(([label, value], i) => (
          <div key={label} className="flex items-center">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate400">
                {label}
              </div>
              <div className="mt-1 font-display text-lg font-medium sm:text-2xl">
                {value}
              </div>
            </div>
            {i < stats.length - 1 && (
              <div className="mx-6 hidden h-10 w-px bg-ink/10 lg:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  useLayoutEffect(() => {
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

      // Ambient parallax glow.
      gsap.to(".glow-top-left", {
        x: 100,
        y: 100,
        scrollTrigger: {
          trigger: "body",
          start: "top top",
          end: "bottom bottom",
          scrub: 2,
        },
      });
      gsap.to(".glow-bottom-right", {
        x: -100,
        y: -100,
        scrollTrigger: {
          trigger: "body",
          start: "top top",
          end: "bottom bottom",
          scrub: 2,
        },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="font-sans text-ink">
      <div className="bg-stars" />
      <div className="bg-grid" />
      <div className="glow-spot glow-top-left animate-blob" />
      <div
        className="glow-spot glow-bottom-right animate-blob"
        style={{ animationDelay: "-8s" }}
      />

      {/* 1. NAVBAR */}
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-ink/10 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-2 px-5 sm:px-6 lg:px-8">
          <Logo />
          <div className="hidden items-center gap-1 rounded-md border-2 border-ink/10 bg-ink/[0.03] p-1 backdrop-blur-md md:flex">
            {NAV_LINKS.map(([t, href]) => (
              <a
                key={t}
                href={href}
                className="rounded-md px-4 py-2 text-xs font-medium text-slate400 transition duration-200 hover:bg-ink/5 hover:text-ink"
              >
                {t}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/wallets"
              className="hidden btn-brutal-light px-4 py-2 text-xs sm:block"
            >
              Search Wallet
            </Link>
            <ConnectButton connectLabel="Connect Wallet" />
            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-ink bg-white text-ink shadow-[2px_2px_0_#0b0f17] md:hidden"
            >
              <Icon name={menuOpen ? "x" : "menu"} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-ink/10 bg-white/80 px-5 py-4 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map(([t, href]) => (
                <a
                  key={t}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate400 transition hover:bg-ink/5 hover:text-ink"
                >
                  {t}
                </a>
              ))}
              <Link
                href="/wallets"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate400 transition hover:bg-ink/5 hover:text-ink"
              >
                Search Wallet
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main className="relative z-10">
        {/* 2. HERO */}
        <section className="relative px-5 pb-24 pt-28 sm:px-6 sm:pt-44 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_.95fr]">
              <div>
                <div className="animate-title mb-7 inline-flex items-center gap-2 rounded-md border-2 border-ink bg-accent/10 px-3 py-1.5 shadow-[2px_2px_0_#0b0f17]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-ink">
                    On-chain trust layer
                  </span>
                </div>
                <h1 className="animate-title max-w-4xl font-display text-5xl font-medium leading-[0.95] tracking-tighter sm:text-7xl md:text-8xl">
                  Know the wallet
                  <span className="block bg-gradient-to-b from-ink to-ink/50 bg-clip-text text-transparent">
                    before you trust it.
                  </span>
                </h1>
                <p className="animate-title mt-7 max-w-xl text-base leading-7 text-slate400 sm:text-lg">
                  Fathom turns wallet history, economic relationships,
                  behavioral signals, and attestations into verifiable trust
                  evidence.
                </p>
                <p className="animate-title mt-4 font-mono text-sm text-accent-ink">
                  Don&apos;t trust the profile. Verify the wallet.
                </p>
                <div className="animate-title mt-9" id="check">
                  <SearchWalletForm />
                </div>
                <div className="animate-title mt-6">
                  <a
                    href="#profile"
                    className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition hover:text-ink"
                  >
                    Explore a Wallet
                    <Arrow />
                  </a>
                </div>
              </div>

              {/* Wallet Reputation Preview */}
              <div className="card">
                <div className="panel-brutal p-7 sm:p-9">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-ink">
                      0x7A3…91F2
                    </span>
                    <ExampleTag />
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    {[
                      ["Wallet Age", "3y 8m"],
                      ["Transactions", "1,842"],
                      ["Counterparties", "126"],
                      ["Repeat Relationships", "34"],
                      ["Contract History", "18 contracts"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate400">
                          {k}
                        </div>
                        <div className="mt-1 font-display text-xl font-medium">
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="my-6 h-px bg-ink/10" />
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-accent-ink">
                    Proof of reputation
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-slate400">
                    {[
                      "Long-term wallet activity",
                      "34 repeat counterparties",
                      "Consistent contract activity",
                      "Verified attestations",
                    ].map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <span className="text-accent-ink">✓</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#proof"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent-ink"
                  >
                    View Evidence <Arrow />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2b. STAT STRIP */}
        <StatStrip />

        {/* 3. PROBLEM */}
        <section className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <Head
              kick="The problem"
              title={
                <>
                  A wallet address is easy to see.
                  <br />
                  Its history isn&apos;t.
                </>
              }
              sub="In pseudonymous economies, you often interact with wallets you don't know. A profile can tell you what someone claims. A transaction history can show you what they actually did."
            />
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {[
                [
                  "eyeOff",
                  "Unknown Counterparties",
                  "You don't know who you've interacted with or whether the relationship has any history.",
                ],
                [
                  "layers",
                  "Fragmented Evidence",
                  "Relevant wallet activity is scattered across transactions, contracts, and counterparties.",
                ],
                [
                  "gauge",
                  "Reputation Without Context",
                  "A single score can hide the evidence behind it.",
                ],
              ].map(([icon, t, d]) => (
                <article
                  key={t}
                  className="card panel-brutal flex flex-col p-7 sm:p-9"
                >
                  <IconBox name={icon as IconName} />
                  <h3 className="mt-6 font-display text-lg font-medium">{t}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate400">{d}</p>
                </article>
              ))}
            </div>
            <p className="card mt-10 font-display text-2xl tracking-tight">
              Fathom connects the evidence.
            </p>
          </div>
        </section>

        {/* 4. HOW IT WORKS */}
        <section id="how" className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <Head
              kick="From wallet to trust"
              title={
                <>
                  Understand the wallet.
                  <br />
                  Not just the profile.
                </>
              }
            />
            <div className="mt-14 grid gap-4 md:grid-cols-4">
              {[
                ["search", "01", "Search", "Enter any wallet address. No account required."],
                [
                  "chart",
                  "02",
                  "Analyze",
                  "Fathom analyzes wallet history, behavioral signals, economic activity, and relationships.",
                ],
                [
                  "shieldCheck",
                  "03",
                  "Verify",
                  "Explore the underlying proofs and evidence behind the reputation.",
                ],
                [
                  "compass",
                  "04",
                  "Decide",
                  "Use the evidence to make your own trust decision.",
                ],
              ].map(([icon, n, t, d]) => (
                <article
                  key={n}
                   className="card panel-brutal relative flex flex-col p-7 sm:p-9"
                >
                  <IconBox name={icon as IconName} />
                  <span className="absolute right-7 top-7 font-mono text-[9px] text-slate400 sm:right-9 sm:top-9">
                    {n}
                  </span>
                  <h3 className="mt-16 font-display text-3xl font-medium tracking-tight">
                    {t}
                  </h3>
                  <p className="mt-4 max-w-lg text-sm leading-7 text-slate400">
                    {d}
                  </p>
                </article>
              ))}
            </div>
            <div className="card panel-brutal mt-14 p-8">
              <div>
                <div className="flex flex-col items-center gap-1 font-mono text-sm text-slate400">
                  {[
                    "WALLET",
                    "ON-CHAIN HISTORY",
                    "BEHAVIOR SIGNALS",
                    "ECONOMIC RELATIONSHIPS",
                    "ATTESTATIONS",
                    "PROOF OF REPUTATION",
                    "TRUST DECISION",
                  ].map((step, i) => (
                    <div key={step} className="flex flex-col items-center">
                      <span className="px-4 py-1 text-center">{step}</span>
                      {i < 6 && <span className="text-accent-ink">↓</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. PROOF OF REPUTATION */}
        <section id="proof" className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <Head
              kick="Proof of reputation"
              title="Reputation should be backed by evidence."
              sub="Fathom transforms observable wallet activity and attestations into structured proof objects that can be inspected and verified."
            />
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["clock", "Wallet Age", "3 years 8 months", "On-chain history"],
                ["coins", "Economic History", "$284K+ historical activity", "Transaction history"],
                ["users", "Repeat Counterparties", "34 relationships", "Wallet interactions"],
                ["boxes", "Contract History", "18 contracts interacted with", "On-chain activity"],
              ].map(([icon, k, v, src]) => (
                <article
                  key={k}
                   className="card panel-brutal flex flex-col p-7 sm:p-9"
                >
                  <IconBox name={icon as IconName} />
                  <div className="mt-6 font-mono text-[9px] uppercase tracking-[0.18em] text-accent-ink">
                    {k}
                  </div>
                  <div className="mt-3 font-display text-xl font-medium">
                    {v}
                  </div>
                  <div className="mt-6 flex items-center justify-between text-xs text-slate400">
                    <span>Source: {src}</span>
                    <span className="text-accent-ink">✓</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="card mt-10">
              <a
                href="#why"
                className="inline-flex items-center gap-2 text-sm font-medium text-accent-ink"
              >
                Explore Proof <Arrow />
              </a>
            </div>
          </div>
        </section>

        {/* 6. WHY THIS REPUTATION? */}
        <section id="why" className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              <div>
                <Head
                  kick="Why this evidence?"
                  title={
                    <>
                      Don&apos;t just read a number.
                      <br />
                      See why.
                    </>
                  }
                  sub="Fathom has no global score yet. It shows the dimensions and proofs behind a wallet so every claim can be traced back to evidence."
                />
                <div className="card mt-10 space-y-4">
                  {[
                    ["Economic History", "supported"],
                    ["Counterparty History", "supported"],
                    ["Contract History", "supported"],
                    ["Community Trust", "awaiting data"],
                    ["Risk Signals", "evaluated"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-slate400">{k}</span>
                        <span
                          className={
                            v === "supported" ? "text-accent-ink" : "text-slate400"
                          }
                        >
                          {v}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="panel-brutal p-7 sm:p-9">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate400">
                      Evidence
                    </span>
                    <ExampleTag />
                  </div>
                  <p className="mt-2 text-sm text-slate400">
                    No global score is produced. The profile exposes what the
                    wallet actually did.
                  </p>
                  <div className="my-6 h-px bg-ink/10" />
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-accent-ink">
                    Proof
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-slate400">
                    {[
                      "3.8 years active",
                      "34 repeat counterparties",
                      "18 contracts",
                      "Consistent activity",
                      "7 verified attestations",
                    ].map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <span className="text-accent-ink">✓</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                  <div className="my-6 h-px bg-ink/10" />
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate400">
                    Evidence
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {["View transaction", "View relationship", "View attestation"].map(
                      (t) => (
                        <span
                          key={t}
                          className="rounded-md border-2 border-ink bg-white px-3 py-1 text-ink shadow-[2px_2px_0_#0b0f17]"
                        >
                          {t}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. TRUST GRAPH */}
        <section id="trust-graph" className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <Head
              kick="Trust graph"
              title="Trust is built through relationships."
              sub="A wallet doesn't exist in isolation. Fathom maps interactions between wallets, contracts, and counterparties, alongside attestations, to reveal the relationships behind on-chain behavior."
            />
            <div className="mt-14 grid gap-10 lg:grid-cols-2">
              <div className="card panel-brutal overflow-x-auto p-7 sm:p-9">
                <div className="min-w-[300px] font-mono text-[11px] leading-8 text-slate400 sm:text-xs">
                  <div className="text-center text-accent-ink">Contract</div>
                  <div className="text-center text-slate400">│</div>
                  <div className="flex justify-center gap-8">
                    <span>Wallet A</span>
                    <span className="text-ink/60">─────</span>
                    <span>Wallet B</span>
                  </div>
                  <div className="flex justify-center gap-4">
                    <span>│</span>
                    <span>│</span>
                  </div>
                  <div className="flex justify-center gap-8">
                    <span className="text-ink/60">└────</span>
                    <span>Wallet C</span>
                    <span className="text-ink/60">┘</span>
                  </div>
                  <div className="text-center">│</div>
                  <div className="text-center text-accent-ink">Attester</div>
                </div>
              </div>
              <div className="card">
                <div className="space-y-2">
                  {[
                    "Repeated interactions",
                    "Relationship duration",
                    "Counterparty history",
                    "Contract interactions",
                    "Attestations",
                    "Disputes",
                  ].map((t) => (
                    <div
                      key={t}
                      className="flex items-center gap-3 rounded-md border-2 border-ink bg-white px-4 py-3 text-sm text-ink/80 shadow-[2px_2px_0_#0b0f17]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {t}
                    </div>
                  ))}
                </div>
                <a
                  href="#trust-graph"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-accent-ink"
                >
                  Explore the Trust Graph <Arrow />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 8. HUMAN CONTEXT — ATTESTATIONS */}
        <section className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              <div>
                <Head
                  kick="Human context"
                  title={
                    <>
                      On-chain history shows what happened.
                      <br />
                      Attestations add context.
                    </>
                  }
                  sub="Not everything meaningful exists in transaction data. Fathom allows wallets to provide structured attestations about relationships, roles, and experiences — while keeping on-chain evidence as the foundation."
                />
                <p className="card mt-8 font-mono text-sm text-accent-ink">
                  Attestations add context. They don&apos;t replace evidence.
                </p>
              </div>
              <div className="card">
                <div className="panel-brutal p-7 sm:p-9">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconBox name="fileCheck" />
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-accent-ink">
                        Attestation
                      </span>
                    </div>
                    <ExampleTag />
                  </div>
                  <dl className="mt-8 space-y-3 text-sm">
                    {[
                      ["Role", "Builder"],
                      ["Relationship", "Worked together"],
                      ["Duration", "2 years"],
                      ["Attested by", "0x82A…19C4"],
                      ["Evidence", "Verified relationship"],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between border-b border-ink/10 pb-3"
                      >
                        <dt className="text-slate400">{k}</dt>
                        <dd className="font-mono text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 9. RISK SIGNALS */}
        <section className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-7xl">
<Head
              kick="Risk signals"
              title="Trust isn't only about positive signals."
              sub="Fathom surfaces explainable risk signals that may require further investigation. Every signal carries evidence you can inspect."
            />
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["clock", "Fresh Wallet", "Detected when a wallet is young and has little activity."],
                ["network", "Concentrated Counterparty Graph", "Detected when interactions concentrate on one counterparty."],
                ["repeat", "Circular Relationship Graph", "Detected when value flows back and forth between several wallets."],
                ["users", "Suspicious Vouch Clustering", "Not yet evaluable — vouching is not implemented (Spec 08)."],
              ].map(([icon, t, d]) => (
                <article
                  key={t}
                   className="card panel-brutal flex flex-col p-7 sm:p-9"
                >
                  <IconBox name={icon as IconName} />
                  <div className="mt-6 font-mono text-[9px] uppercase tracking-[0.18em] text-accent-ink">
                    {t}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate400">{d}</p>
                </article>
              ))}
            </div>
            <p className="card mt-8 text-sm text-slate400">
              These are illustrative signals. A detected signal is evidence for
              investigation — not an automatic accusation, and never an
              aggregate risk level.
            </p>
          </div>
        </section>

        {/* 10. REPUTATION PROFILE */}
        <section id="profile" className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <Head
              kick="Reputation profile"
              title={
                <>
                  One wallet.
                  <br />A complete reputation context.
                </>
              }
            />
            <div className="card mx-auto mt-14 max-w-sm">
              <div className="panel-brutal p-7 sm:p-9">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-ink">0x7A3…91F2</span>
                  <ExampleTag />
                </div>
                <div className="mt-1 text-xs text-accent-ink">Verified Wallet</div>
                <p className="mt-4 text-sm text-slate400">
                  Evidence first. No global score is produced yet — the profile
                  exposes what the wallet actually did.
                </p>
                <dl className="mt-6 space-y-3 text-sm">
                  {[
                    ["Economic History", "supported"],
                    ["Counterparty History", "supported"],
                    ["Contract History", "supported"],
                    ["Community Trust", "awaiting data"],
                    ["Risk Signals", "evaluated"],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between border-b border-ink/10 pb-3"
                    >
                      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate400">
                        {k}
                      </dt>
                      <dd
                        className={`font-mono ${
                          v === "supported" ? "text-accent-ink" : "text-slate400"
                        }`}
                      >
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                <dl className="mt-6 space-y-2 text-sm text-slate400">
                  {[
                    ["3y 8m", "Wallet Age"],
                    ["1,842", "Transactions"],
                    ["126", "Counterparties"],
                    ["34", "Repeat Relationships"],
                  ].map(([v, k]) => (
                    <div key={k} className="flex items-center justify-between">
                      <dt>{k}</dt>
                      <dd className="font-mono text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                <button className="btn-brutal-light mt-6 w-full py-2.5 text-sm">
                  View Evidence
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 11. PRIVACY */}
        <section id="privacy" className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <Head
              kick="Pseudonymous by design"
              title={
                <>
                  Verify behavior.
                  <br />
                  Not identity.
                </>
              }
              sub="Fathom is designed around wallet-based identity. You don't need to reveal your real-world identity to build or inspect reputation."
            />
            <div className="card mt-14">
              <PrivacyModel />
            </div>
            <p className="card mt-8 font-display text-2xl tracking-tight">
              Trust wallets, not identities.
            </p>
          </div>
        </section>

        {/* 12. FOR THE ECOSYSTEM */}
        <section id="builders" className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <Head
              kick="Built for pseudonymous economies"
              title="Trust infrastructure for the next generation of economic networks."
            />
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["repeat", "OTC Trading", "Understand a counterparty before a transaction."],
                ["store", "Marketplaces", "Surface reputation alongside wallet activity."],
                ["users", "DAOs", "Evaluate contributors through verifiable history."],
                ["rocket", "Launchpads", "Add reputation signals to participant evaluation."],
                ["trendingUp", "Prediction Markets", "Understand participants beyond a username."],
                ["briefcase", "Freelance Protocols", "Build reputation around completed relationships."],
              ].map(([icon, t, d], i) => (
                <article
                  key={t}
                  className="card panel-brutal flex flex-col p-7 sm:p-9"
                >
                  <IconBox
                    name={icon as IconName}
                    tone={i % 2 === 1 ? "purple" : "accent"}
                  />
                  <h3 className="mt-6 font-display text-lg font-medium">{t}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate400">{d}</p>
                </article>
              ))}
            </div>
            <div className="card mt-10">
              <a
                href="#api"
                className="inline-flex items-center gap-2 text-sm font-medium text-accent-ink"
              >
                Build with Fathom <Arrow />
              </a>
            </div>
          </div>
        </section>

        {/* 13. REPUTATION API */}
        <section id="api" className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <Head
              kick="Reputation API"
              title="Make wallet reputation part of your product."
              sub="Fathom exposes reputation, proofs, risk signals, relationship metrics, and attestations through an integration layer."
            />
            <div className="card mt-14 max-w-2xl overflow-hidden rounded-2xl border-2 border-ink bg-terminal shadow-[4px_4px_0_#0b0f17]">
              <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate400">
                  GET /reputation
                </span>
                <ExampleTag />
              </div>
              <div className="p-6">
                <span className="terminal-line text-ink/70">
                  GET /reputation/0x7A3…91F2
                </span>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
                  Illustrative shape — not live output
                </p>
                <pre className="terminal-line mt-2 overflow-x-auto text-accent-ink">
{`{
  "wallet": "0x7A3…91F2",
  "walletAgeDays": 1340,
  "uniqueCounterparties": 126,
  "repeatCounterparties": 34,
  "attestations": 7,
  "activeDisputes": 0,
  "riskSignals": [],
  "proofs": []
}`}
                </pre>
              </div>
            </div>
            <div className="card mt-10">
              <a
                href="#builders"
                className="inline-flex items-center gap-2 text-sm font-medium text-accent-ink"
              >
                Explore the API <Arrow />
              </a>
            </div>
          </div>
        </section>

        {/* 14. FINAL CTA */}
        <section className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="card font-display text-4xl font-medium tracking-tight sm:text-5xl">
              Before you trust the wallet,
              <br />
              look at the history.
            </h2>
            <p className="card mx-auto mt-5 max-w-xl text-base leading-7 text-slate400">
              Search a wallet and explore the evidence behind its reputation.
            </p>
            <div className="card mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryLink href="/wallets">Search a Wallet</PrimaryLink>
              <a
                href="#builders"
                className="btn-brutal-light px-6 py-3.5 text-sm"
              >
                Build with Fathom
              </a>
            </div>
          </div>
        </section>

        {/* 15. FOOTER */}
        <footer className="border-t border-ink/10 px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
              <div className="max-w-xs">
                <Logo />
                <p className="mt-4 text-sm text-slate400">
                  Privacy-first on-chain trust layer.
                </p>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate400">
                  Product
                </div>
                <ul className="mt-4 space-y-2">
                  {(
                    [
                      ["How It Works", "#how"],
                      ["Proof", "#proof"],
                      ["Trust Graph", "#trust-graph"],
                      ["For Builders", "#builders"],
                    ] as Array<[string, string]>
                  ).map(([label, href]) => (
                    <li key={href}>
                      <a
                        href={href}
                        className="text-sm text-ink/70 transition hover:text-ink"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-14 border-t border-ink/10 pt-6 text-xs text-slate400">
              © 2026 Fathom
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
