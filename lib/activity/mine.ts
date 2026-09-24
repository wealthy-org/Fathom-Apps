import { and, desc, eq, lt } from "drizzle-orm";
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
