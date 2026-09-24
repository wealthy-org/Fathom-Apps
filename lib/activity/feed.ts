import { desc, eq, gt, inArray, lt } from "drizzle-orm";
import { THRESHOLDS } from "@/config/thresholds";
import { db } from "@/lib/db/client";
import {
  attestations,
  disputes,
  profileClaims,
  riskDetections,
  scoreSnapshots,
  vouches,
} from "@/lib/db/schema";

/**
 * Public activity feed source (Spec 04, Phase 1 slices S1+S2).
 * Tabs:
 * - latest: pure time order, no weighting.
 * - disputed: every item kind touching a wallet with an open dispute.
 *   Source is disputes.status = "open" — never votes/reactions.
 * - established: attestations/vouches whose actor sits in tier
 *   "Established" (latest score snapshot >= boundary).
 * - signal (v2): all kinds, display-order boosts — established actors
 *   (+2), open-dispute involvement (+1), first dispute filed against a
 *   "clean" wallet (no stored risk detection, +3, PROVISIONAL) and
 *   breaking-news (address with a fresh risk_detections row, +4,
 *   PROVISIONAL). Time tiebreak.
 *
 * DISPLAY ORDER ONLY. Nothing here feeds lib/score or any scoring
 * file. Tab weights below are UI sort keys, not reputation inputs.
 * risk_detections is written by lib/score/score-refresh.ts, never read
 * by scoring; an empty table degrades to no boost.
 */

export const FEED_TABS = ["signal", "latest", "established", "disputed"] as const;
export type FeedTab = (typeof FEED_TABS)[number];

export function isFeedTab(value: unknown): value is FeedTab {
  return (
    typeof value === "string" && (FEED_TABS as readonly string[]).includes(value)
  );
}

export type FeedItem =
  | {
      kind: "attestation";
      id: number;
      occurredAt: string;
      attester: string;
      subject: string;
      role: string;
      relationship: string;
      durationMonths: number | null;
      onchain: boolean;
    }
  | {
      kind: "dispute";
      id: number;
      occurredAt: string;
      reporter: string;
      target: string;
      status: string;
      reason: string | null;
      onchain: boolean;
    }
  | {
      kind: "vouch";
      id: number;
      occurredAt: string;
      from: string;
      to: string;
      stakeWei: string;
      status: string;
    }
  | {
      kind: "claim";
      id: string;
      occurredAt: string;
      address: string;
    };

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

const establishedBoundary = THRESHOLDS.tier.boundaries.find(
  (b) => b.id === "established",
);
if (!establishedBoundary) {
  throw new Error("THRESHOLDS.tier.boundaries lacks an established tier.");
}
const ESTABLISHED_MIN_SCORE = establishedBoundary.minScore;

/**
 * Row scan multiplier for filtered tabs. Display query bound only —
 * filtered-out rows are skipped deterministically so cursor paging
 * stays gap-free. Not a scoring parameter.
 */
const TAB_SCAN_MULTIPLIER = 5;

/**
 * Display-order boosts for the signal tab. UI sort keys, not scoring.
 * Boosts 3-4 are PROVISIONAL (Spec 04 section 2.2, Fase 13 tuning):
 * change values in THRESHOLDS.activity, not here.
 */
const SIGNAL_ESTABLISHED_BOOST = 2;
const SIGNAL_DISPUTED_BOOST = 1;
const SIGNAL_DISPUTE_FIRST_CLEAN_BOOST =
  THRESHOLDS.activity.signalDisputeFirstCleanBoost;
const SIGNAL_RISK_NEWS_BOOST = THRESHOLDS.activity.signalRiskNewsBoost;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Every wallet address an item touches (actor + subject/target). */
function involvedAddresses(item: FeedItem): string[] {
  switch (item.kind) {
    case "attestation":
      return [item.attester, item.subject];
    case "dispute":
      return [item.reporter, item.target];
    case "vouch":
      return [item.from, item.to];
    case "claim":
      return [item.address];
  }
}

