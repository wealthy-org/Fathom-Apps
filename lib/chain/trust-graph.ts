import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  attestations,
  counterparties,
  disputes,
  trustGraphState,
  vouches,
  walletRelationships,
  walletTransactions,
  wallets,
} from "@/lib/db/schema";
import { normalizeAddress } from "@/lib/chain/address";
import { fetchAddressTransactions } from "@/lib/chain/blockscout";
import { resolveProtocols } from "@/lib/chain/protocol-identity";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/wallet/chains";
import { THRESHOLDS } from "@/config/thresholds";
import type { Address } from "@/lib/score/types";

const HOUR_MS = 3_600_000;
const MS_PER_DAY = 86_400_000;
const SOURCE = "blockscout";
// ponytail: BigInt(0) bukan literal 0n — target TS proyek masih ES2017.
const ZERO = BigInt(0);
// Batas hash bukti per relasi — representatif, bukan daftar lengkap.
const MAX_TX_HASHES = 5;

export interface RelationshipSummary {
  counterparty: Address;
  isContract: boolean;
  /**
   * Identitas protocol terverifikasi (Fase 2). null = kontrak tanpa mapping
   * verified — node tetap Contract, bukan Protocol karangan.
   */
  protocolId: string | null;
  protocolName: string | null;
  interactionCount: number;
  // Lower bound saat complete=false.
  valueSent: bigint;
  valueReceived: bigint;
  firstInteractionAt: Date | null;
  lastInteractionAt: Date | null;
  /** Jarak hari antara interaksi pertama & terakhir; null kalau tak ada timestamp. */
  durationDays: number | null;
  /** Hash transaksi representatif (capped) untuk evidence_reference tx-level. */
  txHashes: string[];
}

/** Attester → subject dari tabel `attestations` (Spec 07). */
export interface AttesterSummary {
  attester: Address;
  role: string;
  relationship: string;
  createdAt: Date | null;
}

/** Reporter → subject dari tabel `disputes` (Spec 09). Report != vonis. */
export interface DisputeSummary {
  reporter: Address;
  status: string;
  openedAt: Date | null;
}

/** Edge vouch on-chain yang sudah diindeks (tabel `vouches`, Spec 08). */
export interface VouchSummary {
  from: Address;
  to: Address;
  stakeAmount: bigint;
  status: string;
}

export interface TrustGraphSummary {
  uniqueCounterparties: number;
  repeatCounterparties: number;
  /** Relasi terlama (hari) di antara counterparty; null kalau tidak ada. */
  longestRelationshipDays: number | null;
  relationships: RelationshipSummary[];
  /**
   * Edge sosial dari tabel Fathom (Fase 3, PRD §6): attester/dispute/vouch/
   * invitation. Selalu live-read dari DB — bukan cache TTL — karena barisnya
   * kecil dan terindeks. Kosong = belum ada baris, bukan tidak dievaluasi.
   * `relationships` tetap khusus transaksi; risk engine tidak tersentuh.
   */
  attesters: AttesterSummary[];
  disputes: DisputeSummary[];
  vouches: VouchSummary[];
  /** Pengundang via wallets.invited_by; null = tidak ada / belum dicari. */
  invitedBy: Address | null;
  /** Hash transaksi pertama yang menyentuh subject — untuk proof wallet_age. */
  firstTxHash: string | null;
  // Kapan state cache ini ditulis — watermark untuk snapshot Proof.
  // null hanya bila tidak ada state cache dan fetch gagal.
  fetchedAt: Date | null;
  /**
   * false = walk tx kena batas halaman. Semua angka adalah lower bound,
   * bukan nilai pasti. Jangan terbitkan proof turunan saat incomplete.
   */
  complete: boolean;
}

export interface TrustGraphProvider {
  fetch(address: Address): Promise<TrustGraphSummary>;
}

function isFresh(fetchedAt: Date): boolean {
  return (
    Date.now() - fetchedAt.getTime() < THRESHOLDS.trustGraph.cacheTtlHours * HOUR_MS
  );
}

