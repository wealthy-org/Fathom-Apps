"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wallet/config";
import { NavbarSearch } from "@/components/navbar-search";
import { SignInButton } from "@/components/sign-in-modal";

/**
 * Single shared navbar for landing and wallet pages.
 *
 * Floating glass pill, identical spacing/typography/mobile behavior
 * everywhere. Links seragam via DEFAULT_NAV_LINKS; callers jarang perlu
 * pass links sendiri.
 */

/**
 * Set link navbar seragam untuk semua halaman: landing, wallet, activity.
 * Anchor landing ditulis absolut (/#about) agar berfungsi dari halaman mana pun.
 * My Activity sengaja tidak di navbar — ada di dropdown avatar (connected saja).
 */
export const DEFAULT_NAV_LINKS: Array<[string, string]> = [
  ["Activity", "/activity"],
  ["Why Fathom", "/#why"],
  ["How It Works", "/#explain"],
  ["FAQ", "/#faq"],
  ["Docs", "/docs"],
];

export function Logo({ wordmark = true }: { wordmark?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
      {/* ponytail: mark is light-on-dark art; invert for the white pill */}
      <Image
        src="/logo-no-bg.png"
        alt="Fathom"
        width={40}
        height={40}
        className="h-8 w-8 shrink-0 invert sm:h-10 sm:w-10"
      />
      {wordmark && (
        <span className="truncate font-display text-base font-semibold tracking-tight sm:text-lg font-mono">
          Fathom
        </span>
      )}
    </Link>
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

export function Navbar({
  links = DEFAULT_NAV_LINKS,
  actions,
}: {
  links?: Array<[string, string]>;
  actions?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  return (
    // ponytail: provider di dalam Navbar — landing tidak punya WagmiProvider
    // sendiri (hanya /wallets dan /activity). Config singleton, state shared,
    // aman double-wrap dengan route layout.
    <WagmiProvider config={wagmiConfig}>
      <nav
        ref={navRef}
        className="sticky top-3 z-50 mx-4 mt-3 sm:mx-8 sm:mt-5 lg:mx-12 font-mono"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-1.5 rounded-full border border-black/5 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-xl sm:gap-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <Logo wordmark={false} />
            <NavbarSearch />
          </div>
          {links.length > 0 && (
            <div className="hidden items-center gap-5 text-sm text-slate400 md:flex">
              {links.map(([t, href]) => (
                <a
                  key={t}
                  href={href}
                  className="inline-flex min-touch items-center px-2 transition hover:text-ink"
                >
                  {t}
                </a>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">{actions}</div>
            <SignInButton />
            <div className="flex items-center md:hidden">
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                onClick={() => setMenuOpen((v) => !v)}
                className="min-touch inline-flex items-center justify-center rounded-full p-2 text-ink font-mono"
              >
                <MenuIcon open={menuOpen} />
              </button>
            </div>
          </div>
        </div>
        {menuOpen && (
          <div
            id="mobile-menu"
            className="mt-2 rounded-3xl border border-black/5 bg-white/95 p-4 shadow-xl backdrop-blur-xl md:hidden"
          >
            {actions && (
              <div className="mb-3 grid gap-2 border-b border-black/5 pb-3">
                {actions}
              </div>
            )}
            <div className="grid gap-1 text-sm">
              {links.map(([t, href]) => (
                <a
                  key={t}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-touch items-center rounded-2xl px-4 text-slate400 transition hover:bg-black/5 hover:text-ink"
                >
                  {t}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>
    </WagmiProvider>
  );
}
