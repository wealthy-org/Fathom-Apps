import { count, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { THRESHOLDS } from "@/config/thresholds";
import { db } from "@/lib/db/client";
import {
  attestations,
  disputes,
  profileClaims,
  riskDetections,
  scoreSnapshots,
  vouches,
  watches,
} from "@/lib/db/schema";

/**
 * Public activity feed source (Spec 04, Phase 1 slices S1+S2).
 * Default: signal ranking (display-order boosts, then time).
 * - latest: pure time order, no weighting (opt-in via tab=latest).
 * - disputed: every item kind touching a wallet with an open dispute.
 *   Source is disputes.status = "open" — never votes/reactions.
 * - established: attestations/vouches whose actor sits in tier
 *   "Established" (latest score snapshot >= boundary).
 * - signal (default): all kinds, display-order boosts — established actors
 *   (+2), open-dispute involvement (+1), first dispute filed against a
 *   clean wallet (score>=Established + 0 open + 0 detection, +3,
 *   PROVISIONAL), breaking-news (fresh risk_detections row, +4,
 *   PROVISIONAL), viewer-relevant (attest/vouch/dispute/watch history
 *   + self, +2 PROVISIONAL). Time tiebreak, cursor rank|ISO.
 * Kind filter diranking dulu, difilter sesudah.
 *
 * DISPLAY ORDER ONLY. Nothing here feeds lib/score or any scoring
 * file. Tab weights below are UI sort keys, not reputation inputs.
 * risk_detections is written by lib/score/score-refresh.ts, never read
 * by scoring; an empty table degrades to no boost.
 */

export const FEED_TABS = ["signal", "latest", "established", "disputed"] as const;
export type FeedTab = (typeof FEED_TABS)[number];

// Client-safe re-export: komponen client memakai FEED_KINDS tanpa
// menarik modul db ke bundle browser.
export {
  FEED_KINDS,
  isFeedKind,
  type FeedKind,
} from "@/lib/activity/kinds";
import type { FeedKind } from "@/lib/activity/kinds";

export type FeedSignal =
  | "established"
  | "disputed"
  | "first-clean"
  | "risk-news"
  | "personal";

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
      txHash: string | null;
      signals?: FeedSignal[];
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
      txHash: string | null;
      signals?: FeedSignal[];
    }
  | {
      kind: "vouch";
      id: number;
      occurredAt: string;
      from: string;
      to: string;
      stakeWei: string;
      status: string;
      txHash: string;
      signals?: FeedSignal[];
    }
  | {
      kind: "claim";
      id: string;
      occurredAt: string;
      address: string;
      signals?: FeedSignal[];
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
const SIGNAL_PERSONAL_BOOST = THRESHOLDS.activity.signalPersonalBoost;

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

/**
 * Clean wallet untuk boost dispute-pertama: skor terbaru >= Established
 * + 0 open dispute pada target + 0 risk detection tersimpan.
 * Tiga sumber batch, display-only.
 */
async function getCleanTargets(targets: string[]): Promise<Set<string>> {
  const unique = [...new Set(targets)];
  if (unique.length === 0) return new Set();
  const [snapshots, open, detected] = await Promise.all([
    db
      .select({
        address: scoreSnapshots.address,
        totalScore: scoreSnapshots.totalScore,
        createdAt: scoreSnapshots.createdAt,
      })
      .from(scoreSnapshots)
      .where(inArray(scoreSnapshots.address, unique))
      .orderBy(desc(scoreSnapshots.createdAt)),
    getOpenDisputeAddresses(),
    getRiskDetectedAddresses(),
  ]);
  const latest = new Map<string, number>();
  for (const row of snapshots) {
    if (!latest.has(row.address)) latest.set(row.address, row.totalScore);
  }
  const out = new Set<string>();
  for (const address of unique) {
    const score = latest.get(address);
    if (score === undefined || score < ESTABLISHED_MIN_SCORE) continue;
    if (open.has(address)) continue;
    if (detected.has(address)) continue;
    out.add(address);
  }
  return out;
}

/**
 * Wallet relevan untuk viewer (personalisasi riset, bukan popularitas):
 * subject/target/counterparty yang pernah dia attest/vouch/dispute/watch
 * + alamat sendiri. Display-order only, per-viewer.
 */
async function getViewerRelevant(viewer: string): Promise<Set<string>> {
  const [attested, vouched, disputed, watched] = await Promise.all([
    db
      .select({ party: attestations.subjectAddress })
      .from(attestations)
      .where(eq(attestations.attesterAddress, viewer)),
    db
      .select({ party: vouches.toAddress })
      .from(vouches)
      .where(eq(vouches.fromAddress, viewer)),
    db
      .select({ party: disputes.targetAddress })
      .from(disputes)
      .where(eq(disputes.reporterAddress, viewer)),
    db
      .select({ party: watches.targetAddress })
      .from(watches)
      .where(eq(watches.watcherAddress, viewer)),
  ]);
  const out = new Set<string>([viewer]);
  for (const rows of [attested, vouched, disputed, watched]) {
    for (const row of rows) out.add(row.party);
  }
  return out;
}

/** Cursor gabungan rank+time "rank|ISO", legacy ISO polos tetap diterima. */
function parseCursor(cursor: string | undefined): {
  before: Date | null;
  beforeRank: number | null;
} {
  if (!cursor) return { before: null, beforeRank: null };
  const pipe = cursor.indexOf("|");
  if (pipe < 0) {
    const time = new Date(cursor);
    return Number.isNaN(time.getTime())
      ? { before: null, beforeRank: null }
      : { before: time, beforeRank: null };
  }
  const rank = Number(cursor.slice(0, pipe));
  const time = new Date(cursor.slice(pipe + 1));
  if (!Number.isInteger(rank) || Number.isNaN(time.getTime())) {
    return { before: null, beforeRank: null };
  }
  return { before: time, beforeRank: rank };
}

function rankItems(
  prescan: FeedItem[],
  input: {
    established: Set<string>;
    open: Set<string>;
    clean: Set<string>;
    news: Set<string>;
    relevant: Set<string> | null;
  },
): Array<{ item: FeedItem; rank: number }> {
  return prescan.map((item) => {
    let rank = 0;
    const signals: FeedSignal[] = [];
    const relevant = input.relevant;
    if (input.established.has(primaryActor(item))) {
      rank += SIGNAL_ESTABLISHED_BOOST;
      signals.push("established");
    }
    if (involvedAddresses(item).some((address) => input.open.has(address))) {
      rank += SIGNAL_DISPUTED_BOOST;
      signals.push("disputed");
    }
    if (item.kind === "dispute" && input.clean.has(item.target)) {
      rank += SIGNAL_DISPUTE_FIRST_CLEAN_BOOST;
      signals.push("first-clean");
    }
    if (involvedAddresses(item).some((address) => input.news.has(address))) {
      rank += SIGNAL_RISK_NEWS_BOOST;
      signals.push("risk-news");
    }
    if (
      relevant !== null &&
      involvedAddresses(item).some((address) => relevant.has(address))
    ) {
      rank += SIGNAL_PERSONAL_BOOST;
      signals.push("personal");
    }
    return { item: { ...item, signals }, rank };
  });
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
          txHash: attestations.txHash,
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
              txHash: disputes.txHash,
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
          txHash: vouches.txHash,
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
  return items;
}

function paginateSignal(
  ranked: Array<{ item: FeedItem; rank: number }>,
  limit: number,
  beforeRank: number | null,
  before: Date | null,
): FeedPage {
  const filtered =
    before === null
      ? ranked
      : ranked.filter(({ item, rank }) => {
          if (beforeRank === null) return new Date(item.occurredAt) < before;
          if (rank !== beforeRank) return rank < beforeRank;
          return new Date(item.occurredAt) < before;
        });
  const page = filtered.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((entry) => entry.item),
    nextCursor:
      page.length === limit && last
        ? `${last.rank}|${last.item.occurredAt}`
        : null,
  };
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
  /**
   * Kind filter (network feed UI). Diranking dulu dengan bobot signal,
   * difilter sesudah — paging gap-free per kind via cursor rank+time.
   */
  kind?: FeedKind;
  /** Lowercase address — only items touching this wallet are returned. */
  wallet?: string;
  /** Lowercase viewer (SIWE) — personal boost, null = generik. */
  viewer?: string | null;
}): Promise<FeedPage> {
  const { limit, tab = "signal", kind, wallet, viewer = null } = input;
  const { before, beforeRank } = parseCursor(input.cursor);

  const byWallet = (item: FeedItem) =>
    wallet === undefined || involvedAddresses(item).includes(wallet);

  // Signal ranking path: default + semua kind filter.
  // Legacy tab latest/disputed/established tetap didukung bila diminta eksplisit.
  const useSignal =
    tab === "signal" || (kind !== undefined && tab !== "latest");
  if (kind !== undefined && !useSignal) {
    const scanKinds =
      kind === "attestation" || kind === "vouch"
        ? "attestationVouch"
        : "all";
    const candidates = await queryCandidates({ limit, before, kinds: scanKinds });
    const filtered = candidates
      .filter((item) => (kind === "all" ? true : item.kind === kind))
      .filter(byWallet);
    return paginate(filtered, limit);
  }

  if (!useSignal && tab === "latest") {
    // Per-table limit equals page limit: exact, no over-fetch needed.
    const items = await queryCandidates({ limit, before, kinds: "all" });
    const filtered = items.filter(byWallet);
    if (kind !== undefined && kind !== "all") {
      return paginate(
        filtered.filter((item) => item.kind === kind),
        limit,
      );
    }
    return paginate(filtered, limit);
  }

  if (!useSignal && tab === "disputed") {
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

  if (!useSignal && tab === "established") {
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

  // Signal default: display-order boosts, then time.
  // Clean = skor>=Established + 0 open dispute + 0 detection.
  // Personal = viewer relevan (SIWE), null = generik.
  const scanKinds =
    kind === "attestation" || kind === "vouch" ? "attestationVouch" : "all";
  const [prescan, open, newsAddresses, relevant] = await Promise.all([
    queryCandidates({
      limit: limit * TAB_SCAN_MULTIPLIER,
      before,
      kinds: scanKinds,
    }),
    getOpenDisputeAddresses(),
    getFreshRiskNewsAddresses(),
    viewer ? getViewerRelevant(viewer) : Promise.resolve(null),
  ]);
  const [established, clean] = await Promise.all([
    getEstablishedActors(prescan.map((item) => primaryActor(item))),
    getCleanTargets(
      prescan.flatMap((item) =>
        item.kind === "dispute" ? [item.target] : [],
      ),
    ),
  ]);
  const ranked = rankItems(prescan, {
    established,
    open,
    clean,
    news: newsAddresses,
    relevant,
  })
    .sort((a, b) =>
      a.rank === b.rank
        ? a.item.occurredAt === b.item.occurredAt
          ? a.item.kind.localeCompare(b.item.kind)
          : b.item.occurredAt.localeCompare(a.item.occurredAt)
        : b.rank - a.rank,
    )
    .filter(
      ({ item }) =>
        byWallet(item) &&
        (kind === undefined || kind === "all" || item.kind === kind),
    );
  return paginateSignal(ranked, limit, beforeRank, before);
}

/**
 * Total row counts per kind for the toolbar pill counters. Display
 * bounds only — count(*) per table, never a scoring input.
 */
export async function getActivityKindCounts(): Promise<{
  attestation: number;
  vouch: number;
  dispute: number;
  claim: number;
}> {
  const [attestationRows, vouchRows, disputeRows, claimRows] =
    await Promise.all([
      db.select({ value: count() }).from(attestations),
      db.select({ value: count() }).from(vouches),
      db.select({ value: count() }).from(disputes),
      db.select({ value: count() }).from(profileClaims),
    ]);
  return {
    attestation: attestationRows[0]?.value ?? 0,
    vouch: vouchRows[0]?.value ?? 0,
    dispute: disputeRows[0]?.value ?? 0,
    claim: claimRows[0]?.value ?? 0,
  };
}
