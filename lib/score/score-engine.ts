import type { Proof } from "@/lib/score/proofs";
import type { ScoreInput, ScoreResult } from "@/lib/score/types";
import type { ScoreStrategy } from "@/lib/score/score-strategy";
import type { TierStrategy } from "@/lib/score/tier-strategy";

export interface ScoreDomain {
  address: ScoreInput["address"];
  evaluatedAt: Date;
  firstTxAt: Date | null;
  txCount: number | null;
  volumeWei: bigint | null;
  graph: { complete: boolean; uniqueCounterparties: number; repeatCounterparties: number; longestRelationshipDays: number | null };
  proofs: Proof[];
  vouches: Array<{ from: ScoreInput["address"]; to: ScoreInput["address"]; stakeAmount: bigint; status: string; createdAt: Date }>;
  risk: { evaluable: boolean; detected: Array<{ id: string; severity: "low" | "medium" | "high"; evidenceReference: string }> };
}

function references(proofs: Proof[], types: Proof["type"][]): string[] {
  return proofs.filter((proof) => types.includes(proof.type)).map((proof) => proof.evidence_reference);
}

/** Builds a JSON-safe scoring input from already-computed domain data; no I/O. */
export function buildScoreInput(domain: ScoreDomain): ScoreInput {
  return {
    address: domain.address,
    evaluatedAt: domain.evaluatedAt.toISOString(),
    onchain: { firstTxAt: domain.firstTxAt?.toISOString() ?? null, txCount: domain.txCount, volumeWei: domain.volumeWei?.toString() ?? null },
    counterparty: { available: domain.graph.complete, uniqueCount: domain.graph.complete ? domain.graph.uniqueCounterparties : null, repeatCount: domain.graph.complete ? domain.graph.repeatCounterparties : null, longestRelationshipDays: domain.graph.complete ? domain.graph.longestRelationshipDays : null },
    verifiedProtocolProofs: references(domain.proofs, ["protocol_history"]),
    community: { vouches: domain.vouches.map((vouch) => ({ from: vouch.from, to: vouch.to, stakeAmountWei: vouch.stakeAmount.toString(), status: vouch.status, createdAt: vouch.createdAt.toISOString() })), attestations: references(domain.proofs, ["role_attestation"]) },
    risk: domain.risk,
    proofReferences: {
      economic_history: references(domain.proofs, ["wallet_age", "transaction_history", "economic_history"]),
      counterparty_history: references(domain.proofs, ["unique_counterparty", "repeat_counterparty"]),
      contract_history: references(domain.proofs, ["protocol_history"]),
      community_trust: references(domain.proofs, ["role_attestation"]),
      risk_signals: domain.risk.detected.map((signal) => signal.evidenceReference),
    },
  };
}

export function computeScore(input: ScoreInput, strategy: ScoreStrategy, tierStrategy: TierStrategy): ScoreResult {
  const score = strategy.compute(input);
  return { ...score, tier: tierStrategy.getTier(score.totalScore) };
}
