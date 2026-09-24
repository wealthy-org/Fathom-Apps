import type { WalletProfile } from "@/lib/wallet/profile";

type RiskLevel = "low" | "medium" | "high" | null;

const SEVERITY_RANK = { low: 1, medium: 2, high: 3 } as const;

/**
 * Turunan dari `riskSignals` yang sudah ada (bukan kalkulasi kedua):
 * severity tertinggi yang terdeteksi. null = sumber risk belum usable
 * (not_indexed/unavailable) — bukan "low" palsu. Tanpa deteksi pada sumber
 * yang usable = "low", selaras contoh respons Brief §23.
 */
export function deriveRiskLevel(
  state: string,
  severities: Array<"low" | "medium" | "high">,
): RiskLevel {
  if (state !== "available" && state !== "empty") return null;
  let level: Exclude<RiskLevel, null> = "low";
  for (const severity of severities) {
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[level]) level = severity;
  }
  return level;
}

/**
 * Bentuk respons GET /api/reputation/{address} (Spec 11) — dipakai oleh
 * route handler DAN halaman docs (sample hero), supaya tidak ada dua
 * mapping yang bisa saling tertinggal.
 *
 * Membaca dari lapisan evidence/reputation yang sama dengan produk
 * (`getWalletProfile`) — tidak ada kalkulasi reputasi kedua (Spec 11 §Boundary).
 *
 * Hanya field yang benar-benar didukung yang diekspos. `vouches` null saat
 * index state unknown (no-index) — array kosong berarti confirmed-zero, bukan
 * "belum di-index". Risk dilaporkan sebagai `riskSignals` (evidence, bukan label)
 * plus turunan `riskLevel` (Brief §23) — null saat sumber risk belum usable.
 */
export function buildReputationPayload(profile: WalletProfile) {
  return {
    address: profile.address,
    walletAgeDays: profile.walletAgeDays,
    uniqueCounterparties: profile.trustGraph.complete
      ? profile.trustGraph.uniqueCounterparties
      : null,
    repeatCounterparties: profile.trustGraph.complete
      ? profile.trustGraph.repeatCounterparties
      : null,
    attestations: profile.attestations.length,
    activeDisputes: profile.disputes.filter((d) => d.status === "open").length,
    riskSignals: profile.riskSignals,
    riskLevel: deriveRiskLevel(
      profile.reputation.availability.riskSignals.state,
      profile.riskSignals.map((s) => s.severity),
    ),
    proofs: profile.proofs,
    claim: profile.claim,
    vouches: profile.vouchIndex === null ? null : profile.vouches,
    vouchesCount: profile.vouchIndex === null ? null : profile.vouches.length,
    dimensions: profile.dimensions,
    score: profile.reputation.totalScore,
    tier: profile.reputation.tier,
    formulaVersion: profile.reputation.formulaVersion,
    completeness: profile.reputation.completeness,
  };
}
