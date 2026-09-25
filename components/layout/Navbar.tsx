"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wallet/config";
import { NavbarSearch } from "@/components/navbar-search";
import {
  AUTH_GATE_COPY,
  SignInButton,
  SignInModal,
} from "@/components/sign-in-modal";
import { useSession } from "@/components/use-session";

/**
 * Single shared navbar for activity and wallet pages.
 *
 * Floating glass pill, identical spacing/typography/mobile behavior
 * everywhere. Links seragam via DEFAULT_NAV_LINKS; callers jarang perlu
 * pass links sendiri.
 */

export interface NavLink {
  label: string;
  href: string;
  /** True = klik tanpa sesi SIWE membuka modal gate, bukan navigasi. */
  requiresAuth?: boolean;
}

/**
 * Set link navbar seragam untuk semua halaman.
 * My Activity ada di navbar langsung (tanpa dropdown avatar).
 */
export const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: "Feed", href: "/" },
  { label: "Check a Wallet", href: "/wallets" },
  { label: "My Activity", href: "/me", requiresAuth: true },
];

export function Logo({ wordmark = true }: { wordmark?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
      {/* Logo — warna dari PNG itu sendiri, tanpa filter/CSS. */}
      <Image
        src="/logo-accent.png"
        alt="Fathom"
        width={40}
        height={40}
        className="h-8 w-8 shrink-0 sm:h-10 sm:w-10"
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
  links?: NavLink[];
  actions?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const { session } = useSession();
  const navRef = useRef<HTMLElement>(null);

  // Link requiresAuth tanpa sesi SIWE = modal gate, bukan navigasi.
  // Session masih loading (null) = teruskan agar tak ada blok palsu.
  function gateClick(e: React.MouseEvent, link: NavLink) {
    if (
      link.requiresAuth &&
      session !== null &&
      !session.authenticated
    ) {
      e.preventDefault();
      setMenuOpen(false);
      setGateOpen(true);
    }
  }

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
    // ponytail: provider di dalam Navbar — halaman tanpa route layout
    // WagmiProvider sendiri tetap dapat wagmi. Config singleton, state shared,
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
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => gateClick(e, link)}
                  className="inline-flex min-touch items-center px-2 transition hover:text-ink"
                >
                  {link.label}
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
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    gateClick(e, link);
                    if (!e.defaultPrevented) setMenuOpen(false);
                  }}
                  className="flex min-touch items-center rounded-2xl px-4 text-slate400 transition hover:bg-black/5 hover:text-ink"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>
      {gateOpen && (
        <SignInModal
          title={AUTH_GATE_COPY.title}
          description={AUTH_GATE_COPY.description}
          onClose={() => setGateOpen(false)}
        />
      )}
    </WagmiProvider>
  );
}
