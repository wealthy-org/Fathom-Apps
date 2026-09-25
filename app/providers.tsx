"use client";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wallet/config";

// ponytail: WagmiProvider di root — modal/hook wagmi bisa muncul di
// subtree manapun (mis. SignInModal dari kartu feed), bukan cuma di
// bawah Navbar atau wallets layout. Config singleton, state shared,
// aman double-wrap dengan provider di Navbar/wallets layout.
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}
