import type { Evaluation } from "@/lib/score/risk";

/**
 * Active disputes detector (Spec 09, Fase 9). Pure, tanpa I/O — sama seperti
 * detector lain. PROVISIONAL, config-driven hanya sejauh status lifecycle:
 * tidak ada threshold hitung — satu dispute aktif cukup untuk detected.
 *
 * Hanya status yang benar-benar aktif (open, disputed) yang dihitung.
 * upheld/dismissed = resolved, bukan aktif. detected ≠ malicious:
 * dispute adalah klaim, bukan vonis.
 */

export interface ActiveDisputePoint {
  reporter: string;
  status: string;
  registryId: string | null;
  txHash: string | null;
}

const ACTIVE_STATUSES = new Set(["open", "disputed"]);

export function evaluateActiveDisputes(
  disputes: ActiveDisputePoint[] | undefined,
): Evaluation {
  if (disputes === undefined) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Dispute records are not available for this wallet.",
      suppliedBy: "indexed disputes (off-chain reports + registry lifecycle)",
    };
  }

  const active = disputes.filter((d) => ACTIVE_STATUSES.has(d.status));
  const evidence = {
    activeDisputes: active.length,
    totalDisputes: disputes.length,
    disputes: active.map((d) => ({
      reporter: d.reporter,
      status: d.status,
      ...(d.registryId !== null ? { registryId: d.registryId } : {}),
      ...(d.txHash !== null ? { txHash: d.txHash } : {}),
    })),
  };

  if (active.length > 0) {
    return { status: "detected", evidence, reason: null, suppliedBy: null };
  }
  return { status: "clear", evidence, reason: null, suppliedBy: null };
}
