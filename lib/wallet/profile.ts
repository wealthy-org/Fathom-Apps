import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { attestations, disputes, profileClaims, wallets, walletTransactions } from "@/lib/db/schema";
import { onchainStats } from "@/lib/chain/onchain-stats";
import { trustGraph, type TrustGraphSummary } from "@/lib/chain/trust-graph";
import {
  protocolsStamp,
  resolveProtocols,
} from "@/lib/chain/protocol-identity";
import {
  readVouchIndexState,
  type VouchIndexState,
} from "@/lib/chain/vouch-registry";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/wallet/chains";
import {
  walletMetricsProvider,
  type ComputedWalletMetrics,
} from "@/lib/chain/wallet-metrics";
import { generateProofs, type Proof } from "@/lib/score/proofs";
import {
  readProofs,
  writeProofs,
  type ProofMarkers,
} from "@/lib/score/proof-store";
import { assessRisk, type RiskInputs, type RiskSignal, type RiskState } from "@/lib/score/risk";
import { flaggedAddressProvider, type FlaggedAddress } from "@/lib/score/flagged-address-provider";
import { maliciousContractProvider, type MaliciousContract } from "@/lib/score/malicious-contract-provider";
import type { AbnormalTxPoint } from "@/lib/score/risk-abnormal";
import { getDimensions, type DimensionState } from "@/lib/score/dimensions";
import type { Address } from "@/lib/score/types";

const MS_PER_DAY = 86_400_000;

/** Attestation publik (Spec 07) — message+signature ikut supaya bisa diverifikasi ulang. */
export interface AttestationView {
  id: number;
  attester: Address;
  role: string;
  relationship: string;
  durationMonths: number | null;
  // Null = baris on-chain dari registry (Fase 7) tanpa payload SIWE.
  message: string | null;
  signature: string | null;
  /**
   * Identitas on-chain dari FathomAttestationRegistry. Null = baris off-chain
   * (SIWE) tanpa padanan registry — bukan data hilang.
   */
  onchainIdentity: {
    registryId: string;
    chainId: number;
    txHash: string;
    blockNumber: number | null;
    logIndex: number | null;
  } | null;
  createdAt: string;
}

/** Dispute publik (Spec 09) — report, bukan bukti wrongdoing. message+signature ikut supaya bisa diverifikasi ulang. */
export interface DisputeView {
  id: number;
  reporter: Address;
  // Null = baris on-chain dari registry (Fase 9) tanpa payload form.
  reason: string | null;
  evidence: string | null;
  message: string | null;
  signature: string | null;
  status: string;
  /**
   * Identitas on-chain dari FathomDisputeRegistry. Null = baris off-chain
   * (form) tanpa padanan registry — bukan data hilang.
   */
  onchainIdentity: {
    registryId: string;
    chainId: number;
    txHash: string;
    blockNumber: number | null;
    logIndex: number | null;
    reasonHash: string | null;
    evidenceRef: string | null;
  } | null;
  openedAt: string;
}

export interface WalletProfile {
  address: Address;
  alias: string | null;
  txCount: number | null;
  firstTxAt: string | null;
  lastTxAt: string | null;
  walletAgeDays: number | null;
  firstSeenAt: string | null;
  claimedAt: string | null;
  /** Baris profile_claims (PRD §20) — null = belum pernah klaim. Write path di Spec 06. */
  claim: { status: string; claimedAt: string } | null;
  /** Agregat turunan wallet_metrics — semua null = belum dihitung. */
  metrics: ComputedWalletMetrics;
  proofs: Proof[];
  dimensions: DimensionState[];
  riskSignals: RiskSignal[];
  riskStates: RiskState[];
  trustGraph: TrustGraphSummary;
  attestations: AttestationView[];
  disputes: DisputeView[];
  /**
   * State index registry vouch (Fase 5). Null = indexer belum pernah jalan
   * (no-index) — bedakan dari confirmed-zero (sudah jalan, tabel vouches
   * kosong untuk wallet ini). UI tidak boleh menampilkan nol palsu.
   */
  vouchIndex: {
    lastBlock: number;
    status: string | null;
    lastIndexedAt: string | null;
  } | null;
}

