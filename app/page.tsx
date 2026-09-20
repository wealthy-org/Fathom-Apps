"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { MainShell } from "@/components/main-shell";

// three.js (~600KB) loads only with the landing hero — nowhere else.
const HeroMesh = dynamic(
  () => import("@/components/hero-mesh").then((m) => m.HeroMesh),
  { ssr: false },
);

const NAV_LINKS: Array<[string, string]> = [
  ["About", "#about"],
  ["How It Works", "#how"],
  ["FAQ", "#faq"],
];

/** Public example wallet reused by /wallets — footer deep-links to its tabs. */
const EXAMPLE_WALLET = "0xa6d9e296e6833d211278faf255c76ed193c9ac19";

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

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </>
      ) : (
        <>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </>
      )}
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
    "01 — Check",
    "Enter any public wallet address.",
    "No account needed. Anyone can inspect public wallet evidence.",
  ],
  [
    "02 — Analyze",
    "Fathom analyzes available wallet history, relationships, reputation evidence, and risk signals.",
    "Economic history, counterparty relationships, attestations, and detected risk patterns.",
  ],
  [
    "03 — Verify",
    "Explore proofs and supporting evidence behind the reputation profile.",
    "Every claim traces back to indexed evidence and raw sources.",
  ],
  [
    "04 — Understand",
    "Review the Trust Graph, Reputation Dimensions, and risk context.",
    "Dimensions explain the score; risk stays separate from reputation.",
  ],
  [
    "05 — Decide",
    "Use the evidence to make your own decision.",
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
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const bloomRef = useRef<HTMLDivElement | null>(null);

  // Reference bloom parallax — passive, hero-local, static under reduced motion.
  useLayoutEffect(() => {
    const hero = heroRef.current;
    const bloom = bloomRef.current;
    if (!hero || !bloom) return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      bloom.style.transform = `translate(${x}px,${y}px)`;
    };
    hero.addEventListener("pointermove", onMove, { passive: true });
    return () => hero.removeEventListener("pointermove", onMove);
  }, []);

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
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="font-sans text-ink">
      <MainShell>
        {/* NAVBAR */}
        <nav className="sticky top-3 z-50 mx-4 mt-3 sm:mx-8 sm:mt-5 lg:mx-12">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 rounded-full border border-black/5 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl">
            <Logo />
            <div className="hidden items-center gap-7 text-sm text-slate400 md:flex">
              {NAV_LINKS.map(([t, href]) => (
                <a key={t} href={href} className="transition hover:text-ink">
                  {t}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/wallets"
                className="btn-brutal hidden px-5 py-2.5 text-sm sm:block"
              >
                Check a Wallet
              </Link>
              <button
                type="button"
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-full p-2 text-ink md:hidden"
              >
                <MenuIcon open={menuOpen} />
              </button>
            </div>
          </div>
          {menuOpen && (
            <div className="mt-2 rounded-3xl border border-black/5 bg-white/95 p-4 shadow-xl backdrop-blur-xl md:hidden">
              <div className="grid gap-2 text-sm">
                {NAV_LINKS.map(([t, href]) => (
                  <a
                    key={t}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-2xl px-4 py-3 text-slate400 transition hover:bg-black/5 hover:text-ink"
                  >
                    {t}
                  </a>
                ))}
                <Link
                  href="/wallets"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-2xl bg-ink px-4 py-3 font-medium text-white"
                >
                  Check a Wallet
                </Link>
              </div>
            </div>
          )}
        </nav>

      <main className="relative z-10">
        {/* HERO */}
        <section
          ref={heroRef}
          className="hero-shell relative flex min-h-[92svh] flex-col overflow-hidden px-5 pb-24 pt-28 sm:px-6 sm:pt-44 lg:px-8"
        >
          <HeroMesh />
          <div
            ref={bloomRef}
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 top-0 h-[720px] w-[720px] rounded-full blur-[48px]"
            style={{
              background:
                "radial-gradient(circle, rgba(227,74,50,0.4), transparent 62%)",
            }}
          />
          <div
            aria-hidden="true"
            className="atmo atmo-a"
            style={{ top: "20%" }}
          />
            <div className="mx-auto max-w-3xl">
              <div className="animate-title mb-7 inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 shadow-sm backdrop-blur-xl">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-ink">
                  Proof of Reputation
                </span>
              </div>
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
                className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition hover:text-ink"
              >
                Explore How It Works
                <Arrow />
              </a>
            </div>
          </div>

          {/* Floating example cards — reference data-drift pattern, Fathom content. */}
          <div
            aria-hidden="true"
            className="animate-drift pointer-events-none absolute right-[7%] top-[24%] hidden w-44 rounded-3xl border border-white/80 bg-white/75 p-4 shadow-xl backdrop-blur-xl lg:block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-faint">
                Fathom score
              </span>
              <span className="chip-mono text-slate400">Example</span>
            </div>
            <div className="mt-2 font-display text-3xl font-semibold">
              176 <span className="text-sm text-accent-ink">New</span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate400">
              0xa6d9…ac19
            </div>
          </div>
          <div
            aria-hidden="true"
            className="animate-drift pointer-events-none absolute bottom-[16%] left-[6%] hidden w-52 rounded-3xl border border-white/80 bg-white/75 p-4 shadow-xl backdrop-blur-xl lg:block"
            style={{ animationDelay: "-2s" }}
          >
            <div className="text-[10px] uppercase tracking-wider text-faint">
              Dimensions
            </div>
            <div className="mt-3 space-y-2">
              {[
                ["Economic", 76],
                ["Counterparty", 64],
                ["Contract", 52],
                ["Community", 38],
                ["Risk", 18],
              ].map(([label, pct]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <span className="w-20 font-mono text-[10px] text-slate400">
                    {label}
                  </span>
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/10">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            aria-hidden="true"
            className="animate-drift pointer-events-none absolute bottom-[10%] right-[10%] hidden rounded-full border border-black/5 bg-white/80 px-4 py-2 text-xs font-medium shadow-lg backdrop-blur lg:block"
            style={{ animationDelay: "-4s" }}
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Evidence before score
          </div>
        </section>

          {/* ABOUT */}
          <section id="about" className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
            <div className="mx-auto max-w-3xl">
              <Head
                kick="About Fathom"
                title={
                  <>
                    A reputation layer for{" "}
                    <span className="font-serif-accent">
                      pseudonymous wallets.
                    </span>
                  </>
                }
              />
              <div className="card panel-brutal mt-14 space-y-5 p-7 text-base leading-8 text-slate400 sm:p-9">
                <p>
                  Fathom is a reputation layer for pseudonymous wallets. It
                  turns wallet history, economic behavior, relationships,
                  attestations, and risk signals into verifiable and explainable
                  reputation evidence.
                </p>
                <p>
                  Fathom evaluates{" "}
                  <span className="text-ink">economic identity</span>, not
                  real-world identity. No name, email, or ID is ever required —
                  a wallet address is the identity object, and behavior provides
                  the evidence.
                </p>
                <p className="font-mono text-sm text-accent-ink">
                  Don&apos;t trust the profile. Verify the wallet.
                </p>
              </div>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section id="how" className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
            <div className="mx-auto max-w-3xl">
              <Head
                kick="How it works"
                title={
                  <>
                    From an unknown wallet to{" "}
                    <span className="font-serif-accent">
                      your own decision.
                    </span>
                  </>
                }
                sub="Five steps. Every claim traces back to evidence you can inspect."
              />
              <ol className="mt-14 space-y-4">
                {HOW_STEPS.map(([title, body, note]) => (
                  <li key={title} className="card panel-brutal p-7 sm:p-8">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-ink">
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
          <section id="faq" className="px-5 py-28 sm:px-6 lg:px-8 lg:py-40">
            <div className="mx-auto max-w-3xl">
              <Head
                kick="FAQ"
                title={
                  <>
                    What you{" "}
                    <span className="font-serif-accent">need to know.</span>
                  </>
                }
              />
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

        {/* CTA */}
        <section className="relative z-10 px-5 pb-28 sm:px-6 lg:px-8">
          <div className="card mx-auto max-w-5xl px-6 py-16 text-center sm:px-10 sm:py-20">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-ink">
              Start here
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-medium tracking-tight sm:text-6xl">
              Before you trust the wallet,{" "}
              <span className="font-serif-accent">look at the history.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate400">
              Search a wallet and explore the evidence behind its reputation.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryLink href="/wallets">Check a Wallet</PrimaryLink>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="relative z-10 border-t border-ink/10 px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <div className="max-w-xs">
                <Logo />
                <p className="mt-4 text-sm leading-6 text-slate400">
                  Proof of reputation for pseudonymous wallets.
                </p>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate400">
                  Product
                </div>
                <ul className="mt-4 space-y-2">
                  {(
                    [
                      ["Check a Wallet", "/wallets"],
                      ["How It Works", "/#how"],
                      ["Trust Graph", `/wallets/${EXAMPLE_WALLET}#graph`],
                      ["Risk", `/wallets/${EXAMPLE_WALLET}#risk`],
                      ["Community", `/wallets/${EXAMPLE_WALLET}#community`],
                    ] as Array<[string, string]>
                  ).map(([label, href]) => (
                    <li key={label}>
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
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate400">
                  Resources
                </div>
                <ul className="mt-4 space-y-2">
                  {(
                    [
                      ["About", "/#about"],
                      ["FAQ", "/#faq"],
                      ["Privacy Model", "/#faq-identity"],
                      ["Reputation Card", `/wallets/${EXAMPLE_WALLET}`],
                    ] as Array<[string, string]>
                  ).map(([label, href]) => (
                    <li key={label}>
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
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate400">
                  Status
                </div>
                <p className="mt-4 flex items-center gap-2 text-sm font-medium text-ink">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full bg-accent"
                  />
                  Testnet
                </p>
                <p className="mt-2 text-sm leading-6 text-slate400">
                  Fathom is currently running on Robinhood Chain Testnet.
                </p>
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
      </MainShell>
    </div>
  );
}
