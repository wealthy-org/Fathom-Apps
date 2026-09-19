import { THRESHOLDS } from "@/config/thresholds";
import type { ScoreAvailability, ScoreInput, ScoreResult, SourceState } from "@/lib/score/types";
import type { ScoreStrategy } from "@/lib/score/score-strategy";
import type { TierStrategy } from "@/lib/score/tier-strategy";

const REQUIRED_SOURCES = THRESHOLDS.tier.eligibility
  .requiredSources as ReadonlyArray<keyof ScoreAvailability>;

export function sourceUsable(state: SourceState): boolean { return state === "available" || state === "empty"; }

/**
 * PROVISIONAL — completeness dinilai relatif terhadap sumber wajib yang
 * dikonfigurasi (THRESHOLDS.score.tier.eligibility.requiredSources), bukan
 * terhadap semua sumber. Sumber opsional yang belum di-index membuat skor
 * partial, bukan unavailable, dan tier hanya diberikan saat complete.
 */
function completeness(input: ScoreInput): ScoreResult["completeness"] {
  const states = Object.values(input.availability).map((source) => source.state);
  if (states.every((state) => state === "unavailable" || state === "not_indexed")) return "unavailable";
  return REQUIRED_SOURCES.every((key) => sourceUsable(input.availability[key].state)) ? "complete" : "partial";
}

/** Pure score + tier orchestration. Persistence belongs to score-refresh.ts. */
export function computeScore(input: ScoreInput, strategy: ScoreStrategy, tiers: TierStrategy): ScoreResult {
  const computed = strategy.compute(input);
  const scoreCompleteness = completeness(input);
  return { ...computed, completeness: scoreCompleteness, tier: scoreCompleteness === "complete" ? tiers.getTier(computed.totalScore) : null };
}
