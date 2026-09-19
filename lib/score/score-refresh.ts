import { computeScore } from "@/lib/score/score-engine";
import { writeScoreSnapshot } from "@/lib/score/score-snapshot";
import { ScoreStrategyV1 } from "@/lib/score/score-strategy";
import { tierStrategyV1 } from "@/lib/score/tier-strategy";
import type { ScoreInput, ScoreTriggerEvent } from "@/lib/score/types";

/** Explicit server-side persistence boundary. Profile reads must never call this. */
export async function refreshScoreSnapshot(input: ScoreInput, trigger: ScoreTriggerEvent) {
  const result = computeScore(input, new ScoreStrategyV1(), tierStrategyV1);
  return { result, written: await writeScoreSnapshot(result, trigger) };
}