function parseWei(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return ZERO;
  }
}

interface Aggregate {
  isContract: boolean;
  count: number;
  sent: bigint;
  received: bigint;
  first: Date | null;
  last: Date | null;
  txHashes: string[];
}

interface DeriveTx {
  from: Address;
  to: Address | null;
  valueWei: string;
  timestamp: Date | null;
  toIsContract: boolean;
  hash: string | null;
}

/** Derivasi pasangan counterparty dari perspektif subject. Pure, tanpa I/O. */
function derive(subject: Address, txs: DeriveTx[]): Map<Address, Aggregate> {
  const byCounterparty = new Map<Address, Aggregate>();

  const touch = (
    counterparty: Address,
    isContract: boolean,
    sent: bigint,
    received: bigint,
    at: Date | null,
    hash: string | null,
  ) => {
    const agg = byCounterparty.get(counterparty) ?? {
      isContract,
      count: 0,
      sent: ZERO,
      received: ZERO,
      first: null,
      last: null,
      txHashes: [],
    };
    agg.count += 1;
    agg.sent += sent;
    agg.received += received;
    agg.isContract = agg.isContract || isContract;
    if (hash) agg.txHashes.push(hash);
    if (at) {
      if (!agg.first || at < agg.first) agg.first = at;
      if (!agg.last || at > agg.last) agg.last = at;
    }
    byCounterparty.set(counterparty, agg);
  };

  for (const tx of txs) {
    const value = parseWei(tx.valueWei);
    if (tx.from === subject) {
      if (tx.to === null || tx.to === subject) continue; // deploy / self
      touch(tx.to, tx.toIsContract, value, ZERO, tx.timestamp, tx.hash);
    } else if (tx.to === subject) {
      touch(tx.from, false, ZERO, value, tx.timestamp, tx.hash);
    }
    // else: tx yang melibatkan subject hanya via token/internal — di luar semantik.
  }

  return byCounterparty;
}

/** Hash tx first yang menyentuh subject: ambil relasi dengan first paling awal. */
function firstTxHash(pairs: Map<Address, Aggregate>): string | null {
  let best: string | null = null;
  let bestAt: number | null = null;
  for (const agg of pairs.values()) {
    if (!agg.first || agg.txHashes.length === 0) continue;
    if (bestAt === null || agg.first.getTime() < bestAt) {
      bestAt = agg.first.getTime();
      best = agg.txHashes[0];
    }
  }
  return best;
}

function toSummary(
  pairs: Map<Address, Aggregate>,
  complete: boolean,
  fetchedAt: Date | null,
): TrustGraphSummary {
  const relationships: RelationshipSummary[] = [...pairs.entries()].map(
    ([counterparty, agg]) => ({
      counterparty,
      isContract: agg.isContract,
      protocolId: null,
      protocolName: null,
      interactionCount: agg.count,
      valueSent: agg.sent,
      valueReceived: agg.received,
      firstInteractionAt: agg.first,
      lastInteractionAt: agg.last,
      durationDays: durationDays(agg.first, agg.last),
      txHashes: agg.txHashes.slice(0, MAX_TX_HASHES),
    }),
  );

  return {
    uniqueCounterparties: relationships.length,
    repeatCounterparties: relationships.filter(
      (r) => r.interactionCount >= THRESHOLDS.trustGraph.repeatInteractionMin,
    ).length,
    longestRelationshipDays: longestDuration(relationships),
    relationships,
    attesters: [],
    disputes: [],
    vouches: [],
    invitedBy: null,
    firstTxHash: firstTxHash(pairs),
    complete,
    fetchedAt,
  };
}

/** Durasi relasi (hari). Null kalau salah satu ujung timestamp tidak ada. */
function durationDays(first: Date | null, last: Date | null): number | null {
  if (!first || !last) return null;
  return Math.floor((last.getTime() - first.getTime()) / MS_PER_DAY);
}

