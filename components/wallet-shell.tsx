"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { ConnectButton } from "@/components/connect-button";

const SHELL_LINKS: Array<[string, string]> = [
  ["Check Wallet", "/wallets"],
  ["Activity", "/activity"],
  ["My Activity", "/activity/me"],
  ["About", "/#about"],
  ["How It Works", "/#how"],
  ["FAQ", "/#faq"],
];

export function WalletShell({ children }: { children: React.ReactNode }) {
  // ponytail: /wallets renders its own hero search — one search box per page.
  const pathname = usePathname();
  const showSearch =
    pathname === null || pathname.replace(/\/+$/, "") !== "/wallets";
  return (
    <div className="relative min-h-screen">
      <Navbar
        links={SHELL_LINKS}
        actions={
          <ConnectButton className="btn-brutal shrink-0 px-3 py-2 text-xs sm:px-4 sm:text-sm disabled:cursor-not-allowed" />
        }
      />

      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-8">
        <main
          id="main-content"
          className="relative z-10 mx-auto max-w-5xl pb-24 pt-10"
        >
          {showSearch && <SearchWalletForm hint={false} size="md" />}
          <div className="mt-14">{children}</div>
        </main>
      </div>
    </div>
  );
}
