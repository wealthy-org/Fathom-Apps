import { THRESHOLDS } from "@/config/thresholds";
import { assessVouchFarming } from "@/lib/score/vouch-farming";
import type { DimensionEvidenceReferences, DimensionResult, ScoreInput, ScoreResult } from "@/lib/score/types";

export interface ScoreStrategy { readonly version: string; compute(input: ScoreInput): Omit<ScoreResult, "completeness" | "tier"> }
const emptyEvidence = (): DimensionEvidenceReferences => ({ proofs: [], direct: [] });
const sourceUsable = (state: string) => state === "available" || state === "empty";
const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
const linear = (value: number, fullAt: number, points: number) => clamp(Math.floor((value / fullAt) * points), points);
function logPoints(value: string | null, fullAt: string, points: number): number { try { const wei = value === null ? null : BigInt(value); const cap = BigInt(fullAt); if (wei === null || wei <= BigInt(0)) return 0; if (wei >= cap) return points; return Math.floor(((wei.toString().length - 1) / (cap.toString().length - 1)) * points); } catch { return 0; } }
function proof(type: string, evidenceReference: string, evidenceReferences?: string[]) { return { type, evidenceReference, ...(evidenceReferences ? { evidenceReferences } : {}) }; }

export class ScoreStrategyV1 implements ScoreStrategy {
  readonly version = THRESHOLDS.score.formulaVersion;
  compute(input: ScoreInput): Omit<ScoreResult, "completeness" | "tier"> {
    const dimensions = [this.economic(input), this.counterparty(input), this.contracts(input), this.community(input)];
    const riskAdjustment = this.risk(input);
    const totalScore = clamp(dimensions.reduce((sum, dimension) => sum + dimension.contribution, 0) + riskAdjustment.contribution, THRESHOLDS.score.maxScore);
    return { address: input.address, totalScore, formulaVersion: this.version, availability: input.availability, breakdown: { dimensions, riskAdjustment }, computedAt: input.evaluatedAt };
  }
  private economic(input: ScoreInput): DimensionResult {
    const cfg = THRESHOLDS.score.dimensions.economicHistory; const available = sourceUsable(input.availability.economicHistory.state);
    if (!available) return { id: "economic_history", contribution: 0, available: false, evidenceReferences: emptyEvidence(), explanation: "Economic history is not fully available." };
    const age = input.onchain.firstTxAt ? Math.max(0, Math.floor((Date.parse(input.evaluatedAt) - Date.parse(input.onchain.firstTxAt)) / 86_400_000)) : 0;
    const contribution = clamp(linear(age, cfg.walletAgeFullAtDays, cfg.walletAgeMaxPoints) + linear(input.onchain.txCount ?? 0, cfg.txCountFullAt, cfg.txCountMaxPoints) + logPoints(input.onchain.volumeWei, cfg.volumeFullAtWei, cfg.volumeMaxPoints), cfg.maxPoints);
    return { id: "economic_history", contribution, available: true, evidenceReferences: { proofs: input.onchain.proofs, direct: [] }, explanation: "Wallet age, direct transactions, and indexed native volume." };
  }
  private counterparty(input: ScoreInput): DimensionResult {
    const cfg = THRESHOLDS.score.dimensions.counterpartyHistory; const available = sourceUsable(input.availability.counterpartyHistory.state);
    if (!available) return { id: "counterparty_history", contribution: 0, available: false, evidenceReferences: emptyEvidence(), explanation: "Counterparty history is incomplete or unavailable." };
    const contribution = clamp(linear(input.counterparty.uniqueCount ?? 0, cfg.uniqueFullAt, cfg.uniqueMaxPoints) + linear(input.counterparty.repeatCount ?? 0, cfg.repeatFullAt, cfg.repeatMaxPoints) + linear(input.counterparty.longestRelationshipDays ?? 0, cfg.longevityFullAtDays, cfg.longevityMaxPoints), cfg.maxPoints);
    return { id: "counterparty_history", contribution, available: true, evidenceReferences: { proofs: input.counterparty.proofs, direct: [] }, explanation: "Unique, repeat, and longest direct counterparty relationships." };
  }
  private contracts(input: ScoreInput): DimensionResult {
    const cfg = THRESHOLDS.score.dimensions.contractHistory; const available = sourceUsable(input.availability.contractHistory.state);
    if (!available) return { id: "contract_history", contribution: 0, available: false, evidenceReferences: emptyEvidence(), explanation: "Verified contract history is unavailable; protocol identity was not inferred." };
    const proofs = input.contracts.slice(0, cfg.maxCountedProtocols).map((item) => proof("contract_history", item.evidenceReference));
    return { id: "contract_history", contribution: proofs.length * cfg.maxPointsPerProtocol, available: true, evidenceReferences: { proofs, direct: [] }, explanation: "Verified contract-history evidence only; this is not protocol history." };
  }
  private community(input: ScoreInput): DimensionResult {
    const cfg = THRESHOLDS.score.dimensions.communityTrust; const vouchesAvailable = sourceUsable(input.availability.vouches.state); const attestationsAvailable = sourceUsable(input.availability.attestations.state);
    if (!vouchesAvailable && !attestationsAvailable) return { id: "community_trust", contribution: 0, available: false, evidenceReferences: emptyEvidence(), explanation: "Community sources are unavailable or not indexed." };
    let vouchPoints = 0; const direct: DimensionEvidenceReferences["direct"] = [];
    if (vouchesAvailable) for (const vouch of input.community.vouches) { if (vouch.to !== input.address || vouch.status !== "active") continue; try { const stake = BigInt(vouch.stakeAmountWei); const cap = BigInt(cfg.vouchCapWei); const base = Number((stake > cap ? cap : stake) * BigInt(cfg.vouchMaxPoints) / cap); const days = Math.max(0, Math.floor((Date.parse(input.evaluatedAt) - Date.parse(vouch.createdAt)) / 86_400_000)); vouchPoints += Math.floor(base * Math.max(0, 1 - days / cfg.vouchDecayDays)); direct.push({ kind: "vouch", reference: vouch.evidenceReference, label: "On-chain vouch" }); } catch {} }
    const farming = assessVouchFarming(input.community.vouches); vouchPoints = Math.floor(Math.min(cfg.vouchMaxPoints, vouchPoints) * farming.discountFactor);
    const proofs = attestationsAvailable ? input.community.attestations.slice(0, cfg.attestationMaxCounted).map((item) => proof("role_attestation", item.evidenceReference)) : [];
    const attestations = proofs.length * Math.floor(cfg.attestationMaxPoints / cfg.attestationMaxCounted);
    return { id: "community_trust", contribution: clamp(vouchPoints + attestations, cfg.maxPoints), available: true, evidenceReferences: { proofs, direct }, explanation: "Stake-weighted, decayed vouches with anti-farming discount and capped attestations." };
  }
  private risk(input: ScoreInput): DimensionResult {
    const cfg = THRESHOLDS.score.dimensions.riskSignals; if (!sourceUsable(input.availability.riskSignals.state)) return { id: "risk_signals", contribution: 0, available: false, evidenceReferences: emptyEvidence(), explanation: "Risk is not evaluable; no penalty was applied." };
    const penalties = { low: cfg.low, medium: cfg.medium, high: cfg.high }; const deduction = Math.min(cfg.maxPenalty, input.risk.detected.reduce((sum, signal) => sum + penalties[signal.severity], 0));
    return { id: "risk_signals", contribution: deduction === 0 ? 0 : -deduction, available: true, evidenceReferences: { proofs: [], direct: input.risk.detected.map((signal) => ({ kind: "risk_signal", reference: signal.evidenceReference, label: signal.id })) }, explanation: deduction === 0 ? "Evaluable risk checks found no detected signal; no bonus is given." : "Detected risk signals reduce this provisional score." };
  }
}
