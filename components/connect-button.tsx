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
// Wallet tak terdeteksi = pesan inline (bukan alert). EIP-6963 announce bisa
// telat: beri 1x jeda 800ms sebelum vonis hilang.

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

// Returns the visible inline message to show instead of alert/confirm.
// ponytail: no deep-link action anymore — caller displays the message only.
export function handleMissingWallet(): string {
  return isMobileBrowser()
    ? "Phantom wallet not detected in this browser. Open this site inside Phantom's browser, then try again."
    : "Phantom wallet not detected. Install Phantom (phantom.app/download), then try again.";
}

/** True when an inline connect error means the wallet is missing. */
export function isMissingWalletError(message: string): boolean {
  return /not detected/i.test(message);
}

export function ConnectButton({
  className = "",
  connectLabel = "Connect Wallet",
  leadingIcon,
  align = "start",
  onSuccess,
}: {
  className?: string;
  connectLabel?: string;
  leadingIcon?: React.ReactNode;
  align?: "start" | "center";
  onSuccess?: () => void;
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
      setFlowError(handleMissingWallet());
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
      onSuccess?.();
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
      <span className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
        <span className="w-full truncate rounded-full border border-black/10 bg-white px-3 py-2 text-center font-mono text-xs text-ink shadow-sm md:w-auto sm:px-4 sm:text-sm">
          {shortAddress(address!)}
        </span>
        <button
          type="button"
          onClick={() => void handleDisconnect()}
          className="btn-brutal-light min-touch w-full px-3 py-2 text-xs md:w-auto sm:px-4 sm:text-sm hover:border-red-400/60 hover:text-red-600"
        >
          Disconnect
        </button>
      </span>
    );
  }

  const busy = isConnecting || isSwitching || isSigning;
  const inlineError = flowError ?? connectError?.message ?? switchError?.message;
  const missingWallet =
    typeof inlineError === "string" && isMissingWalletError(inlineError);

  return (
    <span
      className={`flex w-full flex-col md:w-auto ${align === "center" ? "md:items-center" : "md:items-start"}`}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => void handlePrimary()}
        className={`${base} min-touch w-full justify-center md:w-auto`}
      >
        {leadingIcon}
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
      {inlineError && (
        <span
          role="alert"
          className={`text-[11px] leading-snug text-red-600 ${
            align === "center"
              ? "mt-2 w-full text-center"
              : "max-w-56 text-left"
          }`}
        >
          {missingWallet ? (
            <>
              Phantom wallet not detected.{" "}
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-red-700"
              >
                Install Phantom
              </a>
            </>
          ) : (
            inlineError
          )}
        </span>
      )}
    </span>
  );
}
