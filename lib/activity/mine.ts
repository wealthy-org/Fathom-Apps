import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import { THRESHOLDS } from "@/config/thresholds";
import { db } from "@/lib/db/client";
import {
  attestations,
  disputes,
  profileClaims,
  vouches,
} from "@/lib/db/schema";
import type { FeedItem, FeedPage } from "@/lib/activity/feed";

/**
 * "My Activity" source (Spec 04 section 3.4): everything one wallet did —
 * attestations made, vouches given, disputes opened, own claim.
 * Same FeedItem shape, same cards. Read-only, display only.
 */

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function getMyActivity(input: {
  address: string;
  limit: number;
  cursor?: string;
}): Promise<FeedPage> {
  const { address, limit } = input;
  const before = input.cursor ? new Date(input.cursor) : null;

  const [attestationRows, disputeRows, vouchRows, claimRows] =
    await Promise.all([
      db
        .select({
          id: attestations.id,
          attester: attestations.attesterAddress,
          subject: attestations.subjectAddress,
          role: attestations.role,
          relationship: attestations.relationship,
          durationMonths: attestations.durationMonths,
          registryId: attestations.registryId,
          txHash: attestations.txHash,
          createdAt: attestations.createdAt,
        })
        .from(attestations)
        .where(
          and(
            eq(attestations.attesterAddress, address),
            before ? lt(attestations.createdAt, before) : undefined,
          ),
        )
        .orderBy(desc(attestations.createdAt))
        .limit(limit),
      db
        .select({
          id: disputes.id,
          reporter: disputes.reporterAddress,
          target: disputes.targetAddress,
          status: disputes.status,
          reason: disputes.reason,
          registryId: disputes.registryId,
          txHash: disputes.txHash,
          openedAt: disputes.openedAt,
        })
        .from(disputes)
        .where(
          and(
            eq(disputes.reporterAddress, address),
            before ? lt(disputes.openedAt, before) : undefined,
          ),
        )
        .orderBy(desc(disputes.openedAt))
        .limit(limit),
      db
        .select({
          id: vouches.id,
          from: vouches.fromAddress,
          to: vouches.toAddress,
          stakeWei: vouches.stakeAmount,
          status: vouches.status,
          txHash: vouches.txHash,
          createdAt: vouches.createdAt,
        })
        .from(vouches)
        .where(
          and(
            eq(vouches.fromAddress, address),
            before ? lt(vouches.createdAt, before) : undefined,
          ),
        )
        .orderBy(desc(vouches.createdAt))
        .limit(limit),
      db
        .select({
          address: profileClaims.address,
          claimedAt: profileClaims.claimedAt,
        })
        .from(profileClaims)
        .where(
          and(
            eq(profileClaims.address, address),
            before ? lt(profileClaims.claimedAt, before) : undefined,
          ),
        )
        .orderBy(desc(profileClaims.claimedAt))
        .limit(limit),
    ]);

  const items: FeedItem[] = [
    ...attestationRows.map(
      (row): FeedItem => ({
        kind: "attestation",
        id: row.id,
        occurredAt: toIso(row.createdAt),
        attester: row.attester,
        subject: row.subject,
        role: row.role,
        relationship: row.relationship,
        durationMonths: row.durationMonths,
        onchain: row.registryId !== null,
        txHash: row.txHash,
      }),
    ),
    ...disputeRows.map(
      (row): FeedItem => ({
        kind: "dispute",
        id: row.id,
        occurredAt: toIso(row.openedAt),
        reporter: row.reporter,
        target: row.target,
        status: row.status,
        reason: row.reason,
        onchain: row.registryId !== null,
        txHash: row.txHash,
      }),
    ),
    ...vouchRows.map(
      (row): FeedItem => ({
        kind: "vouch",
        id: row.id,
        occurredAt: toIso(row.createdAt),
        from: row.from,
        to: row.to,
        stakeWei: row.stakeWei,
        status: row.status,
        txHash: row.txHash,
      }),
    ),
    ...claimRows.map(
      (row): FeedItem => ({
        kind: "claim",
        id: row.address,
        occurredAt: toIso(row.claimedAt),
        address: row.address,
      }),
    ),
  ];

  items.sort((a, b) =>
    a.occurredAt === b.occurredAt
      ? a.kind.localeCompare(b.kind)
      : b.occurredAt.localeCompare(a.occurredAt),
  );

  const page = items.slice(0, limit);
  return {
    items: page,
    nextCursor: page.length === limit ? page[page.length - 1].occurredAt : null,
  };
}

