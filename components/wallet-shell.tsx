"use client";

import { Navbar } from "@/components/layout/Navbar";

export function WalletShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* ponytail: links + Sign In + search disediakan Navbar sendiri. */}
      <Navbar />

      <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-8">
        <main
          id="main-content"
          className="relative z-10 mx-auto max-w-5xl pb-24 pt-10"
        >
          <div className="mt-14">{children}</div>
        </main>
      </div>
    </div>
  );
}
