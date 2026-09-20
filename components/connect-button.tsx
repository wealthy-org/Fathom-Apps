"use client";

import { useState, useSyncExternalStore } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
  type Connector,
} from "wagmi";
import { robinhoodTestnet } from "@/lib/wallet/chains";
import { wagmiConfig } from "@/lib/wallet/config";
import { buildSiweMessage } from "@/lib/auth/message";
import { useSession } from "@/components/use-session";

// ponytail: 1 tombol, 1 klik: connect → (switch) → sign → verify.
// Tanpa copy "Install" — wallet tak terdeteksi = alert (+ deep-link di mobile).
// EIP-6963 announce bisa telat: beri 1x jeda 800ms sebelum vonis hilang.

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function isMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

// Shared with ClaimFlow: Phantom-first connector resolution.
// EIP-6963 announce can be late: one 800ms retry before giving up.
export async function resolvePhantomConnector(
  connectors: readonly Connector[],
): Promise<Connector | undefined> {
  const match = (c: { id: string; name: string }) =>
    /phantom/i.test(`${c.id} ${c.name}`);
  const found = connectors.find(match);
  if (found) return found;
  await new Promise((r) => setTimeout(r, 800));
  return wagmiConfig.connectors.find(match);
}

export function handleMissingWallet() {
  if (isMobileBrowser()) {
    if (
      window.confirm(
        "Phantom wallet not detected in this browser. Open this site inside Phantom's browser?",
      )
    ) {
      window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(
        window.location.href,
      )}`;
    }
    return;
  }
  window.alert(
    "Phantom wallet not detected. Install Phantom (phantom.app/download), then try again.",
  );
}

export function ConnectButton({
  className = "",
  connectLabel = "Connect Wallet",
}: {
  className?: string;
  connectLabel?: string;
}) {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const {
    connectors,
    connectAsync,
    isPending: isConnecting,
    error: connectError,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    switchChainAsync,
    isPending: isSwitching,
    error: switchError,
  } = useSwitchChain();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const { session, isLoading: isSessionLoading, refresh } = useSession();
  const [flowError, setFlowError] = useState<string | null>(null);

  const base =
    className ||
    "btn-brutal px-4 py-2 text-xs disabled:cursor-not-allowed";

  // ponytail: mount gate — SSR/client render pertama harus identik.
  // useSyncExternalStore menghindari setState sinkron di effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted || status === "reconnecting" || isSessionLoading) {
    return (
      <button type="button" disabled className={base}>
        <span>{connectLabel}</span>
      </button>
    );
  }

  // ponytail: session milik wallet lain (ganti wallet tanpa disconnect) = belum signed.
  const signedIn =
    !!session?.authenticated &&
    !!address &&
    session.walletAddress === address.toLowerCase();

  // Shared with ClaimFlow: same Phantom-first resolution, incl. EIP-6963 delay.
  async function resolvePhantom() {
    return resolvePhantomConnector(connectors);
  }

  async function handlePrimary() {
    setFlowError(null);
    const phantom = await resolvePhantom();
    if (!phantom) {
      handleMissingWallet();
      return;
    }
    try {
      let account = address;
      let cid: number = chainId;
      if (!isConnected) {
        const res = await connectAsync({
          connector: phantom,
          chainId: robinhoodTestnet.id,
        });
        account = res.accounts[0] ?? account;
        cid = res.chainId;
      }
      if (cid !== robinhoodTestnet.id) {
        await switchChainAsync({ chainId: robinhoodTestnet.id });
      }
      const target = account ?? address;
      if (!target) throw new Error("No account connected");

      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();
      if (!nonce) throw new Error("No nonce received");

      const message = buildSiweMessage(
        target,
        window.location.host,
        window.location.origin,
        nonce,
      );
      const signature = await signMessageAsync({
        message,
        connector: phantom,
        account: target,
      });

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlowError(data?.error?.message ?? "Sign in failed.");
        return;
      }
      await refresh();
    } catch (e) {
      console.error("wallet sign-in failed:", e);
      const msg = (e as Error)?.message ?? "";
      setFlowError(
        /reject|denied|cancel/i.test(msg)
          ? "Cancelled. Click once more to try again."
          : "Sign in failed. Please try again.",
      );
    }
  }

  async function handleDisconnect() {
    disconnect();
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
  }

  if (signedIn) {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-2">
        <span className="rounded-md border-2 border-ink bg-white px-3 py-2 font-mono text-xs text-ink shadow-[2px_2px_0_#0b0f17] sm:px-4 sm:text-sm">
          {shortAddress(address!)}
        </span>
        <button
          type="button"
          onClick={() => void handleDisconnect()}
          className="btn-brutal-light px-3 py-2 text-xs sm:px-4 sm:text-sm hover:border-red-400/60 hover:text-red-600"
        >
          Disconnect
        </button>
      </span>
    );
  }

  const busy = isConnecting || isSwitching || isSigning;

  return (
    <button
      type="button"
      disabled={busy}
      title={flowError ?? connectError?.message ?? switchError?.message}
      onClick={() => void handlePrimary()}
      className={base}
    >
      <span>
        {busy
          ? isSigning
            ? "Signing…"
            : isSwitching
              ? "Switching…"
              : "Connecting…"
          : flowError
            ? "Try again"
            : connectLabel}
      </span>
    </button>
  );
}