/** Basic profile (Spec 01) + proof (Spec 02) + dimensions (Spec 03) + trust graph (Spec 04) + claim (Spec 06) + attestations (Spec 07) + disputes (Spec 09) + risk (Spec 05). Data yang tidak tersedia tetap null — jangan dikarang. */
export async function getWalletProfile(address: Address): Promise<WalletProfile> {
  const [wallet] = await db
    .select({
      alias: wallets.alias,
      firstSeenAt: wallets.firstSeenAt,
      claimedAt: wallets.claimedAt,
    })
    .from(wallets)
    .where(eq(wallets.address, address))
    .limit(1);

  const stats = await onchainStats.fetch(address);
  const graph = await trustGraph.fetch(address);
  // State index registry dibaca terpisah dari graph transaksi — indexer vouch
  // punya lifecycle sendiri (Fase 5). Gagal baca = null (no-index), bukan
  // gagal profile: enrichment, bukan core.
  let vouchIndex: WalletProfile["vouchIndex"] = null;
  try {
    const state: VouchIndexState | null = await readVouchIndexState();
    vouchIndex = state
      ? {
          lastBlock: state.lastBlock,
          status: state.status,
          lastIndexedAt: state.lastIndexedAt?.toISOString() ?? null,
        }
      : null;
  } catch {
    vouchIndex = null;
  }
  // Metrik turunan dibaca setelah graph — agregat memakai wallet_transactions
  // yang baru ditulis fetch di atas (graphFetchedAt = staleness bound).
  const metrics = await walletMetricsProvider.refresh(address, graph.fetchedAt);

  const [claimRow] = await db
    .select({
      status: profileClaims.status,
      claimedAt: profileClaims.claimedAt,
    })
    .from(profileClaims)
    .where(eq(profileClaims.address, address))
    .limit(1);

  const attestationRows = await db
    .select({
      id: attestations.id,
      attester: attestations.attesterAddress,
      role: attestations.role,
      relationship: attestations.relationship,
      durationMonths: attestations.durationMonths,
      message: attestations.message,
      signature: attestations.signature,
      registryId: attestations.registryId,
      chainId: attestations.chainId,
      txHash: attestations.txHash,
      blockNumber: attestations.blockNumber,
      logIndex: attestations.logIndex,
      createdAt: attestations.createdAt,
    })
    .from(attestations)
    .where(eq(attestations.subjectAddress, address))
    .orderBy(desc(attestations.createdAt));

  // Proof attestation diterbitkan dari baris tersimpan (query yang sama dipakai
  // untuk render Attestations), jadi tidak ada kalkulasi kedua (Spec 07/11).
  const attestationInputs = attestationRows.map((row) => ({
    attester: row.attester as Address,
    role: row.role,
    relationship: row.relationship,
    durationMonths: row.durationMonths,
    message: row.message,
    onchainIdentity:
      row.registryId !== null && row.chainId !== null && row.txHash !== null
        ? {
            registryId: row.registryId,
            chainId: row.chainId,
            txHash: row.txHash,
          }
        : null,
    createdAt: row.createdAt,
  }));

  // Watermark snapshot Proof: keempat marker harus sama dengan indexed state
  // live agar baris persisted dianggap current (PRD §26, equality-based).
  // Identitas protocol di-resolve ulang untuk proof (graph hanya membawa
  // id+nama untuk display); prefilter memakai hasil resolusi graph supaya
  // query kedua hanya jalan bila ada protocol teridentifikasi.
  const protocolIdentities = await resolveProtocols(
    ROBINHOOD_TESTNET_CHAIN_ID,
    graph.relationships
      .filter((r) => r.protocolId !== null)
      .map((r) => r.counterparty),
  );
  const markers: ProofMarkers = {
    statsFetchedAt: stats.fetchedAt,
    graphFetchedAt: graph.fetchedAt,
    attestationsStamp:
      attestationRows.length === 0
        ? null
        : new Date(
            Math.max(...attestationRows.map((r) => r.createdAt.getTime())),
          ),
    protocolsStamp: await protocolsStamp(),
  };

  let proofs = await readProofs(address, markers);
  if (!proofs) {
    proofs = generateProofs(
      address,
      stats,
      graph,
      attestationInputs,
      new Date(),
      [...protocolIdentities.values()],
    );
    // role_attestation ↔ baris attestation dicocokkan via constraint unik
    // (attester, subject, role) — tidak pernah digabung.
    await writeProofs(address, proofs, markers, (proof) => {
      if (proof.type !== "role_attestation") return null;
      const v = proof.value as { attester: string; role: string };
      return (
        attestationRows.find(
          (r) => r.attester === v.attester && r.role === v.role,
        )?.id ?? null
      );
    });
  }

  // Risk Engine (Spec 05) — dihitung on-the-fly dari data indexed yang sama,
  // bukan kalkulasi kedua atas reputasi (Spec 11 §Boundary). Input detector
  // baru dibaca di sini (satu-satunya I/O risk); tiap sumber gagal = undefined
  // → detector mengembalikan not_evaluable, bukan clear.
  const [txRows, flaggedAddresses, maliciousContracts] = await Promise.all([
    db
      .select({
        timestamp: walletTransactions.timestamp,
        valueWei: walletTransactions.valueWei,
        toIsContract: walletTransactions.toIsContract,
      })
      .from(walletTransactions)
      .where(eq(walletTransactions.subjectAddress, address))
      .then(
        (rows): AbnormalTxPoint[] => rows,
        (): undefined => undefined,
      ),
    flaggedAddressProvider.list().then(
      (rows): FlaggedAddress[] => rows,
      (): undefined => undefined,
    ),
    maliciousContractProvider.list().then(
      (rows): MaliciousContract[] => rows,
      (): undefined => undefined,
    ),
  ]);
  const riskInputs: RiskInputs = {
    transactions: txRows,
    flaggedAddresses,
    maliciousContracts,
  };

  const disputeRows = await db
    .select({
      id: disputes.id,
      reporter: disputes.reporterAddress,
      reason: disputes.reason,
      evidence: disputes.evidence,
      message: disputes.message,
      signature: disputes.signature,
      status: disputes.status,
      registryId: disputes.registryId,
      chainId: disputes.chainId,
      txHash: disputes.txHash,
      blockNumber: disputes.blockNumber,
      logIndex: disputes.logIndex,
      reasonHash: disputes.reasonHash,
      evidenceRef: disputes.evidenceRef,
      openedAt: disputes.openedAt,
    })
    .from(disputes)
    .where(eq(disputes.targetAddress, address))
    .orderBy(desc(disputes.openedAt));

  // Dispute terhadap subject diteruskan ke Risk Engine apa adanya (Fase 9):
  // detector active_disputes yang menilai, bukan profile. Query yang sama
  // dipakai untuk render Disputes — tidak ada kalkulasi kedua.
  riskInputs.disputes = disputeRows.map((row) => ({
    reporter: row.reporter as Address,
    status: row.status,
    registryId: row.registryId,
    txHash: row.txHash,
  }));
  const risk = assessRisk(address, stats, graph, new Date(), riskInputs);
  const riskEvaluable = risk.states.some((state) => state.status !== "not_evaluable");

  return {
    address,
    alias: wallet?.alias ?? null,
    txCount: stats.txCount,
    firstTxAt: stats.firstTxAt?.toISOString() ?? null,
    lastTxAt: stats.lastTxAt?.toISOString() ?? null,
    // Umur hanya dihitung kalau sumber historis ada.
    walletAgeDays: stats.firstTxAt
      ? Math.floor((Date.now() - stats.firstTxAt.getTime()) / MS_PER_DAY)
      : null,
    firstSeenAt: wallet?.firstSeenAt.toISOString() ?? null,
    claimedAt: wallet?.claimedAt?.toISOString() ?? null,
    claim: claimRow
      ? { status: claimRow.status, claimedAt: claimRow.claimedAt.toISOString() }
      : null,
    metrics,
    proofs,
    // Profile tetap evidence-first: Reputation Score (Spec 03) sengaja ditunda
    // sampai input scoring konkret — belum ada kalkulasi skor di sini.
    dimensions: getDimensions(proofs, riskEvaluable),
    riskSignals: risk.signals,
    riskStates: risk.states,
    trustGraph: graph,
    vouchIndex,
    attestations: attestationRows.map((row) => ({
      id: row.id,
      attester: row.attester as Address,
      role: row.role,
      relationship: row.relationship,
      durationMonths: row.durationMonths,
      message: row.message,
      signature: row.signature,
      onchainIdentity:
        row.registryId !== null &&
        row.chainId !== null &&
        row.txHash !== null
          ? {
              registryId: row.registryId,
              chainId: row.chainId,
              txHash: row.txHash,
              blockNumber: row.blockNumber,
              logIndex: row.logIndex,
            }
          : null,
      createdAt: row.createdAt.toISOString(),
    })),
    disputes: disputeRows.map((row) => ({
      id: row.id,
      reporter: row.reporter as Address,
      reason: row.reason,
      evidence: row.evidence,
      message: row.message,
      signature: row.signature,
      status: row.status,
      onchainIdentity:
        row.registryId !== null && row.chainId !== null && row.txHash !== null
          ? {
              registryId: row.registryId,
              chainId: row.chainId,
              txHash: row.txHash,
              blockNumber: row.blockNumber,
              logIndex: row.logIndex,
              reasonHash: row.reasonHash,
              evidenceRef: row.evidenceRef,
            }
          : null,
      openedAt: row.openedAt.toISOString(),
    })),
  };
}
