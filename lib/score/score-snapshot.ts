import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { scoreSnapshots } from "@/lib/db/schema";
import type { ScoreResult, ScoreTriggerEvent } from "@/lib/score/types";

/** Append-only score history. An identical computation/event is stored once. */
export async function writeScoreSnapshot(result: ScoreResult, triggerEvent: ScoreTriggerEvent): Promise<boolean> {
  const [existing] = await db
    .select({ id: scoreSnapshots.id })
    .from(scoreSnapshots)
    .where(and(eq(scoreSnapshots.address, result.address), eq(scoreSnapshots.formulaVersion, result.formulaVersion), eq(scoreSnapshots.totalScore, result.totalScore), eq(scoreSnapshots.triggerEvent, triggerEvent)))
    .limit(1);
  if (existing) return false;
  await db.insert(scoreSnapshots).values({ address: result.address, formulaVersion: result.formulaVersion, totalScore: result.totalScore, breakdown: result.breakdown, triggerEvent, createdAt: new Date(result.computedAt) });
  return true;
}
