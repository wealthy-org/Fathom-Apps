import { THRESHOLDS } from "@/config/thresholds";
import { explorerAddressUrl, explorerTransactionUrl } from "@/lib/chain/blockscout";
import type { OnchainStats } from "@/lib/chain/onchain-stats";
import type { TrustGraphSummary } from "@/lib/chain/trust-graph";
import type { ProtocolIdentity } from "@/lib/chain/protocol-identity";
import type { Address } from "@/lib/score/types";

/**
 * Proof Engine (Spec 02). Mengubah data on-chain ternormalisasi menjadi Proof
 * yang bisa diperiksa. Proof TIDAK memuat skor reputasi.
 *
 * Semua proof di sini reproducible dari data indexed yang sudah dinormalisasi:
 * stats on-chain (Spec 01), trust graph (Spec 04), dan attestation tersimpan
 * (Spec 07). Tipe yang belum punya rumus (activity_consistency) sengaja tidak
 * dibuat — jangan mengarang.
 */

export type ProofType =
  | "wallet_age"
  | "transaction_history"
  | "unique_counterparty"
  | "repeat_counterparty"
  | "economic_history"
  | "contract_history"
  | "protocol_history"
  | "role_attestation";
export type VerificationMethod = "indexed" | "derived";

export interface Proof {
  type: ProofType;
  source: string;
  subject: Address;
  value: unknown;
  timestamp: string;
  confidence: number;
  verification_method: VerificationMethod;
  /** Primary evidence reference — tx-level bila tersedia, else address-level. */
  evidence_reference: string;
  /**
   * Additional tx-level evidence references (optional). Menunjuk ke transaksi
   * yang benar-benar mendasari klaim; address-level bila tidak ada hash yang
   * dipertahankan. Tidak menaikkan confidence.
   */
  evidence_references?: string[];
}

/** Attestation tersimpan yang cukup untuk diterbitkan sebagai proof (Spec 07). */
export interface AttestationProofInput {
  attester: Address;
  role: string;
  relationship: string;
  durationMonths: number | null;
  /** Pesan kanonik yang ditandatangani — buktinya sendiri, bisa diverifikasi ulang. */
  message: string | null;
  /**
   * Identitas on-chain dari FathomAttestationRegistry (Fase 7). Null = baris
   * off-chain (SIWE). Proof memakai txHash sebagai evidence_reference.
   */
  onchainIdentity: { registryId: string; chainId: number; txHash: string } | null;
  createdAt: Date;
}

// ponytail: sumber indexed tunggal saat ini. Pindahkan ke kolom/props kalau
// provider berubah, jangan biarkan menyimpang dari yang benar-benar dipakai.
const SOURCE = "blockscout";
const ATTESTATION_SOURCE = "attestation";

const MS_PER_DAY = 86_400_000;
const ZERO = BigInt(0);

/** Anchor bagian Attestations di halaman profil — tempat bukti bisa diperiksa. */
function attestationEvidenceReference(address: Address): string {
  return `/wallets/${address}#attestations`;
}

