import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { attestations, disputes, wallets } from "@/lib/db/schema";
import { onchainStats } from "@/lib/chain/onchain-stats";
import { trustGraph, type TrustGraphSummary } from "@/lib/chain/trust-graph";
import { generateProofs, type Proof } from "@/lib/score/proofs";
import {
  readProofs,
  writeProofs,
  type ProofMarkers,
} from "@/lib/score/proof-store";
import { assessRisk, type RiskSignal, type RiskState } from "@/lib/score/risk";
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
  message: string;
  signature: string;
  createdAt: string;
}

/** Dispute publik (Spec 09) — report, bukan bukti wrongdoing. message+signature ikut supaya bisa diverifikasi ulang. */
export interface DisputeView {
  id: number;
  reporter: Address;
  reason: string;
  evidence: string;
  message: string;
  signature: string;
  status: string;
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
  proofs: Proof[];
  dimensions: DimensionState[];
  riskSignals: RiskSignal[];
  riskStates: RiskState[];
  trustGraph: TrustGraphSummary;
  attestations: AttestationView[];
  disputes: DisputeView[];
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

  const attestationRows = await db
    .select({
      id: attestations.id,
      attester: attestations.attesterAddress,
      role: attestations.role,
      relationship: attestations.relationship,
      durationMonths: attestations.durationMonths,
      message: attestations.message,
      signature: attestations.signature,
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
    createdAt: row.createdAt,
  }));

  // Watermark snapshot Proof: ketiga marker harus sama dengan indexed state
  // live agar baris persisted dianggap current (PRD §26, equality-based).
  const markers: ProofMarkers = {
    statsFetchedAt: stats.fetchedAt,
    graphFetchedAt: graph.fetchedAt,
    attestationsStamp:
      attestationRows.length === 0
        ? null
        : new Date(
            Math.max(...attestationRows.map((r) => r.createdAt.getTime())),
          ),
  };

  let proofs = await readProofs(address, markers);
  if (!proofs) {
    proofs = generateProofs(address, stats, graph, attestationInputs, new Date());
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
  // bukan kalkulasi kedua atas reputasi (Spec 11 §Boundary).
  const risk = assessRisk(address, stats, graph, new Date());
  const riskEvaluable = risk.states.some((state) => state.status !== "not_evaluable");

  const disputeRows = await db
    .select({
      id: disputes.id,
      reporter: disputes.reporterAddress,
      reason: disputes.reason,
      evidence: disputes.evidence,
      message: disputes.message,
      signature: disputes.signature,
      status: disputes.status,
      openedAt: disputes.openedAt,
    })
    .from(disputes)
    .where(eq(disputes.targetAddress, address))
    .orderBy(desc(disputes.openedAt));

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
    proofs,
    // Profile tetap evidence-first: Reputation Score (Spec 03) sengaja ditunda
    // sampai input scoring konkret — belum ada kalkulasi skor di sini.
    dimensions: getDimensions(proofs, riskEvaluable),
    riskSignals: risk.signals,
    riskStates: risk.states,
    trustGraph: graph,
    attestations: attestationRows.map((row) => ({
      id: row.id,
      attester: row.attester as Address,
      role: row.role,
      relationship: row.relationship,
      durationMonths: row.durationMonths,
      message: row.message,
      signature: row.signature,
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
      openedAt: row.openedAt.toISOString(),
    })),
  };
}
