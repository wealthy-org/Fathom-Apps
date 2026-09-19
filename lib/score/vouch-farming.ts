import { THRESHOLDS } from "@/config/thresholds";
import type { Address } from "@/lib/score/types";

export interface VouchSummary { from: Address; to: Address; status: string }
export interface VouchFarmingAssessment { discountFactor: number; reciprocalPairs: number; topVoucherShare: number }

/** Isolated anti-farming check; it consumes edges only and never builds a graph. */
export function assessVouchFarming(vouches: VouchSummary[]): VouchFarmingAssessment {
  const active = vouches.filter((v) => v.status === "active");
  if (active.length < THRESHOLDS.score.vouchFarming.minActiveVouches) return { discountFactor: 1, reciprocalPairs: 0, topVoucherShare: 0 };
  const edges = new Set(active.map((v) => `${v.from}:${v.to}`));
  const reciprocalPairs = active.filter((v) => edges.has(`${v.to}:${v.from}`)).length / 2;
  const counts = new Map<string, number>();
  for (const v of active) counts.set(v.from, (counts.get(v.from) ?? 0) + 1);
  const topVoucherShare = Math.max(...counts.values()) / active.length;
  const reciprocal = reciprocalPairs >= THRESHOLDS.score.vouchFarming.reciprocalPairs;
  const concentrated = topVoucherShare >= THRESHOLDS.score.vouchFarming.topVoucherShare;
  return { discountFactor: reciprocal && concentrated ? THRESHOLDS.score.vouchFarming.bothDiscount : reciprocal || concentrated ? THRESHOLDS.score.vouchFarming.singleDiscount : 1, reciprocalPairs, topVoucherShare };
}