/** Stat strip halaman My Activity — count(*) nyata, display only. */
export interface MyActivityStats {
  attestations: number;
  vouches: number;
  disputes: number;
  total: number;
  claimed: boolean;
}

export async function getMyActivityStats(
  address: string,
): Promise<MyActivityStats> {
  const [attestationRows, vouchRows, disputeRows, claimRows] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(attestations)
        .where(eq(attestations.attesterAddress, address)),
      db
        .select({ value: count() })
        .from(vouches)
        .where(eq(vouches.fromAddress, address)),
      db
        .select({ value: count() })
        .from(disputes)
        .where(eq(disputes.reporterAddress, address)),
      db
        .select({ address: profileClaims.address })
        .from(profileClaims)
        .where(eq(profileClaims.address, address))
        .limit(1),
    ]);

  const attestationCount = attestationRows[0]?.value ?? 0;
  const vouchCount = vouchRows[0]?.value ?? 0;
  const disputeCount = disputeRows[0]?.value ?? 0;

  return {
    attestations: attestationCount,
    vouches: vouchCount,
    disputes: disputeCount,
    total: attestationCount + vouchCount + disputeCount,
    claimed: claimRows.length > 0,
  };
}

/**
 * Insight panel My Activity: sparkline harian + breakdown + counterparty
 * paling sering diinteraksikan dalam window THRESHOLDS.activity.
 * Display only — agregasi dari baris nyata, tanpa sampling.
 */
export interface MyActivityInsight {
  windowDays: number;
  /** Jumlah event per hari, oldest → newest, panjang = windowDays. */
  daily: number[];
  breakdown: { attestation: number; vouch: number; dispute: number };
  total: number;
  topCounterparties: Array<{ address: string; count: number }>;
}

const TOP_COUNTERPARTY_LIMIT = 3;

export async function getMyActivityInsight(
  address: string,
): Promise<MyActivityInsight> {
  const windowDays = THRESHOLDS.activity.myActivityInsightDays;
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [attestationRows, vouchRows, disputeRows] = await Promise.all([
    db
      .select({
        party: attestations.subjectAddress,
        at: attestations.createdAt,
      })
      .from(attestations)
      .where(
        and(
          eq(attestations.attesterAddress, address),
          gte(attestations.createdAt, cutoff),
        ),
      ),
    db
      .select({ party: vouches.toAddress, at: vouches.createdAt })
      .from(vouches)
      .where(
        and(
          eq(vouches.fromAddress, address),
          gte(vouches.createdAt, cutoff),
        ),
      ),
    db
      .select({ party: disputes.targetAddress, at: disputes.openedAt })
      .from(disputes)
      .where(
        and(
          eq(disputes.reporterAddress, address),
          gte(disputes.openedAt, cutoff),
        ),
      ),
  ]);

  const dailyMap = new Map<string, number>();
  const now = new Date();
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - offset);
    dailyMap.set(day.toISOString().slice(0, 10), 0);
  }

  const counterpartyCounts = new Map<string, number>();
  const breakdown = { attestation: 0, vouch: 0, dispute: 0 };

  const tally = (at: Date | string, party: string, kind: keyof typeof breakdown) => {
    const key = toIso(at).slice(0, 10);
    if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
    breakdown[kind] += 1;
    if (party !== address) {
      counterpartyCounts.set(party, (counterpartyCounts.get(party) ?? 0) + 1);
    }
  };

  for (const row of attestationRows) tally(row.at, row.party, "attestation");
  for (const row of vouchRows) tally(row.at, row.party, "vouch");
  for (const row of disputeRows) tally(row.at, row.party, "dispute");

  const topCounterparties = [...counterpartyCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_COUNTERPARTY_LIMIT)
    .map(([partyAddress, partyCount]) => ({
      address: partyAddress,
      count: partyCount,
    }));

  return {
    windowDays,
    daily: [...dailyMap.values()],
    breakdown,
    total: breakdown.attestation + breakdown.vouch + breakdown.dispute,
    topCounterparties,
  };
}
