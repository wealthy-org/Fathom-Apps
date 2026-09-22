import {
  bigint,
  bigserial,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { ScoreSnapshotBreakdown } from "@/lib/score/types";

/**
 * Representasi kode dari SQL di Spec 00 §2.
 * Jika berbeda dengan spec, SQL di spec yang menang dan file ini yang diperbaiki.
 */

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

// ponytail: BigInt(0) bukan literal 0n — target TS proyek masih ES2017.
const ZERO = BigInt(0);

export const wallets = pgTable(
  "wallets",
  {
    address: char("address", { length: 42 }).primaryKey(),
    alias: varchar("alias", { length: 32 }),
    invitedBy: char("invited_by", { length: 42 }).references(
      (): AnyPgColumn => wallets.address,
    ),
    firstSeenAt: timestamptz("first_seen_at").notNull().defaultNow(),
    // Bukti ownership: kapan pemilik berhasil SIWE (Spec 06). Claim tidak menciptakan reputasi.
    claimedAt: timestamptz("claimed_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_wallets_invited_by").on(t.invitedBy)],
);

/**
 * Status klaim kepemilikan wallet (PRD §20, §25 `profile_claims`).
 * Satu baris = pemilik pernah membuktikan kontrol via SIWE (Spec 06).
 * message+signature disimpan supaya klaim bisa diverifikasi ulang —
 * konvensi yang sama dengan `disputes` dan `attestations`.
 * Claiming tidak menciptakan reputasi.
 */
export const profileClaims = pgTable("profile_claims", {
  address: char("address", { length: 42 })
    .primaryKey()
    .references(() => wallets.address),
  status: varchar("status", { length: 16 }).notNull().default("claimed"),
  message: text("message").notNull(),
  signature: char("signature", { length: 132 }).notNull(),
  claimedAt: timestamptz("claimed_at").notNull().defaultNow(),
});

export const walletOnchainStats = pgTable("wallet_onchain_stats", {
  address: char("address", { length: 42 })
    .primaryKey()
    .references(() => wallets.address),
  // NULL = belum diketahui. RPC-only tidak bisa enumerasi riwayat (Spec 01 data blocker).
  // Jangan pakai default 0 — itu mengarang jumlah transaksi.
  firstTxAt: timestamptz("first_tx_at"),
  lastTxAt: timestamptz("last_tx_at"),
  txCount: integer("tx_count"),
    // Sumber data indexed terakhir, mis. "blockscout". NULL = belum pernah di-fetch.
    source: varchar("source", { length: 32 }),
    fetchedAt: timestamptz("fetched_at").notNull().defaultNow(),
  },
);

/**
 * Agregat metrik aktivitas per wallet (PRD §25 `wallet_metrics`).
 * Diturunkan dari `wallet_transactions` yang sudah diindeks — bukan sumber
 * baru, bukan derivasi kedua. NULL = belum dihitung, bukan 0.
 * Ditulis hanya oleh `lib/chain/wallet-metrics.ts` dengan watermark
 * `computed_at`; angka uang numeric(78,0) → bigint.
 */
export const walletMetrics = pgTable("wallet_metrics", {
  address: char("address", { length: 42 })
    .primaryKey()
    .references(() => wallets.address),
  activeDays: integer("active_days"),
  activeMonths: integer("active_months"),
  totalSentWei: numeric("total_sent_wei", { precision: 78, scale: 0, mode: "bigint" }),
  totalReceivedWei: numeric("total_received_wei", {
    precision: 78,
    scale: 0,
    mode: "bigint",
  }),
  avgValueWei: numeric("avg_value_wei", { precision: 78, scale: 0, mode: "bigint" }),
  largestValueWei: numeric("largest_value_wei", {
    precision: 78,
    scale: 0,
    mode: "bigint",
  }),
  // Sumber agregat, mis. "wallet_transactions". NULL = belum pernah dihitung.
  source: varchar("source", { length: 32 }),
  computedAt: timestamptz("computed_at").notNull().defaultNow(),
});

/**
 * Cache alamat yang pernah berinteraksi (Spec 04). Sengaja TIDAK FK ke `wallets`
 * supaya `wallets` tetap berarti "wallet yang dicari", bukan setiap address lawan
 * transaksi. Menyimpan klasifikasi EOA/kontrak dari sumber indexed.
 */
export const counterparties = pgTable("counterparties", {
  address: char("address", { length: 42 }).primaryKey(),
  isContract: boolean("is_contract").notNull().default(false),
  source: varchar("source", { length: 32 }),
  firstSeenAt: timestamptz("first_seen_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

/**
 * Edge trust graph (Spec 04): relasi subject -> counterparty dari interaksi langsung.
 * valueSent/valueReceived perspektif subject (wei, numeric(78,0) → bigint).
 */
export const walletRelationships = pgTable(
  "wallet_relationships",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    subjectAddress: char("subject_address", { length: 42 })
      .notNull()
      .references(() => counterparties.address),
    counterpartyAddress: char("counterparty_address", { length: 42 })
      .notNull()
      .references(() => counterparties.address),
    interactionCount: integer("interaction_count").notNull(),
    valueSent: numeric("value_sent", { precision: 78, scale: 0, mode: "bigint" })
      .notNull()
      .default(ZERO),
    valueReceived: numeric("value_received", {
      precision: 78,
      scale: 0,
      mode: "bigint",
    })
      .notNull()
      .default(ZERO),
    firstInteractionAt: timestamptz("first_interaction_at"),
    lastInteractionAt: timestamptz("last_interaction_at"),
    source: varchar("source", { length: 32 }),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("wallet_relationships_pair").on(t.subjectAddress, t.counterpartyAddress),
    index("idx_relationships_subject").on(t.subjectAddress, t.interactionCount),
  ],
);

/**
 * Status derivasi trust graph per subject (Spec 04). `complete` false = walk
 * kena batas halaman, jadi jumlah counterparty adalah lower bound, bukan pasti.
 * Menyimpan ini eksplisit supaya cache tidak diam-diam mengubah partial jadi pasti.
 */
export const trustGraphState = pgTable("trust_graph_state", {
  subjectAddress: char("subject_address", { length: 42 })
    .primaryKey()
    .references(() => counterparties.address),
  complete: boolean("complete").notNull(),
  source: varchar("source", { length: 32 }),
  fetchedAt: timestamptz("fetched_at").notNull().defaultNow(),
});

/**
 * Identitas protocol terverifikasi (Fase 2, PRD §15): pemetaan
 * `chainId + contractAddress → protocol` milik Fathom, bisa diaudit.
 *
 * Sengaja TANPA FK ke `counterparties`: mapping ada independen dari apakah
 * kontraknya pernah teramati berinteraksi. Satu kontrak bisa punya beberapa
 * evidence record (beda `source`); klaim final hanya yang `verified`.
 * Jangan menyimpulkan protocol dari nama kontrak/label explorer/TVL.
 */
export const protocols = pgTable(
  "protocols",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    chainId: integer("chain_id").notNull(),
    contractAddress: char("contract_address", { length: 42 }).notNull(),
    protocolId: varchar("protocol_id", { length: 64 }).notNull(),
    protocolName: varchar("protocol_name", { length: 128 }).notNull(),
    // "official" | "curated" | "verified_external" — lihat protocol-identity.ts.
    source: varchar("source", { length: 32 }).notNull(),
    sourceUrl: text("source_url"),
    // "unverified" | "verified". Hanya "verified" yang boleh dipakai
    // proof/graph — sisanya jejak audit, bukan otoritas.
    verificationStatus: varchar("verification_status", { length: 16 })
      .notNull()
      .default("unverified"),
    verifiedAt: timestamptz("verified_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("protocols_chain_contract_source").on(
      t.chainId,
      t.contractAddress,
      t.source,
    ),
    index("idx_protocols_chain_contract").on(t.chainId, t.contractAddress),
  ],
);

/**
 * Aktivitas transaksi langsung per subject (Spec 00 `wallet_activity`).
 * Menyimpan hash transaksi yang relevan supaya evidence_reference proof bisa
 * menunjuk ke halaman tx (bukan hanya halaman address). Hash unik per subject —
 * tx pertama yang menyentuh subject disimpan; baris diperbarui saat refresh.
 */
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    subjectAddress: char("subject_address", { length: 42 })
      .notNull()
      .references(() => counterparties.address),
    counterpartyAddress: char("counterparty_address", { length: 42 })
      .notNull()
      .references(() => counterparties.address),
    transactionHash: char("transaction_hash", { length: 66 }).notNull(),
    // "sent" | "received" dilihat dari perspektif subject.
    direction: varchar("direction", { length: 12 }).notNull(),
    valueWei: numeric("value_wei", { precision: 78, scale: 0, mode: "bigint" })
      .notNull()
      .default(ZERO),
    toIsContract: boolean("to_is_contract").notNull().default(false),
    blockNumber: bigint("block_number", { mode: "number" }),
    timestamp: timestamptz("timestamp"),
    source: varchar("source", { length: 32 }),
    fetchedAt: timestamptz("fetched_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_tx_subject").on(t.subjectAddress, t.timestamp),
    // Satu subject hanya satu baris per tx hash — refresh idempoten.
    unique("wallet_transactions_subject_hash").on(t.subjectAddress, t.transactionHash),
  ],
);

