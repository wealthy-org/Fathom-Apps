"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";

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
      <Image
        src="/logo-no-bg.png"
        alt="Fathom"
        width={40}
        height={40}
        className="h-10 w-10"
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

  return (
    <nav className="sticky top-3 z-50 mx-4 mt-3 sm:mx-8 sm:mt-5 lg:mx-12">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 rounded-full border border-black/5 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl">
        <Logo />
        {links.length > 0 && (
          <div className="hidden items-center gap-7 text-sm text-slate400 md:flex">
            {links.map(([t, href]) => (
              <a key={t} href={href} className="transition hover:text-ink">
                {t}
              </a>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          {actions}
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
            {links.map(([t, href]) => (
              <a
                key={t}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="rounded-2xl px-4 py-3 text-slate400 transition hover:bg-black/5 hover:text-ink"
              >
                {t}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
