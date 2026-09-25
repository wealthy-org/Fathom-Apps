"use client";

import { useState } from "react";
import {
  REACTION_GATE_COPY,
  SignInModal,
} from "@/components/sign-in-modal";

type Vote = "helpful" | "not_helpful" | null;

/**
 * Tombol "Helpful / Not helpful" pada kartu feed (Spec 04 3.3) — semua
 * kind (attestation/dispute/vouch/claim). DISPLAY-ONLY: tidak pernah
 * dibaca file scoring manapun, tidak ada +1/-1 ke skor. Count + myVote
 * di-seed server dari feed; klik anonim = modal sign-in, tanpa POST.
 */
export function EventReactions({
  kind,
  targetId,
  initialHelpful,
  initialNotHelpful,
  initialMyVote,
}: {
  kind: string;
  targetId: string;
  initialHelpful: number;
  initialNotHelpful: number;
  initialMyVote: Vote;
}) {
  const [helpful, setHelpful] = useState(initialHelpful);
  const [notHelpful, setNotHelpful] = useState(initialNotHelpful);
  const [myVote, setMyVote] = useState<Vote>(initialMyVote);
  const [saving, setSaving] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  const vote = async (value: "helpful" | "not_helpful") => {
    if (saving) return;
    if (myVote === value) return;
    const prevVote = myVote;
    const prevHelpful = helpful;
    const prevNotHelpful = notHelpful;
    setSaving(true);
    setMyVote(value);
    if (value === "helpful") {
      setHelpful((n) => n + 1);
      if (prevVote === "not_helpful") setNotHelpful((n) => Math.max(0, n - 1));
    } else {
      setNotHelpful((n) => n + 1);
      if (prevVote === "helpful") setHelpful((n) => Math.max(0, n - 1));
    }
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id: targetId, value }),
      });
      if (res.status === 401) {
        // Belum sign-in: rollback angka, buka modal. User klik lagi
        // setelah masuk; POST baru berjalan penuh.
        setMyVote(prevVote);
        setHelpful(prevHelpful);
        setNotHelpful(prevNotHelpful);
        setSignInOpen(true);
        return;
      }
      if (!res.ok) throw new Error("http");
    } catch {
      setMyVote(prevVote);
      setHelpful(prevHelpful);
      setNotHelpful(prevNotHelpful);
    } finally {
      setSaving(false);
    }
  };

  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11px] text-slate400">
        Was this clear/useful?
      </span>
      <button
        type="button"
        onClick={() => void vote("helpful")}
        disabled={saving}
        aria-pressed={myVote === "helpful"}
        className={`${base} ${
          myVote === "helpful"
            ? "border-ink bg-ink text-white"
            : "border-ink/20 bg-white text-ink hover:border-ink"
        }`}
      >
        👍 Helpful · <span className="tabular-nums">{helpful}</span>
      </button>
      <button
        type="button"
        onClick={() => void vote("not_helpful")}
        disabled={saving}
        aria-pressed={myVote === "not_helpful"}
        className={`${base} ${
          myVote === "not_helpful"
            ? "border-ink bg-ink text-white"
            : "border-ink/20 bg-white text-ink hover:border-ink"
        }`}
      >
        👎 Not helpful · <span className="tabular-nums">{notHelpful}</span>
      </button>
      {signInOpen && (
        <SignInModal
          onClose={() => setSignInOpen(false)}
          title={REACTION_GATE_COPY.title}
          description={REACTION_GATE_COPY.description}
        />
      )}
    </div>
  );
}