export function generateProofs(
  address: Address,
  stats: OnchainStats,
  graph: TrustGraphSummary | null,
  attestations: AttestationProofInput[],
  now: Date,
  protocols: ProtocolIdentity[] = [],
): Proof[] {
  const proofs: Proof[] = [];
  const observedAt = now.toISOString();
  // Address-level fallback — dipakai saat tidak ada hash yang dipertahankan.
  const evidenceReference = explorerAddressUrl(address);

  /** Semua hash evidence yang tersedia untuk subject ini. */
  function txRefs(hashes: string[] | undefined): { ref: string; refs: string[] } {
    const clean = (hashes ?? []).filter(Boolean);
    if (clean.length === 0) {
      return { ref: evidenceReference, refs: [] };
    }
    const refs = clean.map(explorerTransactionUrl);
    return { ref: refs[0], refs };
  }

  const firstTxRefs = txRefs(graph?.firstTxHash ? [graph.firstTxHash] : undefined);

  if (stats.firstTxAt) {
    const ageDays = Math.floor(
      (now.getTime() - stats.firstTxAt.getTime()) / MS_PER_DAY,
    );
    proofs.push({
      type: "wallet_age",
      source: SOURCE,
      subject: address,
      value: { ageDays, firstTxAt: stats.firstTxAt.toISOString() },
      timestamp: observedAt,
      confidence: THRESHOLDS.proof.confidenceByMethod.derived,
      verification_method: "derived",
      evidence_reference: firstTxRefs.ref,
      ...(firstTxRefs.refs.length > 0 ? { evidence_references: firstTxRefs.refs } : {}),
    });
  }

  // txCount null = riwayat belum diketahui (mis. lewat batas pagination).
  // Jangan terbitkan proof yang mengklaim angka yang tidak kita punya.
  if (stats.txCount !== null) {
    const allRefs = graph
      ? txRefs(graph.relationships.flatMap((r) => r.txHashes))
      : { ref: evidenceReference, refs: [] };
    proofs.push({
      type: "transaction_history",
      source: SOURCE,
      subject: address,
      value: { txCount: stats.txCount },
      timestamp: observedAt,
      confidence: THRESHOLDS.proof.confidenceByMethod.indexed,
      verification_method: "indexed",
      evidence_reference: allRefs.ref,
      ...(allRefs.refs.length > 0
        ? { evidence_references: allRefs.refs.slice(0, 5) }
        : {}),
    });
  }

  // Proof turunan graph hanya saat walk tx lengkap. Saat incomplete, angkanya
  // lower bound — menerbitkannya sebagai fakta akan menyesatkan (Spec 04).
  if (graph && graph.complete) {
    const uniqueRefs = txRefs(
      graph.relationships.flatMap((r) => r.txHashes).slice(0, 5),
    );
    proofs.push({
      type: "unique_counterparty",
      source: SOURCE,
      subject: address,
      value: { uniqueCounterparties: graph.uniqueCounterparties },
      timestamp: observedAt,
      confidence: THRESHOLDS.proof.confidenceByMethod.derived,
      verification_method: "derived",
      evidence_reference: uniqueRefs.ref,
      ...(uniqueRefs.refs.length > 0 ? { evidence_references: uniqueRefs.refs } : {}),
    });

    const repeatRefs = txRefs(
      graph.relationships
        .filter((r) => r.interactionCount >= THRESHOLDS.trustGraph.repeatInteractionMin)
        .flatMap((r) => r.txHashes)
        .slice(0, 5),
    );
    proofs.push({
      type: "repeat_counterparty",
      source: SOURCE,
      subject: address,
      value: {
        repeatCounterparties: graph.repeatCounterparties,
        minInteractions: THRESHOLDS.trustGraph.repeatInteractionMin,
      },
      timestamp: observedAt,
      confidence: THRESHOLDS.proof.confidenceByMethod.derived,
      verification_method: "derived",
      evidence_reference: repeatRefs.ref,
      ...(repeatRefs.refs.length > 0 ? { evidence_references: repeatRefs.refs } : {}),
    });

    // Semantic: native transfer langsung saja (dari wallet_relationships).
    // Contract-creation di-skip oleh derivasi, jadi nilai deploy tidak dihitung.
    let nativeSent = ZERO;
    let nativeReceived = ZERO;
    let contractCounterparties = 0;
    for (const rel of graph.relationships) {
      nativeSent += rel.valueSent;
      nativeReceived += rel.valueReceived;
      if (rel.isContract) contractCounterparties += 1;
    }

    const economicRefs = txRefs(
      graph.relationships.flatMap((r) => r.txHashes).slice(0, 5),
    );
    proofs.push({
      type: "economic_history",
      source: SOURCE,
      subject: address,
      value: {
        nativeSentWei: nativeSent.toString(),
        nativeReceivedWei: nativeReceived.toString(),
      },
      timestamp: observedAt,
      confidence: THRESHOLDS.proof.confidenceByMethod.derived,
      verification_method: "derived",
      evidence_reference: economicRefs.ref,
      ...(economicRefs.refs.length > 0 ? { evidence_references: economicRefs.refs } : {}),
    });

    // contract_history = counterparties yang benar-benar contract (dari
    // `is_contract` Blockscout). Ini menyimpang sengaja dari `protocol_history`
    // di Spec 00/02: kita punya bukti contract, bukan identitas protocol. Proof
    // `protocol_history` sejati menunggu mapping contract→protocol terverifikasi.
    const contractRefs = txRefs(
      graph.relationships
        .filter((r) => r.isContract)
        .flatMap((r) => r.txHashes)
        .slice(0, 5),
    );
    proofs.push({
      type: "contract_history",
      source: SOURCE,
      subject: address,
      value: { contractCounterparties },
      timestamp: observedAt,
      confidence: THRESHOLDS.proof.confidenceByMethod.derived,
      verification_method: "derived",
      evidence_reference: contractRefs.ref,
      ...(contractRefs.refs.length > 0
        ? { evidence_references: contractRefs.refs }
        : {}),
    });

    // protocol_history sejati (Fase 2): satu proof per mapping verified.
    // Tanpa mapping: proof tidak diterbitkan (not_evaluable) — contract
    // tetap diwakili contract_history di atas, bukan protocol karangan.
    // official = diambil apa adanya dari sumber otoritatif (indexed);
    // curated/verified_external = interpretasi Fathom (derived).
    for (const protocol of protocols) {
      const protocolTxRefs = graph.relationships
        .filter((r) => r.protocolId === protocol.protocolId)
        .flatMap((r) => r.txHashes)
        .slice(0, 5)
        .map(explorerTransactionUrl);
      proofs.push({
        type: "protocol_history",
        source: protocol.source,
        subject: address,
        value: {
          protocolId: protocol.protocolId,
          protocolName: protocol.protocolName,
          contractAddress: protocol.contractAddress,
          source: protocol.source,
          verificationStatus: protocol.verificationStatus,
        },
        timestamp: observedAt,
        confidence:
          protocol.source === "official"
            ? THRESHOLDS.proof.confidenceByMethod.indexed
            : THRESHOLDS.proof.confidenceByMethod.derived,
        verification_method:
          protocol.source === "official" ? "indexed" : "derived",
        evidence_reference:
          protocolTxRefs[0] ??
          protocol.sourceUrl ??
          explorerAddressUrl(protocol.contractAddress),
        ...(protocolTxRefs.length > 0
          ? { evidence_references: protocolTxRefs }
          : {}),
      });
    }
  }

  // Satu proof per attestation: tiap attestation berdiri sendiri dan punya
  // tanda tangan sendiri, jadi paling bisa diperiksa satu per satu (Spec 07).
  // Baris on-chain (Fase 7) menunjuk ke tx registry sebagai evidence_reference.
  for (const attestation of attestations) {
    const onchain = attestation.onchainIdentity;
    proofs.push({
      type: "role_attestation",
      source: ATTESTATION_SOURCE,
      subject: address,
      value: {
        role: attestation.role,
        relationship: attestation.relationship,
        durationMonths: attestation.durationMonths,
        attester: attestation.attester,
        ...(onchain ? { registryId: onchain.registryId } : {}),
      },
      timestamp: attestation.createdAt.toISOString(),
      confidence: THRESHOLDS.proof.confidenceByMethod.indexed,
      verification_method: "indexed",
      evidence_reference: onchain
        ? explorerTransactionUrl(onchain.txHash)
        : attestationEvidenceReference(address),
    });
  }

  return proofs;
}