export const vouches = pgTable(
  "vouches",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    chainId: integer("chain_id").notNull(),
    txHash: char("tx_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    fromAddress: char("from_address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    toAddress: char("to_address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    stakeAmount: numeric("stake_amount", { precision: 78, scale: 0 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdAt: timestamptz("created_at").notNull(),
  },
  (t) => [
    // Identitas event minimal chain_id + tx_hash + log_index — indexer idempoten
    unique("vouches_tx_identity").on(t.chainId, t.txHash, t.logIndex),
    index("idx_vouches_to").on(t.toAddress, t.status),
    index("idx_vouches_pair").on(t.fromAddress, t.toAddress, t.createdAt),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fromAddress: char("from_address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    toAddress: char("to_address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    // Satu wallet hanya satu review per target — cegah spam rating
    unique("reviews_pair").on(t.fromAddress, t.toAddress),
    check("reviews_rating_range", sql`${t.rating} BETWEEN 1 AND 5`),
    index("idx_reviews_to").on(t.toAddress),
  ],
);

export const disputes = pgTable(
  "disputes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    targetAddress: char("target_address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    // Spec 09: satu dispute punya satu reporter. Report != bukti wrongdoing.
    reporterAddress: char("reporter_address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    reason: text("reason"),
    evidence: text("evidence"),
    // Payload kanonik + tanda tangan reporter, agar report bisa diverifikasi ulang.
    // Nullable = baris on-chain dari registry (Fase 9) tanpa payload form;
    // baris off-chain selalu terisi.
    message: text("message"),
    signature: char("signature", { length: 132 }),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    openedAt: timestamptz("opened_at").notNull().defaultNow(),
    resolvedAt: timestamptz("resolved_at"),
    resolutionNote: text("resolution_note"),
    // Komitmen on-chain dari FathomDisputeRegistry: hash reason + referensi
    // evidence (teks penuh off-chain). Baris off-chain selalu null.
    reasonHash: char("reason_hash", { length: 66 }),
    evidenceRef: char("evidence_ref", { length: 66 }),
    // Identitas on-chain dari FathomDisputeRegistry (Fase 9). Semua null =
    // baris off-chain (form) tanpa padanan registry — bukan data hilang.
    registryId: varchar("registry_id", { length: 64 }),
    chainId: integer("chain_id"),
    txHash: char("tx_hash", { length: 66 }),
    blockNumber: bigint("block_number", { mode: "number" }),
    logIndex: integer("log_index"),
  },
  (t) => [
    index("idx_disputes_target").on(t.targetAddress, t.status),
    // Cegah satu reporter membanjiri target yang sama dengan dispute berulang
    // (hanya baris off-chain: on-chain didedup via disputes_onchain_identity,
    // dan event registry tidak boleh ditelan baris legacy).
    uniqueIndex("disputes_reporter_target")
      .on(t.reporterAddress, t.targetAddress)
      .where(sql`"disputes"."registry_id" IS NULL`),
    // Identitas event kanonik (chain_id + tx_hash + log_index) — indexer idempoten.
    unique("disputes_onchain_identity").on(
      t.registryId,
      t.chainId,
      t.txHash,
      t.logIndex,
    ),
  ],
);

export const disputeReports = pgTable(
  "dispute_reports",
  {
    disputeId: bigint("dispute_id", { mode: "number" })
      .notNull()
      .references(() => disputes.id),
    reporterAddress: char("reporter_address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    reason: text("reason"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.disputeId, t.reporterAddress] })],
);

export const roleBadges = pgTable(
  "role_badges",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    address: char("address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    role: varchar("role", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("unverified"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique("role_badges_address_role").on(t.address, t.role)],
);

export const badgeAttestations = pgTable(
  "badge_attestations",
  {
    badgeId: bigint("badge_id", { mode: "number" })
      .notNull()
      .references(() => roleBadges.id),
    attesterAddress: char("attester_address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.badgeId, t.attesterAddress] })],
);

export const attestations = pgTable(
  "attestations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    subjectAddress: char("subject_address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    attesterAddress: char("attester_address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    role: varchar("role", { length: 32 }).notNull(),
    relationship: varchar("relationship", { length: 64 }).notNull(),
    durationMonths: integer("duration_months"),
    // Payload kanonik yang ditandatangani + signature (Spec 07) — attestation
    // bisa diverifikasi ulang, bukan cuma baris DB yang bisa dipalsukan server.
    // Nullable = baris on-chain dari registry (Fase 7) tanpa payload SIWE;
    // baris off-chain selalu terisi.
    message: text("message"),
    signature: char("signature", { length: 132 }),
    // Identitas on-chain dari FathomAttestationRegistry (Fase 7). Semua null =
    // baris off-chain (SIWE) tanpa padanan registry — bukan data hilang.
    registryId: varchar("registry_id", { length: 64 }),
    chainId: integer("chain_id"),
    txHash: char("tx_hash", { length: 66 }),
    blockNumber: bigint("block_number", { mode: "number" }),
    logIndex: integer("log_index"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    // Satu attester hanya satu attestation OFF-CHAIN per subject+role — cegah
    // spam duplikat form. Partial index (registry_id IS NULL): baris on-chain
    // boleh berbagi triple yang sama; dedup on-chain via
    // attestations_onchain_identity. Tanpa partial, baris legacy SIWE menelan
    // event on-chain via onConflictDoNothing di indexer.
    uniqueIndex("attestations_identity")
      .on(t.attesterAddress, t.subjectAddress, t.role)
      .where(sql`${t.registryId} IS NULL`),
    // Identitas event kanonik (chain_id + tx_hash + log_index) — indexer idempoten.
    unique("attestations_onchain_identity").on(
      t.registryId,
      t.chainId,
      t.txHash,
      t.logIndex,
    ),
    index("idx_attestations_subject").on(t.subjectAddress, t.createdAt),
  ],
);

/**
 * Persisted Proof snapshot (PRD §26 Proof Storage). Bukan derivasi kedua:
 * baris ditulis hanya oleh `lib/score/proof-store.ts` dari hasil
 * `generateProofs()` atas indexed state saat itu. Empat kolom watermark
 * (`stats_fetched_at`, `graph_fetched_at`, `attestations_stamp`,
 * `protocols_stamp`) menandai indexed state yang dipakai — snapshot current
 * hanya bila keempatnya sama dengan marker live. `attestation_id` memberi
 * identitas pada tiap `role_attestation` (satu baris per attestation, tidak
 * digabung).
 */
export const proofs = pgTable(
  "proofs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    walletAddress: char("wallet_address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    proofType: varchar("proof_type", { length: 32 }).notNull(),
    source: varchar("source", { length: 32 }).notNull(),
    value: jsonb("value").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
    verificationMethod: varchar("verification_method", {
      length: 16,
    }).notNull(),
    evidenceReference: text("evidence_reference").notNull(),
    evidenceReferences: jsonb("evidence_references"),
    attestationId: bigint("attestation_id", { mode: "number" }).references(
      () => attestations.id,
    ),
    statsFetchedAt: timestamptz("stats_fetched_at"),
    graphFetchedAt: timestamptz("graph_fetched_at"),
    attestationsStamp: timestamptz("attestations_stamp"),
    protocolsStamp: timestamptz("protocols_stamp"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("idx_proofs_subject").on(t.walletAddress)],
);

export const scoreSnapshots = pgTable(
  "score_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    address: char("address", { length: 42 })
      .notNull()
      .references(() => wallets.address),
    formulaVersion: varchar("formula_version", { length: 32 }).notNull(),
    fingerprint: char("fingerprint", { length: 64 }).notNull(),
    totalScore: integer("total_score").notNull(),
    breakdown: jsonb("breakdown").$type<ScoreSnapshotBreakdown>().notNull(),
    triggerEvent: varchar("trigger_event", { length: 32 }).notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_snapshots_address_time").on(t.address, t.createdAt),
    unique("score_snapshots_fingerprint").on(t.address, t.fingerprint),
  ],
);

export const indexerState = pgTable(
  "indexer_state",
  {
    contractName: varchar("contract_name", { length: 64 }).notNull(),
    chainId: integer("chain_id").notNull(),
    lastBlock: bigint("last_block", { mode: "number" }).notNull().default(0),
    // Status run terakhir indexer ("ok" | "error" | "unconfigured").
    // null = indexer belum pernah jalan (no-index) — bedakan dari
    // confirmed-zero (sudah jalan, tidak ada event).
    status: varchar("status", { length: 16 }),
    error: text("error"),
    lastIndexedAt: timestamptz("last_indexed_at"),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.contractName, t.chainId] })],
);

/**
 * Daftar address flagged eksternal (Spec 05, flagged_counterparty_exposure).
 * Registry kosong = sinyal not_evaluable, bukan clear. Baris ditulis dari
 * sumber kurasi — tidak pernah hardcode di kode.
 */
export const flaggedAddresses = pgTable(
  "flagged_addresses",
  {
    chainId: integer("chain_id").notNull(),
    address: char("address", { length: 42 }).notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    reason: text("reason").notNull(),
    evidenceReference: text("evidence_reference"),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.chainId, t.address] }),
    index("idx_flagged_source").on(t.source),
  ],
);

/**
 * Daftar kontrak malicious terkonfirmasi (Spec 05,
 * malicious_contract_interaction). Identitas kontrak (counterparties.isContract)
 * terpisah dari klasifikasi malicious — tabel ini satu-satunya sumber
 * klasifikasi. Registry kosong = not_evaluable, bukan clear.
 */
export const maliciousContracts = pgTable(
  "malicious_contracts",
  {
    chainId: integer("chain_id").notNull(),
    address: char("address", { length: 42 }).notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    reason: text("reason").notNull(),
    evidenceReference: text("evidence_reference"),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.chainId, t.address] }),
    index("idx_malicious_source").on(t.source),
  ],
);
