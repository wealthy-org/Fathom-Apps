"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Single shared navbar for landing and wallet pages.
 *
 * Floating glass pill, identical spacing/typography/mobile behavior
 * everywhere. Callers pass section links + contextual actions:
 * landing uses anchors + Check a Wallet; wallet pages use product
 * links + ConnectButton.
 */

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      {/* ponytail: mark is light-on-dark art; invert for the white pill */}
      <Image
        src="/logo-no-bg.png"
        alt="Fathom"
        width={40}
        height={40}
        className="h-10 w-10 invert"
      />
      <span className="font-display text-lg font-semibold tracking-tight">
        Fathom
      </span>
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
  links,
  actions,
}: {
  links: Array<[string, string]>;
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
    <nav
      ref={navRef}
      className="sticky top-3 z-50 mx-4 mt-3 sm:mx-8 sm:mt-5 lg:mx-12"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 rounded-full border border-black/5 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl">
        <Logo />
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
          {actions}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="min-touch inline-flex items-center justify-center rounded-full p-2 text-ink md:hidden"
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <div
          id="mobile-menu"
          className="mt-2 rounded-3xl border border-black/5 bg-white/95 p-4 shadow-xl backdrop-blur-xl md:hidden"
        >
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
            <Link
              href="/wallets"
              onClick={() => setMenuOpen(false)}
              className="btn-brutal mt-2 flex min-touch items-center justify-center px-4 py-3 text-sm"
            >
              Check a Wallet
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
