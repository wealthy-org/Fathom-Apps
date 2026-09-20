"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MainShell } from "@/components/main-shell";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { ConnectButton } from "@/components/connect-button";

export function WalletShell({ children }: { children: React.ReactNode }) {
  // ponytail: /wallets renders its own hero search — one search box per page.
  const pathname = usePathname();
  const showSearch =
    pathname === null || pathname.replace(/\/+$/, "") !== "/wallets";
  return (
    <div className="relative min-h-screen py-0 sm:py-3 lg:py-5">
      <MainShell>
      <header className="mx-4 mt-3 sm:mx-8 sm:mt-5">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 rounded-full border border-black/5 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl">
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
          <ConnectButton className="btn-brutal shrink-0 px-3 py-2 text-xs sm:px-4 sm:text-sm disabled:cursor-not-allowed" />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-6 lg:px-8">
        {showSearch && <SearchWalletForm hint={false} size="md" />}
        <div className="mt-14">{children}</div>
      </main>
      </MainShell>
    </div>
  );
}
