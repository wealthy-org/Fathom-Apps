import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { scoreSnapshots } from "@/lib/db/schema";
import type { ScoreResult, ScoreTriggerEvent } from "@/lib/score/types";

/** Canonical material state only: timestamps and trigger metadata are excluded. */
export function scoreSnapshotFingerprint(result: ScoreResult): string {
  const material = { formulaVersion: result.formulaVersion, completeness: result.completeness, tier: result.tier, totalScore: result.totalScore, availability: result.availability, breakdown: result.breakdown };
  return createHash("sha256").update(JSON.stringify(material)).digest("hex");
}
export async function writeScoreSnapshot(result: ScoreResult, triggerEvent: ScoreTriggerEvent): Promise<boolean> {
  const fingerprint = scoreSnapshotFingerprint(result);
  const [existing] = await db.select({ id: scoreSnapshots.id }).from(scoreSnapshots).where(and(eq(scoreSnapshots.address, result.address), eq(scoreSnapshots.fingerprint, fingerprint))).limit(1);
  if (existing) return false;
  await db.insert(scoreSnapshots).values({ address: result.address, formulaVersion: result.formulaVersion, fingerprint, totalScore: result.totalScore, breakdown: { ...result.breakdown, completeness: result.completeness, tier: result.tier, availability: result.availability }, triggerEvent, createdAt: new Date(result.computedAt) });
  return true;
}