function longestDuration(relationships: RelationshipSummary[]): number | null {
  let longest: number | null = null;
  for (const rel of relationships) {
    if (rel.durationDays === null) continue;
    if (longest === null || rel.durationDays > longest) longest = rel.durationDays;
  }
  return longest;
}

/**
 * Edge sosial dari tabel Fathom (Fase 3). Live-read kecil terindeks di kedua
 * path (fresh & cache) — bukan bagian cache TTL transaksi. Gagal DB =
 * kosong, bukan gagal fetch: enrichment, bukan core graph.
 */
async function fetchSocialEdges(address: Address): Promise<{
  attesters: AttesterSummary[];
  disputes: DisputeSummary[];
  vouches: VouchSummary[];
  invitedBy: Address | null;
}> {
  const empty = {
    attesters: [],
    disputes: [],
    vouches: [],
    invitedBy: null,
  };
  try {
    const [attesterRows, disputeRows, vouchRows, walletRow] = await Promise.all([
      db
        .select({
          attester: attestations.attesterAddress,
          role: attestations.role,
          relationship: attestations.relationship,
          createdAt: attestations.createdAt,
        })
        .from(attestations)
        .where(eq(attestations.subjectAddress, address)),
      db
        .select({
          reporter: disputes.reporterAddress,
          status: disputes.status,
          openedAt: disputes.openedAt,
        })
        .from(disputes)
        .where(eq(disputes.targetAddress, address)),
      db
        .select({
          from: vouches.fromAddress,
          to: vouches.toAddress,
          stakeAmount: vouches.stakeAmount,
          status: vouches.status,
        })
        .from(vouches)
        .where(or(eq(vouches.toAddress, address), eq(vouches.fromAddress, address))),
      db
        .select({ invitedBy: wallets.invitedBy })
        .from(wallets)
        .where(eq(wallets.address, address))
        .limit(1),
    ]);
    return {
      attesters: attesterRows.map((r) => ({
        attester: r.attester as Address,
        role: r.role,
        relationship: r.relationship,
        createdAt: r.createdAt,
      })),
      disputes: disputeRows.map((r) => ({
        reporter: r.reporter as Address,
        status: r.status,
        openedAt: r.openedAt,
      })),
      vouches: vouchRows.map((r) => ({
        from: r.from as Address,
        to: r.to as Address,
        // numeric tanpa mode bigint → string; parseWei aman gagal → ZERO.
        stakeAmount: typeof r.stakeAmount === "string" ? parseWei(r.stakeAmount) : ZERO,
        status: r.status,
      })),
      invitedBy: (walletRow[0]?.invitedBy as Address | null) ?? null,
    };
  } catch {
    return empty;
  }
}

/** Tempel edge sosial ke summary — dipakai path fresh maupun cache. */
async function attachSocialEdges(
  summary: TrustGraphSummary,
  address: Address,
): Promise<void> {
  const social = await fetchSocialEdges(address);
  summary.attesters = social.attesters;
  summary.disputes = social.disputes;
  summary.vouches = social.vouches;
  summary.invitedBy = social.invitedBy;
}

/**
 * Pengayaan node Contract → Protocol (Fase 2): resolve batch mapping
 * verified untuk counterparty kontrak. Tanpa mapping (atau lookup gagal):
 * field tetap null — node tetap Contract. Enrichment, bukan core graph,
 * jadi kegagalan tidak menggagalkan fetch.
 */
async function attachProtocols(
  relationships: RelationshipSummary[],
): Promise<void> {
  const contracts = relationships
    .filter((r) => r.isContract)
    .map((r) => r.counterparty);
  if (contracts.length === 0) return;
  const identities = await resolveProtocols(
    ROBINHOOD_TESTNET_CHAIN_ID,
    contracts,
  );
  for (const rel of relationships) {
    const identity = identities.get(rel.counterparty.toLowerCase());
    if (identity) {
      rel.protocolId = identity.protocolId;
      rel.protocolName = identity.protocolName;
    }
  }
}