/** Primary actor of an item (whose reputation weights display order). */
function primaryActor(item: FeedItem): string {
  switch (item.kind) {
    case "attestation":
      return item.attester;
    case "dispute":
      return item.reporter;
    case "vouch":
      return item.from;
    case "claim":
      return item.address;
  }
}

/** Reporters + targets of all open disputes. */
async function getOpenDisputeAddresses(): Promise<Set<string>> {
  const rows = await db
    .select({
      reporter: disputes.reporterAddress,
      target: disputes.targetAddress,
    })
    .from(disputes)
    .where(eq(disputes.status, "open"));
  const out = new Set<string>();
  for (const row of rows) {
    out.add(row.reporter);
    out.add(row.target);
  }
  return out;
}

/**
 * Subset of addresses whose latest score snapshot reaches the
 * Established boundary. Addresses without any snapshot count as
 * not established — snapshots are cache, never guessed tiers.
 */
async function getEstablishedActors(addresses: string[]): Promise<Set<string>> {
  const unique = [...new Set(addresses)];
  if (unique.length === 0) return new Set();
  const rows = await db
    .select({
      address: scoreSnapshots.address,
      totalScore: scoreSnapshots.totalScore,
      createdAt: scoreSnapshots.createdAt,
    })
    .from(scoreSnapshots)
    .where(inArray(scoreSnapshots.address, unique))
    .orderBy(desc(scoreSnapshots.createdAt));
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.address)) continue;
    seen.add(row.address);
    if (row.totalScore >= ESTABLISHED_MIN_SCORE) out.add(row.address);
  }
  return out;
}

/**
 * Addresses with ANY stored risk detection. "Clean wallet" source for
 * the dispute-first boost — absence here means never detected. Table is
 * display-only (written by score-refresh); scoring never reads it.
 */
async function getRiskDetectedAddresses(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ address: riskDetections.walletAddress })
    .from(riskDetections);
  return new Set(rows.map((row) => row.address));
}

/**
 * Addresses with a FRESH risk detection (breaking news, Spec 04
 * section 2.3 item 3). Window + limit are display bounds from
 * THRESHOLDS.activity. Empty table degrades to no boost.
 */
async function getFreshRiskNewsAddresses(): Promise<Set<string>> {
  const cutoff = new Date(
    Date.now() - THRESHOLDS.activity.riskNewsWindowHours * 60 * 60 * 1000,
  );
  const rows = await db
    .selectDistinct({ address: riskDetections.walletAddress })
    .from(riskDetections)
    .where(gt(riskDetections.detectedAt, cutoff))
    .limit(THRESHOLDS.activity.riskNewsLimit);
  return new Set(rows.map((row) => row.address));
}

async function queryCandidates(input: {
  limit: number;
  before: Date | null;
  kinds: "all" | "attestationVouch";
}): Promise<FeedItem[]> {
  const { limit, before } = input;
  const wantDisputes = input.kinds === "all";
  const wantClaims = input.kinds === "all";

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
          createdAt: attestations.createdAt,
        })
        .from(attestations)
        .where(before ? lt(attestations.createdAt, before) : undefined)
        .orderBy(desc(attestations.createdAt))
        .limit(limit),
      wantDisputes
        ? db
            .select({
              id: disputes.id,
              reporter: disputes.reporterAddress,
              target: disputes.targetAddress,
              status: disputes.status,
              reason: disputes.reason,
              registryId: disputes.registryId,
              openedAt: disputes.openedAt,
            })
            .from(disputes)
            .where(before ? lt(disputes.openedAt, before) : undefined)
            .orderBy(desc(disputes.openedAt))
            .limit(limit)
        : Promise.resolve([]),
      db
        .select({
          id: vouches.id,
          from: vouches.fromAddress,
          to: vouches.toAddress,
          stakeWei: vouches.stakeAmount,
          status: vouches.status,
          createdAt: vouches.createdAt,
        })
        .from(vouches)
        .where(before ? lt(vouches.createdAt, before) : undefined)
        .orderBy(desc(vouches.createdAt))
        .limit(limit),
      wantClaims
        ? db
            .select({
              address: profileClaims.address,
              claimedAt: profileClaims.claimedAt,
            })
            .from(profileClaims)
            .where(before ? lt(profileClaims.claimedAt, before) : undefined)
            .orderBy(desc(profileClaims.claimedAt))
            .limit(limit)
        : Promise.resolve([]),
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
  return items;
}

