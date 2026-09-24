import { computeScore } from "@/lib/score/score-engine";
import { writeScoreSnapshot } from "@/lib/score/score-snapshot";
import { ScoreStrategyV1 } from "@/lib/score/score-strategy";
import { tierStrategyV1 } from "@/lib/score/tier-strategy";
import type { ScoreInput, ScoreTriggerEvent } from "@/lib/score/types";
import { db } from "@/lib/db/client";
import { riskDetections, wallets } from "@/lib/db/schema";

/**
 * Simpan deteksi risk PERTAMA per (wallet, signal) sebagai breaking-news
 * feed (Spec 04 section 2.3). Display-order source only — TIDAK PERNAH
 * dibaca oleh score-strategy/score-engine; scoring tetap assessRisk
 * on-the-fly. Refresh berulang = onConflictDoNothing, tidak menimpa.
 */
async function persistRiskDetections(input: ScoreInput): Promise<void> {
  if (input.risk.detected.length === 0) return;
  // FK satisfaction: wallet yang belum punya baris tetap bisa dicatat.
  await db
    .insert(wallets)
    .values({ address: input.address })
    .onConflictDoNothing();
  await db
    .insert(riskDetections)
    .values(
      input.risk.detected.map((signal) => ({
        walletAddress: input.address,
        signalId: signal.id,
        severity: signal.severity,
        evidenceReference: signal.evidenceReference,
      })),
    )
    .onConflictDoNothing();
}

/** Explicit server-side persistence boundary. Profile reads must never call this. */
export async function refreshScoreSnapshot(input: ScoreInput, trigger: ScoreTriggerEvent) {
  const result = computeScore(input, new ScoreStrategyV1(), tierStrategyV1);
  const [written] = await Promise.all([
    writeScoreSnapshot(result, trigger),
    persistRiskDetections(input),
  ]);
  return { result, written };
}
