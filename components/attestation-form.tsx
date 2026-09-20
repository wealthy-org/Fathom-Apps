"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignMessage } from "wagmi";
import { useSession } from "@/components/use-session";
import { ConnectButton } from "@/components/connect-button";
import { ATTESTATION_ROLES } from "@/lib/attestations/roles";
import { buildAttestationMessage } from "@/lib/attestations/payload";
import { THRESHOLDS } from "@/config/thresholds";

// ponytail: form attestation muncul hanya saat sesi SIWE aktif dan bukan profil sendiri.
// Pengunjung signed-out melihat prompt connect (bukan form). Server membangun ulang
// payload kanonik dari field + alamat sesi, jadi signature di sini hanya valid
// untuk isi yang benar-benar dikirim.

export function AttestationForm({ subject }: { subject: string }) {
  const { session, isLoading } = useSession();
  const router = useRouter();
  const { signMessageAsync, isPending } = useSignMessage();
  const [role, setRole] = useState<string>(ATTESTATION_ROLES[0]);
  const [relationship, setRelationship] = useState("");
  const [duration, setDuration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const attester = session?.walletAddress ?? null;
  if (isLoading) return null;
  if (!session?.authenticated || !attester) {
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">Attest to this wallet</h3>
        <p className="mt-1 text-xs text-slate400">
          Connect your wallet to attest to this profile. Attestations are
          pseudonymous supporting evidence — they never replace on-chain
          behavior, and they do not create reputation on their own.
        </p>
        <div className="mt-4">
          <ConnectButton connectLabel="Connect wallet to attest" />
        </div>
      </div>
    );
  }
  if (attester === subject) return null;

  async function submit() {
    if (!attester) return;
    setError(null);
    setDone(false);
    try {
      const durationMonths =
        duration.trim() === "" ? null : Number.parseInt(duration, 10);
      if (durationMonths !== null && !Number.isFinite(durationMonths)) {
        setError("Duration must be a whole number of months.");
        return;
      }
      const issuedAt = new Date().toISOString();
      const message = buildAttestationMessage({
        attester,
        subject,
        role: role as (typeof ATTESTATION_ROLES)[number],
        relationship,
        durationMonths,
        issuedAt,
      });
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/attestations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject,
          role,
          relationship,
          durationMonths,
          issuedAt,
          signature,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Attestation failed.");
        return;
      }
      setDone(true);
      setRelationship("");
      setDuration("");
      // Server component re-fetch: attestation baru langsung tampil di daftar.
      router.refresh();
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      setError(
        /reject|denied|cancel/i.test(msg)
          ? "Cancelled. Click once more to try again."
          : "Attestation failed. Please try again.",
      );
    }
  }

  return (
    <div className="panel-brutal mt-4 p-5">
      <h3 className="font-display text-base">Attest to this wallet</h3>
      <p className="mt-1 text-xs text-slate400">
        Attestations are pseudonymous supporting evidence. Signing proves you
        made this claim; it does not create reputation.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="input-brutal px-3 py-2 text-sm"
        >
          {ATTESTATION_ROLES.map((r) => (
            <option key={r} value={r} className="bg-white text-ink">
              {r}
            </option>
          ))}
        </select>
        <input
          value={relationship}
          maxLength={THRESHOLDS.attestation.maxRelationshipLength}
          onChange={(e) => setRelationship(e.target.value)}
          placeholder="Relationship (e.g. Worked Together)"
          className="input-brutal px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Duration in months (optional)"
          className="input-brutal px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={isPending || relationship.trim() === ""}
          onClick={() => void submit()}
          className="btn-brutal px-4 py-2 text-xs sm:col-span-2"
        >
          {isPending ? "Signing…" : "Sign & attest"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {done && (
        <p className="mt-3 text-xs text-accent-ink">
          Attestation recorded — it now appears in the list below.
        </p>
      )}
    </div>
  );
}