function paginate(items: FeedItem[], limit: number): FeedPage {
  const page = items.slice(0, limit);
  return {
    items: page,
    nextCursor: page.length === limit ? page[page.length - 1].occurredAt : null,
  };
}

export async function getActivityFeed(input: {
  limit: number;
  cursor?: string;
  tab?: FeedTab;
  /** Lowercase address — only items touching this wallet are returned. */
  wallet?: string;
}): Promise<FeedPage> {
  const { limit, tab = "latest", wallet } = input;
  const before = input.cursor ? new Date(input.cursor) : null;

  const byWallet = (item: FeedItem) =>
    wallet === undefined || involvedAddresses(item).includes(wallet);

  if (tab === "latest") {
    // Per-table limit equals page limit: exact, no over-fetch needed.
    const items = await queryCandidates({ limit, before, kinds: "all" });
    return paginate(items.filter(byWallet), limit);
  }

  if (tab === "disputed") {
    const [candidates, open] = await Promise.all([
      queryCandidates({ limit: limit * TAB_SCAN_MULTIPLIER, before, kinds: "all" }),
      getOpenDisputeAddresses(),
    ]);
    const filtered = candidates.filter(
      (item) =>
        byWallet(item) &&
        involvedAddresses(item).some((address) => open.has(address)),
    );
    return paginate(filtered, limit);
  }

  if (tab === "established") {
    const candidates = await queryCandidates({
      limit: limit * TAB_SCAN_MULTIPLIER,
      before,
      kinds: "attestationVouch",
    });
    const established = await getEstablishedActors(
      candidates.map((item) => primaryActor(item)),
    );
    const filtered = candidates.filter(
      (item) =>
        byWallet(item) && established.has(primaryActor(item)),
    );
    return paginate(filtered, limit);
  }

  // tab === "signal": display-order boosts, then time (Spec 04 section 2.2).
  const [prescan, open, detectedAddresses, newsAddresses] = await Promise.all([
    queryCandidates({ limit: limit * TAB_SCAN_MULTIPLIER, before, kinds: "all" }),
    getOpenDisputeAddresses(),
    getRiskDetectedAddresses(),
    getFreshRiskNewsAddresses(),
  ]);
  const established = await getEstablishedActors(
    prescan.map((item) => primaryActor(item)),
  );
  const ranked = prescan
    .map((item): { item: FeedItem; rank: number } => {
      let rank = 0;
      if (established.has(primaryActor(item))) {
        rank += SIGNAL_ESTABLISHED_BOOST;
      }
      if (involvedAddresses(item).some((address) => open.has(address))) {
        rank += SIGNAL_DISPUTED_BOOST;
      }
      // First report against a clean wallet: dispute whose target has
      // no stored risk detection (PROVISIONAL display boost).
      if (
        item.kind === "dispute" &&
        !detectedAddresses.has(item.target)
      ) {
        rank += SIGNAL_DISPUTE_FIRST_CLEAN_BOOST;
      }
      // Breaking news: item touches an address with a fresh detection.
      if (involvedAddresses(item).some((address) => newsAddresses.has(address))) {
        rank += SIGNAL_RISK_NEWS_BOOST;
      }
      return { item, rank };
    })
    .sort((a, b) =>
      a.rank === b.rank
        ? a.item.occurredAt === b.item.occurredAt
          ? a.item.kind.localeCompare(b.item.kind)
          : b.item.occurredAt.localeCompare(a.item.occurredAt)
        : b.rank - a.rank,
    )
    .map((entry) => entry.item);
  return paginate(ranked.filter(byWallet), limit);
}
