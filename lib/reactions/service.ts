import { and, eq, sql } from "drizzle-orm";
import { ADDRESS_RE } from "@/lib/chain/address";
import { db } from "@/lib/db/client";
import {
  attestationReactions,
  disputeReactions,
  profileClaimReactions,
  vouchReactions,
} from "@/lib/db/schema";

/**
 * Service "Helpful / Not helpful" untuk kartu feed (semua kind).
 * DISPLAY-ONLY: tidak pernah dibaca file scoring manapun. Satu suara
 * per wallet per target, upsert (ubah suara). Voter selalu dari session
 * SIWE, bukan body.
 */

export const REACTION_KINDS = [
  "attestation",
  "dispute",
  "vouch",
  "claim",
] as const;

export type ReactionKind = (typeof REACTION_KINDS)[number];

export type ReactionValue = "helpful" | "not_helpful";

export interface ReactionCounts {
  helpful: number;
  notHelpful: number;
  myVote: ReactionValue | null;
}

export function isReactionKind(kind: string): kind is ReactionKind {
  return (REACTION_KINDS as readonly string[]).includes(kind);
}

/** Claim target = address; kind lain = bigint id positif. */
export function isValidTargetId(kind: ReactionKind, raw: string): boolean {
  if (kind === "claim") return ADDRESS_RE.test(raw);
  return /^\d{1,19}$/.test(raw);
}

export async function getReactionCounts(
  kind: ReactionKind,
  rawId: string,
): Promise<ReactionCounts> {
  // Kolom bigint mode:"number" — id non-claim dikonversi dari string route.
  const id = kind === "claim" ? 0 : Number(rawId);
  const claimAddress = rawId.toLowerCase();

  const rows =
    kind === "attestation"
      ? await db
          .select({
            value: attestationReactions.value,
            count: sql<number>`count(*)::int`,
          })
          .from(attestationReactions)
          .where(eq(attestationReactions.attestationId, id))
          .groupBy(attestationReactions.value)
      : kind === "dispute"
        ? await db
            .select({
              value: disputeReactions.value,
              count: sql<number>`count(*)::int`,
            })
            .from(disputeReactions)
            .where(eq(disputeReactions.disputeId, id))
            .groupBy(disputeReactions.value)
        : kind === "vouch"
          ? await db
              .select({
                value: vouchReactions.value,
                count: sql<number>`count(*)::int`,
              })
              .from(vouchReactions)
              .where(eq(vouchReactions.vouchId, id))
              .groupBy(vouchReactions.value)
          : await db
              .select({
                value: profileClaimReactions.value,
                count: sql<number>`count(*)::int`,
              })
              .from(profileClaimReactions)
              .where(eq(profileClaimReactions.claimAddress, claimAddress))
              .groupBy(profileClaimReactions.value);

  let helpful = 0;
  let notHelpful = 0;
  for (const row of rows) {
    if (row.value === "not_helpful") notHelpful += row.count;
    else helpful += row.count;
  }
  return { helpful, notHelpful, myVote: null };
}

export async function getMyVote(
  kind: ReactionKind,
  rawId: string,
  voterAddress: string,
): Promise<ReactionValue | null> {
  const id = kind === "claim" ? 0 : Number(rawId);
  const claimAddress = rawId.toLowerCase();

  const rows =
    kind === "attestation"
      ? await db
          .select({ value: attestationReactions.value })
          .from(attestationReactions)
          .where(
            and(
              eq(attestationReactions.attestationId, id),
              eq(attestationReactions.voterAddress, voterAddress),
            ),
          )
          .limit(1)
      : kind === "dispute"
        ? await db
            .select({ value: disputeReactions.value })
            .from(disputeReactions)
            .where(
              and(
                eq(disputeReactions.disputeId, id),
                eq(disputeReactions.voterAddress, voterAddress),
              ),
            )
            .limit(1)
        : kind === "vouch"
          ? await db
              .select({ value: vouchReactions.value })
              .from(vouchReactions)
              .where(
                and(
                  eq(vouchReactions.vouchId, id),
                  eq(vouchReactions.voterAddress, voterAddress),
                ),
              )
              .limit(1)
          : await db
              .select({ value: profileClaimReactions.value })
              .from(profileClaimReactions)
              .where(
                and(
                  eq(profileClaimReactions.claimAddress, claimAddress),
                  eq(profileClaimReactions.voterAddress, voterAddress),
                ),
              )
              .limit(1);

  const raw = rows[0]?.value;
  return raw === "helpful" || raw === "not_helpful" ? raw : null;
}

export async function saveReaction(
  kind: ReactionKind,
  rawId: string,
  voterAddress: string,
  value: ReactionValue,
): Promise<void> {
  const id = kind === "claim" ? 0 : Number(rawId);
  const claimAddress = rawId.toLowerCase();

  if (kind === "attestation") {
    await db
      .insert(attestationReactions)
      .values({ attestationId: id, voterAddress, value })
      .onConflictDoUpdate({
        target: [
          attestationReactions.attestationId,
          attestationReactions.voterAddress,
        ],
        set: { value, updatedAt: new Date() },
      });
    return;
  }
  if (kind === "dispute") {
    await db
      .insert(disputeReactions)
      .values({ disputeId: id, voterAddress, value })
      .onConflictDoUpdate({
        target: [disputeReactions.disputeId, disputeReactions.voterAddress],
        set: { value, updatedAt: new Date() },
      });
    return;
  }
  if (kind === "vouch") {
    await db
      .insert(vouchReactions)
      .values({ vouchId: id, voterAddress, value })
      .onConflictDoUpdate({
        target: [vouchReactions.vouchId, vouchReactions.voterAddress],
        set: { value, updatedAt: new Date() },
      });
    return;
  }
  await db
    .insert(profileClaimReactions)
    .values({ claimAddress, voterAddress, value })
    .onConflictDoUpdate({
      target: [
        profileClaimReactions.claimAddress,
        profileClaimReactions.voterAddress,
      ],
      set: { value, updatedAt: new Date() },
    });
}
