"use client";

import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wallet/config";

// ponytail: wagmi hanya untuk route /wallets — halaman statis (docs)
// tidak ikut bayar bundle.
export default function WalletsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
