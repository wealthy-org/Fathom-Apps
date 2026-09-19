/** Shared, JSON-serializable reputation-score types. */
export type Address = `0x${string}`;
export type VouchStatus = "active" | "disputed" | "slashed" | "withdrawn";

export type ScoreDimensionId =
  | "economic_history"
  | "counterparty_history"
  | "contract_history"
  | "community_trust"
  | "risk_signals";

export type ScoreTriggerEvent = "onchain_refresh" | "manual_recalc";

export interface ScoreInput {
  address: Address;
  evaluatedAt: string;
  onchain: { firstTxAt: string | null; txCount: number | null; volumeWei: string | null };
  counterparty: { available: boolean; uniqueCount: number | null; repeatCount: number | null; longestRelationshipDays: number | null };
  verifiedProtocolProofs: string[];
  community: { vouches: Array<{ from: Address; to: Address; stakeAmountWei: string; status: string; createdAt: string }>; attestations: string[] };
  risk: { evaluable: boolean; detected: Array<{ id: string; severity: "low" | "medium" | "high"; evidenceReference: string }> };
  proofReferences: Partial<Record<ScoreDimensionId, string[]>>;
}

export interface DimensionResult { id: ScoreDimensionId; contribution: number; available: boolean; proofReferences: string[]; explanation: string }
export interface ScoreBreakdown { dimensions: DimensionResult[]; riskAdjustment: DimensionResult }
export interface TierResult { id: string; label: string; minScore: number; maxScore: number }
export interface ScoreResult { address: Address; totalScore: number; tier: TierResult; formulaVersion: string; breakdown: ScoreBreakdown; computedAt: string }
