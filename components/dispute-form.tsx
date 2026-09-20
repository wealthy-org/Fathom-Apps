"use client";

import { useState } from "react";
import { useSignMessage } from "wagmi";
import { useSession } from "@/components/use-session";
import { buildDisputeMessage } from "@/lib/disputes/payload";
import { THRESHOLDS } from "@/config/thresholds";

// ponytail: form dispute muncul hanya saat sesi SIWE aktif dan bukan profil sendiri.
// Server membangun ulang payload kanonik dari field + alamat sesi, jadi signature
// di sini hanya valid untuk isi yang benar-benar dikirim.

export function DisputeForm({ target }: { target: string }) {
  const { session } = useSession();
  const { signMessageAsync, isPending } = useSignMessage();
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reporter = session?.walletAddress ?? null;
  if (!session?.authenticated || !reporter || reporter === target) return null;

  async function submit() {
    if (!reporter) return;
    setError(null);
    setDone(false);
    try {
      const issuedAt = new Date().toISOString();
      const message = buildDisputeMessage({
        reporter,
        target,
        reason,
        evidence,
        issuedAt,
      });
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, reason, evidence, issuedAt, signature }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Dispute failed.");
        return;
      }
      setDone(true);
      setReason("");
      setEvidence("");
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      setError(
        /reject|denied|cancel/i.test(msg)
          ? "Cancelled. Click once more to try again."
          : "Dispute failed. Please try again.",
      );
    }
  }

  return (
    <div className="panel-brutal mt-4 p-5">
      <h3 className="font-display text-base">File a dispute</h3>
      <p className="mt-1 text-xs text-slate400">
        A dispute is a signed report, not proof of wrongdoing. It does not
        change reputation or risk here.
      </p>
      <div className="mt-4 grid gap-3">
        <input
          value={reason}
          maxLength={THRESHOLDS.dispute.maxReasonLength}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (short summary)"
          className="input-brutal px-3 py-2 text-sm"
        />
        <textarea
          value={evidence}
          maxLength={THRESHOLDS.dispute.maxEvidenceLength}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Evidence (links, tx hashes, context)"
          rows={3}
          className="input-brutal px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={isPending || reason.trim() === "" || evidence.trim() === ""}
          onClick={() => void submit()}
          className="btn-brutal px-4 py-2 text-xs"
        >
          {isPending ? "Signing…" : "Sign & report"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {done && (
        <p className="mt-3 text-xs text-accent-ink">
          Dispute recorded as open. Refresh to see it in the list below.
        </p>
      )}
    </div>
  );
}
