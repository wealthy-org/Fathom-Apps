"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { robinhoodTestnet } from "@/lib/wallet/chains";
import { buildSiweMessage } from "@/lib/auth/message";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";
import { useSession } from "@/components/use-session";
import {
  handleMissingWallet,
  resolvePhantomConnector,
} from "@/components/connect-button";

/**
 * Claim Profile stepper (presentation + existing auth endpoints only).
 *
 * Connect → Sign → Verify → Claimed. The connected wallet must match the
 * viewed profile before signing; success refreshes the profile in place.
 * Claiming proves control — it never creates or modifies reputation.
 */

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type Phase = "connect" | "sign" | "verify" | "done";

const STEPS: { id: Phase; label: string }[] = [
  { id: "connect", label: "Connect" },
  { id: "sign", label: "Sign" },
  { id: "verify", label: "Verify" },
  { id: "done", label: "Claimed" },
];

export function ClaimFlow({
  profileAddress,
  claimedLabel,
}: {
  /** Normalized (lowercase) address of the viewed profile. */
  profileAddress: string;
  /** Preformatted claimed date, or null when unclaimed. */
  claimedLabel: string | null;
}) {
  const router = useRouter();
  const { address, isConnected, status } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const { session, isLoading: isSessionLoading, refresh } = useSession();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("connect");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ponytail: mount gate — SSR/client first render must match.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (claimedLabel !== null) {
    return (
      <p className="mt-3 text-xs text-slate400">
        <span className="mr-2 inline-block rounded-full border border-black/10 bg-white px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
          Claimed
        </span>
        Verified owner · {claimedLabel}. Claiming proves control only — it
        says nothing about trustworthiness.{" "}
        <span className="whitespace-nowrap">
          Pseudonymous by default ·{" "}
          <Link href="/#faq-identity" className="underline hover:text-ink">
            Privacy Model →
          </Link>
        </span>
      </p>
    );
  }

  if (!mounted || status === "reconnecting" || isSessionLoading) {
    return (
      <div className="mt-3">
        <button type="button" disabled className="btn-brutal-light px-4 py-2 text-xs">
          Claim this profile
        </button>
      </div>
    );
  }

  const connected = isConnected ? (address ?? null) : null;
  const matches =
    connected !== null && connected.toLowerCase() === profileAddress.toLowerCase();
  const sessionMismatch =
    !!session?.authenticated &&
    !!session.walletAddress &&
    session.walletAddress !== profileAddress.toLowerCase();

  async function handleReset() {
    setError(null);
    disconnect();
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
    setPhase("connect");
  }

  async function handleConnect() {
    setError(null);
    const phantom = await resolvePhantomConnector(connectors);
    if (!phantom) {
      setError(handleMissingWallet());
      return;
    }
    try {
      const res = await connectAsync({
        connector: phantom,
        chainId: robinhoodTestnet.id,
      });
      const cid = res.chainId;
      if (cid !== robinhoodTestnet.id) {
        await switchChainAsync({ chainId: robinhoodTestnet.id });
      }
      setPhase("sign");
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      setError(
        /reject|denied|cancel/i.test(msg)
          ? "Connection rejected. Try again when you're ready."
          : "Connection failed. Please try again.",
      );
    }
  }

  async function handleSign() {
    setError(null);
    if (!connected || !matches) return;
    const phantom = await resolvePhantomConnector(connectors);
    if (!phantom) {
      setError(handleMissingWallet());
      return;
    }
    setPhase("verify");
    setVerifying(true);
    try {
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();
      if (!nonce) throw new Error("No nonce received");

      const message = buildSiweMessage(
        connected,
        window.location.host,
        window.location.origin,
        nonce,
      );
      // Signature proves control — not a transaction, no state changes.
      const signature = await signMessageAsync({
        message,
        connector: phantom,
        account: connected,
      });

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Ownership verification failed.");
      }
      await refresh();
      setPhase("done");
      // Phase 0 instrumentation — claim flow reached done.
      trackEvent(ANALYTICS_EVENTS.profileClaimed, {
        address: profileAddress.toLowerCase(),
      });
      router.refresh();
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      setPhase("sign");
      setError(
        /reject|denied|cancel/i.test(msg)
          ? "Signature rejected. You can try again when you're ready."
          : msg || "Ownership verification failed. Please try again.",
      );
    } finally {
      setVerifying(false);
    }
  }

  const busy = isConnecting || isSwitching || isSigning || verifying;

  return (
    <div className="mt-3">
      <p className="text-xs text-slate400">
        Unclaimed — owner has not verified control of this address.{" "}
        <span className="whitespace-nowrap">
          Pseudonymous by default ·{" "}
          <Link href="/#faq-identity" className="underline hover:text-ink">
            Privacy Model →
          </Link>
        </span>
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setPhase(connected ? "sign" : "connect");
          }}
          className="btn-brutal-light mt-2 px-4 py-2 text-xs"
        >
          Claim this profile
        </button>
      ) : (
        <div className="panel-brutal mt-2 max-w-xl p-5">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px]">
            {STEPS.map((step, i) => {
              const reached =
                STEPS.findIndex((s) => s.id === phase) >= i;
              return (
                <li key={step.id} className="flex items-center gap-2">
                  {i > 0 && (
                    <span aria-hidden="true" className="text-slate400">→</span>
                  )}
                  <span
                    className={
                      phase === step.id
                        ? "font-bold text-accent-ink"
                        : reached
                          ? "text-ink"
                          : "text-slate400"
                    }
                  >
                    {i + 1}. {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {phase === "done" ? (
            <div className="mt-4">
              <p className="font-display text-base">Profile claimed</p>
              <p className="mt-1 text-sm text-slate400">
                You verified control of this wallet. Existing reputation and
                evidence remain unchanged.
              </p>
              <p className="mt-2 text-sm text-slate400">
                Next: support wallets you trust —{" "}
                <a
                  href="#community"
                  className="font-mono text-[11px] text-accent-ink hover:underline"
                >
                  Explore community →
                </a>
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-brutal-light mt-3 px-4 py-2 text-xs"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {sessionMismatch && (
                <p className="text-sm text-slate400">
                  This browser is signed in as a different wallet. Disconnect
                  it before claiming this profile.
                </p>
              )}
              {connected === null || sessionMismatch ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void (sessionMismatch ? handleReset() : handleConnect())
                  }
                  className="btn-brutal w-full px-4 py-2 text-xs sm:w-auto"
                >
                  {isConnecting || isSwitching
                    ? "Connecting…"
                    : sessionMismatch
                      ? "Disconnect other wallet"
                      : "Connect wallet"}
                </button>
              ) : !matches ? (
                <div>
                  <p className="font-display text-base">Wrong wallet</p>
                  <p className="mt-1 font-mono text-xs text-slate400">
                    <span title={profileAddress}>Profile: {shortAddress(profileAddress)}</span>
                    <br />
                    <span title={connected}>Connected: {shortAddress(connected)}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate400">
                    The connected wallet does not match this profile. Signing
                    cannot continue until the addresses match.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleReset()}
                    className="btn-brutal mt-2 w-full px-4 py-2 text-xs sm:w-auto"
                  >
                    Switch wallet
                  </button>
                </div>
              ) : (
                <div>
                  <p className="font-mono text-xs text-slate400" title={connected}>
                    Connected: {shortAddress(connected)}
                  </p>
                  <p className="mt-1 text-sm text-slate400">
                    Sign a message to prove you control this wallet address.
                    This signature does not create a transaction and does not
                    change your reputation.
                  </p>
                  <p className="mt-1 text-xs text-slate400">
                    Pseudonymous by default — no real-world identity is
                    required to claim.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSign()}
                    className="btn-brutal mt-2 w-full px-4 py-2 text-xs sm:w-auto"
                  >
                    {isSigning
                      ? "Waiting for wallet signature…"
                      : verifying
                        ? "Verifying ownership…"
                        : "Sign message"}
                  </button>
                  {isSigning && (
                    <p className="mt-1 text-xs text-slate400">
                      Confirm the message in your wallet.
                    </p>
                  )}
                </div>
              )}
              {error && (
                <div>
                  <p role="alert" className="text-sm text-ink">{error}</p>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="mt-1 font-mono text-[11px] text-accent-ink hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <p className="text-xs text-slate400">
                Claiming proves wallet ownership. It does not create,
                increase, or modify reputation — reputation comes from wallet
                evidence and activity.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
