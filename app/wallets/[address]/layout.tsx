import type { ReactNode } from "react";
import { WalletShell } from "@/components/wallet-shell";

// ponytail: shell lives in the layout so header + search stay mounted
// while loading.tsx / error.tsx swap the content below.
export default function WalletProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <WalletShell>{children}</WalletShell>;
}
