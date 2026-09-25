"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@/components/connect-button";
import { useSession } from "@/components/use-session";
import { WalletAvatar } from "@/components/wallet-avatar";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Simplified Phantom ghost mark in brand purple. */
function PhantomLogo() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
    >
      <path
        d="M12 2.5c-4.9 0-8 3.2-8 8.4V17l2.4-1.5 1.8 1.5h7.6l1.8-1.5L20 17v-6.1c0-5.2-3.1-8.4-8-8.4Z"
        fill="#AB9FF2"
      />
      <circle cx="9" cy="11" r="1.2" fill="#fff" />
      <circle cx="15" cy="11" r="1.2" fill="#fff" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

const MAX_ALIAS_LENGTH = 32;

function aliasCacheKey(lower: string) {
  return `fathom:alias:${lower}`;
}

/** sessionStorage read-through: undefined = no cache. SSR-safe. */
function readCachedAlias(lower: string): string | null | undefined {
  try {
    if (typeof sessionStorage === "undefined") return undefined;
    const raw = sessionStorage.getItem(aliasCacheKey(lower));
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "string" || parsed === null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedAlias(lower: string, alias: string | null) {
  try {
    sessionStorage.setItem(aliasCacheKey(lower), JSON.stringify(alias));
  } catch {
    // storage penuh/diblokir — alias tetap dari network.
  }
}

/**
 * Isi dropdown wallet terhubung: avatar + address (copy) + alias (lihat/set)
 * + My Activity + Disconnect. Alias butuh sesi SIWE yang cocok dengan address;
 * tanpa sesi, baris alias nonaktif dengan hint.
 */
function AccountMenu({
  address,
  onNavigate,
  onDisconnect,
  onRequireAuth,
}: {
  address: string;
  onNavigate: () => void;
  onDisconnect: () => void;
  onRequireAuth: () => void;
}) {
  const { session } = useSession();
  const lower = address.toLowerCase();
  // ponytail: cache dulu agar alias langsung tampil; network revalidate.
  const [cached] = useState<string | null | undefined>(() =>
    readCachedAlias(lower),
  );
  const [alias, setAlias] = useState<string | null>(cached ?? null);
  const [aliasLoaded, setAliasLoaded] = useState(cached !== undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputId = useId();
  const errorId = useId();

  const isOwner =
    !!session?.authenticated && session.walletAddress === lower;

  // ponytail: alias di-fetch tiap dropdown dibuka (revalidate) dan ditulis
  // ke sessionStorage; buka berikutnya tampil instan dari cache.
  useEffect(() => {
    let active = true;
    fetch(`/api/wallets/${lower}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const next = (data?.alias as string | null) ?? null;
        setAlias(next);
        writeCachedAlias(lower, next);
        setAliasLoaded(true);
      })
      .catch(() => {
        if (active) setAliasLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [lower]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard diblokir — address tetap terlihat di dropdown.
    }
  }

  async function save(next: string | null) {
    setSaving(true);
    setAliasError(null);
    try {
      const res = await fetch(`/api/wallets/${lower}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alias: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAliasError(data?.error?.message ?? "Could not save alias.");
        return;
      }
      setAlias(data.alias ?? null);
      writeCachedAlias(lower, data.alias ?? null);
      setDraft(data.alias ?? "");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="menu" className="panel-brutal absolute right-0 top-full z-50 mt-2 w-64 p-3">
      <div className="flex items-center gap-2.5 px-1 pb-2.5">
        <WalletAvatar address={address} size={28} />
        <div className="min-w-0 flex-1">
          {alias && (
            <p className="truncate text-sm font-semibold text-ink">{alias}</p>
          )}
          <p className="truncate font-mono text-xs text-slate400">
            {shortAddress(address)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Copied" : "Copy address"}
          className="inline-flex min-touch shrink-0 items-center justify-center rounded-full p-2 text-slate400 transition hover:bg-black/5 hover:text-ink"
        >
          {copied ? (
            <span className="text-[11px] font-semibold text-ink">Copied</span>
          ) : (
            <CopyIcon />
          )}
        </button>
      </div>
      {aliasLoaded && isOwner && (alias || editing) && (
      <div className="border-t border-black/5 px-1 py-2">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(draft);
            }}
            className="flex flex-col gap-2"
          >
            <label htmlFor={inputId} className="sr-only">
              Alias (optional)
            </label>
            <input
              id={inputId}
              value={draft}
              maxLength={MAX_ALIAS_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Alias (optional)"
              aria-invalid={aliasError ? true : undefined}
              aria-describedby={aliasError ? errorId : undefined}
              className="input-brutal w-full px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-brutal px-3 py-1.5 text-xs"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setAliasError(null);
                }}
                className="text-xs text-slate400 underline"
              >
                Cancel
              </button>
            </div>
            {aliasError && (
              <span id={errorId} role="alert" className="text-xs text-red-600">
                {aliasError}
              </span>
            )}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(alias ?? "");
              setEditing(true);
            }}
            className="btn-brutal-light w-full px-3 py-2 text-xs"
          >
            Edit alias
          </button>
        )}
      </div>
      )}
      <div className="border-t border-black/5 pt-1">
        <Link
          href="/me"
          role="menuitem"
          onClick={(e) => {
            // Connect saja belum cukup — butuh sesi SIWE.
            if (session !== null && !session.authenticated) {
              e.preventDefault();
              onRequireAuth();
              return;
            }
            onNavigate();
          }}
          className="flex min-touch items-center rounded-2xl px-4 text-sm text-ink/80 transition hover:bg-black/5 hover:text-ink"
        >
          My Activity
        </Link>
        <button
          type="button"
          role="menuitem"
          onClick={onDisconnect}
          className="flex min-touch w-full items-center rounded-2xl px-4 text-sm text-ink/80 transition hover:bg-black/5 hover:text-red-600"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/**
 * Tombol Sign In navbar + modal connect Phantom.
 * Flow connect reuse ConnectButton (resolve → switch → SIWE → verify).
 * Sukses = modal tutup via onSuccess; tanpa redirect baru.
 */
