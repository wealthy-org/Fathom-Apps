import type { Proof } from "@/lib/score/proofs";
import type { Address, ProofReference, ScoreAvailability, ScoreInput } from "@/lib/score/types";

export interface ScoreDomain {
  address: Address; evaluatedAt: Date; availability: ScoreAvailability;
  firstTxAt: Date | null; txCount: number | null; volumeWei: bigint | null;
  graph: { uniqueCounterparties: number; repeatCounterparties: number; longestRelationshipDays: number | null };
  proofs: Proof[];
  vouches: Array<{ from: Address; to: Address; stakeAmount: bigint; status: string; createdAt: Date; evidenceReference: string }>;
  risk: ScoreInput["risk"];
}
function references(proofs: Proof[], types: Proof["type"][]): ProofReference[] {
  return proofs
    .filter((item) => types.includes(item.type))
    .map((item) => ({
      type: item.type,
      evidenceReference: item.evidence_reference,
      ...(item.evidence_references ? { evidenceReferences: item.evidence_references } : {}),
    }));
}
/** Pure conversion from fetched domain data; no database dependency. */
export function buildScoreInput(domain: ScoreDomain): ScoreInput {
  return {
    address: domain.address, evaluatedAt: domain.evaluatedAt.toISOString(), availability: domain.availability,
    onchain: {
      firstTxAt: domain.firstTxAt?.toISOString() ?? null,
      txCount: domain.txCount,
      volumeWei: domain.volumeWei?.toString() ?? null,
      proofs: references(domain.proofs, ["wallet_age", "transaction_history", "economic_history"]),
    },
    counterparty: {
      uniqueCount: domain.graph.uniqueCounterparties,
      repeatCount: domain.graph.repeatCounterparties,
      longestRelationshipDays: domain.graph.longestRelationshipDays,
      proofs: references(domain.proofs, ["unique_counterparty", "repeat_counterparty"]),
    },
    contracts: references(domain.proofs, ["contract_history"]),
    community: { vouches: domain.vouches.map((item) => ({ from: item.from, to: item.to, stakeAmountWei: item.stakeAmount.toString(), status: item.status, createdAt: item.createdAt.toISOString(), evidenceReference: item.evidenceReference })), attestations: references(domain.proofs, ["role_attestation"]) },
    risk: domain.risk,
  };
}
