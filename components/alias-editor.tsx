"use client";

import { useId, useState } from "react";
import { useSession } from "@/components/use-session";

// ponytail: edit alias muncul hanya kalau sesi SIWE = address ini.
// Semua aturan validasi ada di server (lib/wallet/alias.ts); di sini cuma tampilkan error.

const MAX_ALIAS_LENGTH = 32;

export function AliasEditor({
  address,
  initialAlias,
}: {
  address: string;
  initialAlias: string | null;
}) {
  const { session } = useSession();
  const [alias, setAlias] = useState<string | null>(initialAlias);
  const [draft, setDraft] = useState(initialAlias ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const errorId = useId();

  const isOwner = session?.walletAddress === address;
  if (!isOwner) return null;

  async function save(next: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/wallets/${address}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alias: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save alias.");
        return;
      }
      setAlias(data.alias ?? null);
      setDraft(data.alias ?? "");
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate400">
        <span>
          Alias is cosmetic and not verified. It is your own display label.
        </span>
        <button
          type="button"
          onClick={() => {
            setDraft(alias ?? "");
            setEditing(true);
          }}
          className="btn-brutal-light px-4 py-2 text-xs"
        >
          {alias ? "Edit alias" : "Set alias"}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(draft);
      }}
      className="mt-3 flex flex-wrap items-center gap-2"
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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="input-brutal px-4 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="btn-brutal px-4 py-2 text-xs"
      >
        {busy ? "Saving…" : "Save"}
      </button>
      {alias && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(null)}
          className="btn-brutal-light px-4 py-2 text-xs hover:border-red-400/60 hover:text-red-600"
        >
          Clear
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
        className="text-xs text-slate400 underline"
      >
        Cancel
      </button>
      {error && (
        <span id={errorId} role="alert" className="w-full text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