export function SignInButton() {
  const { address, isConnected, status } = useAccount();
  const { disconnect } = useDisconnect();
  const { refresh } = useSession();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ponytail: mount gate — SSR/client render pertama harus identik.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!menuOpen && !modalOpen && !gateOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setModalOpen(false);
        setGateOpen(false);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen, modalOpen, gateOpen]);

  async function handleDisconnect() {
    setMenuOpen(false);
    disconnect();
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
  }

  if (!mounted || status === "reconnecting") {
    return (
      <span
        aria-hidden="true"
        className="inline-block h-9 w-9 animate-pulse rounded-full bg-black/10 motion-reduce:animate-none"
      />
    );
  }

  if (isConnected && address) {
    return (
      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Account ${shortAddress(address)}`}
          title={shortAddress(address)}
          onClick={() => setMenuOpen((v) => !v)}
          className="min-touch rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <WalletAvatar address={address} size={36} />
        </button>
        {menuOpen && (
          <AccountMenu
            address={address}
            onNavigate={() => setMenuOpen(false)}
            onDisconnect={() => void handleDisconnect()}
            onRequireAuth={() => {
              setMenuOpen(false);
              setGateOpen(true);
            }}
          />
        )}
        {gateOpen && (
          <SignInModal
            title={AUTH_GATE_COPY.title}
            description={AUTH_GATE_COPY.description}
            onClose={() => setGateOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="btn-brutal px-5 py-2.5 text-sm"
      >
        <span>Sign In</span>
      </button>
      {modalOpen && <SignInModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

/** Copy modal gate untuk link yang butuh SIWE (My Activity). */
export const AUTH_GATE_COPY = {
  title: "Sign in required",
  description:
    "You must sign in first to view your activity. Connect your wallet to continue.",
} as const;

/** Copy modal gate untuk vote Helpful/Not helpful (Spec 04 3.3). */
export const REACTION_GATE_COPY = {
  title: "Sign in required",
  description:
    "You must sign in first to rate this. Connect your wallet to continue.",
} as const;

export function SignInModal({
  onClose,
  title = "Sign In",
  description = "Connect your wallet to claim your profile and sign attestations.",
}: {
  onClose: () => void;
  title?: string;
  description?: string;
}) {
  // ponytail: portal ke body — navbar punya backdrop-blur yang jadi
  // containing block untuk fixed descendant (modal nempel di navbar).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign In"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div className="panel-brutal relative w-full max-w-sm p-6 text-center sm:p-7">
        <button
          type="button"
          aria-label="Close sign in"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex min-touch items-center justify-center rounded-full p-2 text-slate400 transition hover:bg-black/5 hover:text-ink"
        >
          <CloseIcon />
        </button>
        <h2 className="font-display text-xl font-semibold font-mono">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate400 font-mono">
          {description}
        </p>
        <div className="mt-5">
          <ConnectButton
            connectLabel="Connect with Phantom"
            leadingIcon={<PhantomLogo />}
            align="center"
            onSuccess={onClose}
            className="btn-brutal w-full px-5 py-3 text-sm disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
