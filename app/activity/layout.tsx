"use client";

import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wallet/config";
import { WalletShell } from "@/components/wallet-shell";

// ponytail: wagmi untuk route /activity juga — WalletShell render
// ConnectButton yang pakai useAccount. Pola sama dengan wallets/layout.
export default function ActivityLayout({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <WalletShell>{children}</WalletShell>
    </WagmiProvider>
  );
}
