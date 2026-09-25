import { count, eq, gte, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  attestations,
  disputes,
  profileClaims,
  vouches,
} from "@/lib/db/schema";

/**
 * Network pulse metrics for the home ticker (Spec: pulse strip).
 * All values read live from indexed tables — no mocks, no fallbacks.
 * Empty tables degrade to 0 / null (rendered as "—"), never invented.
 */

export interface NetworkPulse {
  eventsToday: number;
  openDisputes: number;
  /** Total active vouch stake, wei as decimal string (numeric(78,0)). */
  vouchStakeWei: string;
  claimedWallets: number;
  /** Mean of latest score snapshot per wallet, null when no snapshot exists. */
  avgScore: number | null;
}

/** Start of current UTC day — day boundary for "events today". */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function getNetworkPulse(): Promise<NetworkPulse> {
  const today = startOfTodayUtc();

  const [
    attestationRows,
    vouchRows,
    disputeRows,
    claimRows,
    openDisputeRows,
    stakeRows,
    claimedRows,
    avgRows,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(attestations)
      .where(gte(attestations.createdAt, today)),
    db
      .select({ value: count() })
      .from(vouches)
      .where(gte(vouches.createdAt, today)),
    db
      .select({ value: count() })
      .from(disputes)
      .where(gte(disputes.openedAt, today)),
    db
      .select({ value: count() })
      .from(profileClaims)
      .where(gte(profileClaims.claimedAt, today)),
    db
      .select({ value: count() })
      .from(disputes)
      .where(eq(disputes.status, "open")),
    db
      .select({ value: sum(vouches.stakeAmount) })
      .from(vouches)
      .where(eq(vouches.status, "active")),
    db.select({ value: count() }).from(profileClaims),
    // Mean over latest snapshot per wallet — snapshots are history/cache,
    // latest row per address is the current reading. Single SQL pass,
    // no row cap, no sampling.
    db.execute<{ avg: string | null }>(
      sql`SELECT AVG(latest.total_score)::text AS avg FROM (SELECT DISTINCT ON (address) total_score FROM score_snapshots ORDER BY address, created_at DESC) AS latest`,
    ),
  ]);

  const avgRaw = avgRows[0]?.avg ?? null;
  const avgParsed = avgRaw === null ? NaN : Number(avgRaw);

  return {
    eventsToday:
      (attestationRows[0]?.value ?? 0) +
      (vouchRows[0]?.value ?? 0) +
      (disputeRows[0]?.value ?? 0) +
      (claimRows[0]?.value ?? 0),
    openDisputes: openDisputeRows[0]?.value ?? 0,
    vouchStakeWei: stakeRows[0]?.value ?? "0",
    claimedWallets: claimedRows[0]?.value ?? 0,
    avgScore: Number.isFinite(avgParsed) ? Math.round(avgParsed) : null,
  };
}
