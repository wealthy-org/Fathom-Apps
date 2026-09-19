import { THRESHOLDS } from "@/config/thresholds";
import type { TierResult } from "@/lib/score/types";

export interface TierStrategy { readonly version: string; getTier(score: number): TierResult }
export class TierStrategyV1 implements TierStrategy {
  readonly version = THRESHOLDS.score.formulaVersion;
  getTier(score: number): TierResult {
    const boundaries = THRESHOLDS.tier.boundaries;
    const index = boundaries.findIndex((boundary) => score >= boundary.minScore);
    const current = boundaries[index === -1 ? boundaries.length - 1 : index]!;
    const next = index > 0 ? boundaries[index - 1] : undefined;
    return { id: current.id, label: current.label, minScore: current.minScore, maxScore: next ? next.minScore - 1 : THRESHOLDS.score.maxScore };
  }
}
export const tierStrategyV1 = new TierStrategyV1();
