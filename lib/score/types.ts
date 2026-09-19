export type Address = `0x${string}`;
export type VouchStatus = "active" | "disputed" | "slashed" | "withdrawn";
export type ScoreDimensionId = "economic_history" | "counterparty_history" | "contract_history" | "community_trust" | "risk_signals";
export type SourceState = "available" | "empty" | "unavailable" | "not_indexed" | "incomplete";
export type ScoreCompleteness = "complete" | "partial" | "unavailable";
export type ScoreTriggerEvent = "onchain_refresh" | "manual_recalc";

export interface SourceAvailability { state: SourceState; reason?: string }
export interface ScoreAvailability {
  onchain: SourceAvailability; economicHistory: SourceAvailability; counterpartyHistory: SourceAvailability;
  contractHistory: SourceAvailability; attestations: SourceAvailability; vouches: SourceAvailability;
  riskSignals: SourceAvailability;
}
export type ProofReference = { type: string; evidenceReference: string; evidenceReferences?: string[] };
export interface DimensionEvidenceReferences {
  proofs: ProofReference[];
  direct: Array<{ kind: "vouch" | "risk_signal"; reference: string; label: string }>;
}
export interface ScoreInput {
  address: Address; evaluatedAt: string; availability: ScoreAvailability;
  onchain: { firstTxAt: string | null; txCount: number | null; volumeWei: string | null; proofs: ProofReference[] };
  counterparty: { uniqueCount: number | null; repeatCount: number | null; longestRelationshipDays: number | null; proofs: ProofReference[] };
  contracts: ProofReference[];
  community: { vouches: Array<{ from: Address; to: Address; stakeAmountWei: string; status: string; createdAt: string; evidenceReference: string }>; attestations: ProofReference[] };
  risk: { detected: Array<{ id: string; severity: "low" | "medium" | "high"; evidenceReference: string }> };
}
export interface DimensionResult { id: ScoreDimensionId; contribution: number; available: boolean; evidenceReferences: DimensionEvidenceReferences; explanation: string }
export interface ScoreBreakdown { dimensions: DimensionResult[]; riskAdjustment: DimensionResult }
export interface TierResult { id: string; label: string; minScore: number; maxScore: number }
export interface ScoreResult { address: Address; totalScore: number; completeness: ScoreCompleteness; tier: TierResult | null; formulaVersion: string; availability: ScoreAvailability; breakdown: ScoreBreakdown; computedAt: string }

/** Payload yang dipersist ke score_snapshots.breakdown — breakdown + state material. */
export interface ScoreSnapshotBreakdown extends ScoreBreakdown {
  completeness: ScoreCompleteness;
  tier: TierResult | null;
  availability: ScoreAvailability;
}
