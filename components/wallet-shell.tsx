import Image from "next/image";
import Link from "next/link";
import { SearchWalletForm } from "@/components/search-wallet-form";
import { ConnectButton } from "@/components/connect-button";

export function WalletShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="bg-stars" />
      <div className="bg-grid" />

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
        <SearchWalletForm hint={false} size="md" />
        <div className="mt-14">{children}</div>
      </main>
    </div>
  );
}