async function readCached(address: Address): Promise<TrustGraphSummary | null> {
  const [state] = await db
    .select({
      complete: trustGraphState.complete,
      fetchedAt: trustGraphState.fetchedAt,
    })
    .from(trustGraphState)
    .where(eq(trustGraphState.subjectAddress, address))
    .limit(1);

  if (!state) return null;

  const rows = await db
    .select({
      counterparty: walletRelationships.counterpartyAddress,
      interactionCount: walletRelationships.interactionCount,
      valueSent: walletRelationships.valueSent,
      valueReceived: walletRelationships.valueReceived,
      firstInteractionAt: walletRelationships.firstInteractionAt,
      lastInteractionAt: walletRelationships.lastInteractionAt,
      isContract: counterparties.isContract,
    })
    .from(walletRelationships)
    .innerJoin(
      counterparties,
      eq(counterparties.address, walletRelationships.counterpartyAddress),
    )
    .where(eq(walletRelationships.subjectAddress, address));

  // Pull capped tx hashes per counterparty for tx-level evidence refs on cache hits.
  const txRows = await db
    .select({
      counterparty: walletTransactions.counterpartyAddress,
      transactionHash: walletTransactions.transactionHash,
      timestamp: walletTransactions.timestamp,
    })
    .from(walletTransactions)
    .where(eq(walletTransactions.subjectAddress, address))
    .orderBy(walletTransactions.timestamp);

  const hashByCounterparty = new Map<string, string[]>();
  for (const tx of txRows) {
    const list = hashByCounterparty.get(tx.counterparty) ?? [];
    if (list.length < MAX_TX_HASHES) list.push(tx.transactionHash);
    hashByCounterparty.set(tx.counterparty, list);
  }

  const relationships: RelationshipSummary[] = rows.map((row) => ({
    counterparty: row.counterparty as Address,
    isContract: row.isContract,
    protocolId: null,
    protocolName: null,
    interactionCount: row.interactionCount,
    valueSent: row.valueSent,
    valueReceived: row.valueReceived,
    firstInteractionAt: row.firstInteractionAt,
    lastInteractionAt: row.lastInteractionAt,
    durationDays: durationDays(row.firstInteractionAt, row.lastInteractionAt),
    txHashes: hashByCounterparty.get(row.counterparty) ?? [],
  }));

  await attachProtocols(relationships);

  const pairs = new Map<Address, Aggregate>();
  for (const rel of relationships) {
    pairs.set(rel.counterparty, {
      isContract: rel.isContract,
      count: rel.interactionCount,
      sent: rel.valueSent,
      received: rel.valueReceived,
      first: rel.firstInteractionAt,
      last: rel.lastInteractionAt,
      txHashes: rel.txHashes,
    });
  }

  const cached: TrustGraphSummary = {
    uniqueCounterparties: relationships.length,
    repeatCounterparties: relationships.filter(
      (r) => r.interactionCount >= THRESHOLDS.trustGraph.repeatInteractionMin,
    ).length,
    longestRelationshipDays: longestDuration(relationships),
    relationships,
    attesters: [],
    disputes: [],
    vouches: [],
    invitedBy: null,
    firstTxHash: firstTxHash(pairs),
    complete: state.complete,
    fetchedAt: state.fetchedAt,
  };
  await attachSocialEdges(cached, address);
  return cached;
}

/**
 * Read-through cache trust graph (Spec 04). Pola sama dengan onchain-stats:
 * pakai baris selama belum lewat TTL; kalau lewat, walk tx explorer lalu persist.
 * Kegagalan fetch mempertahankan data lama — tidak menimpa dengan nol.
 */
