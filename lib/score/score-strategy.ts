import { THRESHOLDS } from "@/config/thresholds";
import { assessVouchFarming } from "@/lib/score/vouch-farming";
import type { DimensionResult, ScoreInput, ScoreResult } from "@/lib/score/types";

export interface ScoreStrategy { readonly version: string; compute(input: ScoreInput): Omit<ScoreResult, "tier"> }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function linear(value: number, fullAt: number, maxPoints: number): number { return clamp(Math.floor((value / fullAt) * maxPoints), 0, maxPoints); }
function parseWei(value: string | null): bigint | null { try { return value === null ? null : BigInt(value); } catch { return null; } }
function refs(input: ScoreInput, id: DimensionResult["id"]): string[] { return input.proofReferences[id] ?? []; }
/** Integer log10 scaling without converting token values to floating point. */
function logScaledWeiPoints(value: bigint, fullAt: bigint, maxPoints: number): number {
  if (value <= BigInt(0)) return 0;
  if (value >= fullAt) return maxPoints;
  const valueLog = value.toString().length - 1;
  const fullLog = fullAt.toString().length - 1;
  return fullLog === 0 ? maxPoints : Math.floor((valueLog / fullLog) * maxPoints);
}

export class ScoreStrategyV1 implements ScoreStrategy {
  readonly version = THRESHOLDS.score.formulaVersion;
  compute(input: ScoreInput): Omit<ScoreResult, "tier"> {
    const dimensions = [this.economic(input), this.counterparty(input), this.contract(input), this.community(input)];
    const riskAdjustment = this.risk(input);
    const totalScore = clamp(dimensions.reduce((total, dimension) => total + dimension.contribution, 0) + riskAdjustment.contribution, 0, THRESHOLDS.score.maxScore);
    return { address: input.address, totalScore, formulaVersion: this.version, breakdown: { dimensions, riskAdjustment }, computedAt: input.evaluatedAt };
  }
  private economic(input: ScoreInput): DimensionResult {
    const cfg = THRESHOLDS.score.dimensions.economicHistory;
    const age = input.onchain.firstTxAt ? Math.max(0, Math.floor((Date.parse(input.evaluatedAt) - Date.parse(input.onchain.firstTxAt)) / 86_400_000)) : null;
    const agePoints = age === null ? 0 : linear(age, cfg.walletAgeFullAtDays, cfg.walletAgeMaxPoints);
    const txPoints = input.onchain.txCount === null ? 0 : linear(input.onchain.txCount, cfg.txCountFullAt, cfg.txCountMaxPoints);
    const volume = parseWei(input.onchain.volumeWei); const full = BigInt(cfg.volumeFullAtWei);
    const volumePoints = volume === null ? 0 : logScaledWeiPoints(volume, full, cfg.volumeMaxPoints);
    const available = age !== null || input.onchain.txCount !== null || volume !== null;
    return { id: "economic_history", contribution: clamp(agePoints + txPoints + volumePoints, 0, cfg.maxPoints), available, proofReferences: refs(input, "economic_history"), explanation: available ? "Wallet age, direct transactions, and indexed native volume." : "Indexed economic history is unavailable." };
  }
  private counterparty(input: ScoreInput): DimensionResult {
    const cfg = THRESHOLDS.score.dimensions.counterpartyHistory;
    if (!input.counterparty.available) return { id: "counterparty_history", contribution: 0, available: false, proofReferences: [], explanation: "Complete counterparty history is unavailable." };
    const unique = input.counterparty.uniqueCount === null ? 0 : linear(input.counterparty.uniqueCount, cfg.uniqueFullAt, cfg.uniqueMaxPoints);
    const repeat = input.counterparty.repeatCount === null ? 0 : linear(input.counterparty.repeatCount, cfg.repeatFullAt, cfg.repeatMaxPoints);
    const longevity = input.counterparty.longestRelationshipDays === null ? 0 : linear(input.counterparty.longestRelationshipDays, cfg.longevityFullAtDays, cfg.longevityMaxPoints);
    return { id: "counterparty_history", contribution: clamp(unique + repeat + longevity, 0, cfg.maxPoints), available: true, proofReferences: refs(input, "counterparty_history"), explanation: "Unique, repeat, and longest direct counterparty relationships." };
  }
  private contract(input: ScoreInput): DimensionResult {
    const cfg = THRESHOLDS.score.dimensions.contractHistory; const counted = Math.min(input.verifiedProtocolProofs.length, cfg.maxCountedProtocols);
    return { id: "contract_history", contribution: counted * cfg.maxPointsPerProtocol, available: input.verifiedProtocolProofs.length > 0, proofReferences: input.verifiedProtocolProofs, explanation: input.verifiedProtocolProofs.length > 0 ? "Verified protocol proofs only." : "No verified protocol proof is available." };
  }
  private community(input: ScoreInput): DimensionResult {
    const cfg = THRESHOLDS.score.dimensions.communityTrust; const now = Date.parse(input.evaluatedAt); let vouchPoints = 0;
    for (const vouch of input.community.vouches) {
      if (vouch.to !== input.address || vouch.status !== "active") continue;
      const stake = parseWei(vouch.stakeAmountWei); if (stake === null) continue;
      const capped = stake > BigInt(cfg.vouchCapWei) ? BigInt(cfg.vouchCapWei) : stake;
      const ageDays = Math.max(0, Math.floor((now - Date.parse(vouch.createdAt)) / 86_400_000));
      const stakePoints = Number((capped * BigInt(cfg.vouchMaxPoints)) / BigInt(cfg.vouchCapWei));
      vouchPoints += Math.floor(stakePoints * Math.max(0, 1 - ageDays / cfg.vouchDecayDays));
    }
    const farming = assessVouchFarming(input.community.vouches); vouchPoints = Math.floor(Math.min(cfg.vouchMaxPoints, vouchPoints) * farming.discountFactor);
    const attestationPoints = Math.min(input.community.attestations.length, cfg.attestationMaxCounted) * Math.floor(cfg.attestationMaxPoints / cfg.attestationMaxCounted);
    const available = input.community.vouches.length > 0 || input.community.attestations.length > 0;
    return { id: "community_trust", contribution: clamp(vouchPoints + attestationPoints, 0, cfg.maxPoints), available, proofReferences: refs(input, "community_trust"), explanation: `Stake-weighted, decayed vouches (anti-farming discount ${farming.discountFactor}) and capped attestations.` };
  }
  private risk(input: ScoreInput): DimensionResult {
    const cfg = THRESHOLDS.score.dimensions.riskSignals;
    if (!input.risk.evaluable) return { id: "risk_signals", contribution: 0, available: false, proofReferences: [], explanation: "Risk signals are not evaluable; no penalty was applied." };
    const penalties = { low: cfg.low, medium: cfg.medium, high: cfg.high };
    const deduction = Math.min(cfg.maxPenalty, input.risk.detected.reduce((total, signal) => total + penalties[signal.severity], 0));
    return { id: "risk_signals", contribution: -deduction, available: true, proofReferences: input.risk.detected.map((signal) => signal.evidenceReference), explanation: deduction === 0 ? "Evaluable risk checks found no detected signal; no bonus is given." : "Detected risk signals reduce this provisional score." };
  }
}
