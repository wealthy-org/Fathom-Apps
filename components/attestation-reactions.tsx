"use client";

import { useEffect, useState } from "react";
import { SignInModal } from "@/components/sign-in-modal";

type Vote = "helpful" | "not_helpful" | null;

/**
 * Tombol "Helpful / Not helpful" pada kartu attestation (Spec 04 3.3).
 * DISPLAY / SORTING ONLY dalam 1 wallet profile — nilai ini TIDAK PERNAH
 * dibaca oleh score-strategy.ts atau file scoring manapun. Bukan
 * upvote/downvote Ethos: tidak ada +1/-1 ke skor kredibilitas.
 *
 * Count publik (dibaca anonim). Vote wajib SIWE login: klik anonim
 * mengarahkan ke connect, tidak pernah POST anonim.
 */
export function AttestationReactions({
  attestationId,
  initialHelpful,
  initialNotHelpful,
}: {
  attestationId: number;
  initialHelpful: number;
  initialNotHelpful: number;
}) {
  const [helpful, setHelpful] = useState(initialHelpful);
  const [notHelpful, setNotHelpful] = useState(initialNotHelpful);
  const [myVote, setMyVote] = useState<Vote>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/attestations/${attestationId}/reactions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("http"))))
      .then((data) => {
        if (cancelled) return;
        if (typeof data.helpful === "number") setHelpful(data.helpful);
        if (typeof data.notHelpful === "number") setNotHelpful(data.notHelpful);
        setMyVote(
          data.myVote === "helpful" || data.myVote === "not_helpful"
            ? data.myVote
            : null,
        );
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attestationId]);

  const vote = async (value: "helpful" | "not_helpful") => {
    if (saving) return;
    // Toggle: klik vote yang sama = batalkan? Tidak — upsert saja;
    // klik ulang nilai sama tidak mengubah apa-apa.
    if (myVote === value) return;
    const prevVote = myVote;
    const prevHelpful = helpful;
    const prevNotHelpful = notHelpful;
    setSaving(true);
    // Optimistik: geser count lalu konfirmasi server.
    setMyVote(value);
    if (value === "helpful") {
      setHelpful((n) => n + 1);
      if (prevVote === "not_helpful") setNotHelpful((n) => Math.max(0, n - 1));
    } else {
      setNotHelpful((n) => n + 1);
      if (prevVote === "helpful") setHelpful((n) => Math.max(0, n - 1));
    }
    try {
      const res = await fetch(`/api/attestations/${attestationId}/reactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (res.status === 401) {
        // Belum sign-in: kembalikan state, munculkan modal sign-in.
        // Modal hanya menutup; user klik vote lagi setelah masuk.
        setMyVote(prevVote);
        setHelpful(prevHelpful);
        setNotHelpful(prevNotHelpful);
        setSignInOpen(true);
        return;
      }
      if (!res.ok) throw new Error("http");
    } catch {
      // Gagal: rollback ke angka sebelumnya.
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
    <div
      className="mt-3 flex flex-wrap items-center gap-2"
      aria-label="Was this attestation clear and useful?"
    >      <span className="font-mono text-[11px] text-slate400">
        Was this clear/useful?
      </span>
      <button
        type="button"
        onClick={() => void vote("helpful")}
        disabled={!loaded || saving}
        aria-pressed={myVote === "helpful"}
        className={`${base} ${
          myVote === "helpful"
            ? "border-ink bg-ink text-white"
            : "border-ink/20 bg-white text-ink hover:border-ink"
        }`}
      >
        Helpful · <span className="tabular-nums">{helpful}</span>
      </button>
      <button
        type="button"
        onClick={() => void vote("not_helpful")}
        disabled={!loaded || saving}
        aria-pressed={myVote === "not_helpful"}
        className={`${base} ${
          myVote === "not_helpful"
            ? "border-ink bg-ink text-white"
            : "border-ink/20 bg-white text-ink hover:border-ink"
        }`}
      >
        Not helpful · <span className="tabular-nums">{notHelpful}</span>
      </button>
      {signInOpen && <SignInModal onClose={() => setSignInOpen(false)} />}
    </div>
  );
}