class ExplorerTrustGraphProvider implements TrustGraphProvider {
  async fetch(address: Address): Promise<TrustGraphSummary> {
    const normalized = normalizeAddress(address);

    const [state] = await db
      .select({ complete: trustGraphState.complete, fetchedAt: trustGraphState.fetchedAt })
      .from(trustGraphState)
      .where(eq(trustGraphState.subjectAddress, normalized))
      .limit(1);

    if (state && isFresh(state.fetchedAt)) {
      const cached = await readCached(normalized);
      if (cached) return cached;
    }

    const fetched = await fetchAddressTransactions(
      normalized,
      THRESHOLDS.trustGraph.maxCounterpartyPages,
    );

    if (!fetched) {
      const cached = await readCached(normalized);
      return cached ?? toSummary(new Map(), false, null);
    }

    const pairs = derive(normalized, fetched.transactions);
    // fetchedAt ditulis ke trustGraphState di bawah — marker memakai momen yang sama.
    const fetchedAt = new Date();
    const summary = toSummary(pairs, fetched.complete, fetchedAt);
    await attachProtocols(summary.relationships);
    await attachSocialEdges(summary, normalized);

    // counterparties.subjectAddress FK + wallet_relationships FK → subject harus ada.
    await db
      .insert(counterparties)
      .values({ address: normalized, isContract: false, source: SOURCE })
      .onConflictDoNothing();

    for (const rel of summary.relationships) {
      await db
        .insert(counterparties)
        .values({ address: rel.counterparty, isContract: rel.isContract, source: SOURCE })
        .onConflictDoUpdate({
          target: counterparties.address,
          set: { isContract: rel.isContract, updatedAt: new Date() },
        });
    }

    // Ganti set relasi subject supaya tidak ada baris basi dari walk sebelumnya.
    // ponytail: delete+insert non-atomik (neon-http tidak dukung tx). Ini cache
    // turunan; kegagalan di tengah sembuh sendiri saat fetch berikutnya.
    await db
      .delete(walletRelationships)
      .where(eq(walletRelationships.subjectAddress, normalized));

    if (summary.relationships.length > 0) {
      await db.insert(walletRelationships).values(
        summary.relationships.map((rel) => ({
          subjectAddress: normalized,
          counterpartyAddress: rel.counterparty,
          interactionCount: rel.interactionCount,
          valueSent: rel.valueSent,
          valueReceived: rel.valueReceived,
          firstInteractionAt: rel.firstInteractionAt,
          lastInteractionAt: rel.lastInteractionAt,
          source: SOURCE,
        })),
      );
    }

    // Simpan hash transaksi yang menyentuh subject supaya evidence_reference
    // proof bisa menunjuk ke halaman tx. Filter sama dengan derive. Hash null
    // (tidak tersedia) dilewati — jangan menyimpan baris tanpa bukti.
    // ponytail: delete+insert non-atomik, cache turunan — sembuh saat fetch ulang.
    await db
      .delete(walletTransactions)
      .where(eq(walletTransactions.subjectAddress, normalized));

    const txRows = fetched.transactions
      .filter((tx) => {
        if (!tx.hash) return false;
        if (tx.from === normalized) return tx.to !== null && tx.to !== normalized;
        return tx.to === normalized;
      })
      .map((tx) => ({
        subjectAddress: normalized,
        counterpartyAddress: (tx.from === normalized ? tx.to : tx.from) as Address,
        transactionHash: tx.hash as string,
        direction: tx.from === normalized ? "sent" : "received",
        valueWei: BigInt(tx.valueWei),
        toIsContract: tx.toIsContract,
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
        source: SOURCE,
      }));

    if (txRows.length > 0) {
      await db.insert(walletTransactions).values(txRows);
    }

    await db
      .insert(trustGraphState)
      .values({
        subjectAddress: normalized,
        complete: summary.complete,
        source: SOURCE,
        fetchedAt,
      })
      .onConflictDoUpdate({
        target: trustGraphState.subjectAddress,
        set: { complete: summary.complete, source: SOURCE, fetchedAt },
      });

    return summary;
  }
}

export const trustGraph: TrustGraphProvider = new ExplorerTrustGraphProvider();
