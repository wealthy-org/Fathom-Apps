import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { robinhoodTestnet } from "@/lib/wallet/chains";

// ponytail: injected-only — Phantom EVM mode terdeteksi via EIP-6963.
// Tanpa WalletConnect = tanpa project ID / akun cloud.
export const wagmiConfig = createConfig({
  chains: [robinhoodTestnet],
  connectors: [injected()],
  // ponytail: ssr:true = Hydrate internal wagmi menunda onMount (reconnect)
  // ke useEffect. Tanpa ini onMount jalan saat render dan memicu
  // "Cannot update ConnectButton while rendering Hydrate".
  ssr: true,
  transports: {
    [robinhoodTestnet.id]: http(),
  },
});
