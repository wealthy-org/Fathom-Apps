import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { attestations, proofs } from "@/lib/db/schema";
import type { Proof } from "@/lib/score/proofs";
import type { Address } from "@/lib/score/types";

/**
 * Persisted Proof snapshot (PRD §26). Satu-satunya pembaca/penulis tabel
 * `proofs` — UI/API tidak pernah menyentuh tabel ini langsung.
 *
 * Kontrak:
 * - Baris adalah snapshot hasil `generateProofs()` atas indexed state yang
 *   ditandai empat watermark. Bukan derivasi kedua.
 * - Snapshot current hanya bila keempat watermark sama dengan marker live
 *   (equality, bukan recency).
 * - `timestamp` hasil baca = "observed at persist": untuk proof on-chain itu
 *   `updated_at` baris; untuk `role_attestation` itu `createdAt` attestation
 *   asal (di-join, bukan diduplikasi).
 */

export interface ProofMarkers {
  statsFetchedAt: Date | null;
  graphFetchedAt: Date | null;
  attestationsStamp: Date | null;
  protocolsStamp: Date | null;
}

function sameInstant(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.getTime() === b.getTime();
}

interface ProofRow {
  proofType: string;
  source: string;
  value: unknown;
  confidence: string;
  verificationMethod: string;
  evidenceReference: string;
  evidenceReferences: unknown;
  attestationId: number | null;
  statsFetchedAt: Date | null;
  graphFetchedAt: Date | null;
  attestationsStamp: Date | null;
  protocolsStamp: Date | null;
  updatedAt: Date;
  attestationCreatedAt: Date | null;
}

function toProof(row: ProofRow): Proof {
  return {
    type: row.proofType as Proof["type"],
    source: row.source,
    // subject diisi pemanggil (semua baris milik satu subject).
    subject: "" as Address,
    value: row.value,
    timestamp: (row.attestationId !== null && row.attestationCreatedAt
      ? row.attestationCreatedAt
      : row.updatedAt
    ).toISOString(),
    confidence: Number(row.confidence),
    verification_method: row.verificationMethod as Proof["verification_method"],
    evidence_reference: row.evidenceReference,
    ...(row.evidenceReferences == null
      ? {}
      : { evidence_references: row.evidenceReferences as string[] }),
  };
}

/**
 * Baca snapshot Proof subject. Mengembalikan null bila tidak ada baris atau
 * watermark tidak sama dengan marker live — pemanggil lalu regenerasi.
 */
export async function readProofs(
  address: Address,
  markers: ProofMarkers,
): Promise<Proof[] | null> {
  const rows = await db
    .select({
      proofType: proofs.proofType,
      source: proofs.source,
      value: proofs.value,
      confidence: proofs.confidence,
      verificationMethod: proofs.verificationMethod,
      evidenceReference: proofs.evidenceReference,
      evidenceReferences: proofs.evidenceReferences,
      attestationId: proofs.attestationId,
      statsFetchedAt: proofs.statsFetchedAt,
      graphFetchedAt: proofs.graphFetchedAt,
      attestationsStamp: proofs.attestationsStamp,
      protocolsStamp: proofs.protocolsStamp,
      updatedAt: proofs.updatedAt,
      attestationCreatedAt: attestations.createdAt,
    })
    .from(proofs)
    .leftJoin(attestations, eq(attestations.id, proofs.attestationId))
    .where(eq(proofs.walletAddress, address));

  if (rows.length === 0) return null;
  const head = rows[0];
  if (!sameInstant(head.statsFetchedAt, markers.statsFetchedAt)) return null;
  if (!sameInstant(head.graphFetchedAt, markers.graphFetchedAt)) return null;
  if (!sameInstant(head.attestationsStamp, markers.attestationsStamp)) {
    return null;
  }
  if (!sameInstant(head.protocolsStamp, markers.protocolsStamp)) return null;
  return rows.map((row) => ({ ...toProof(row), subject: address }));
}

/**
 * Ganti snapshot Proof subject dengan hasil `generateProofs()` yang baru.
 * `attestationIdFor` memetakan tiap `role_attestation` ke baris attestation
 * asalnya (pemanggil mencocokkan via constraint unik attester+subject+role).
 */
export async function writeProofs(
  address: Address,
  fresh: Proof[],
  markers: ProofMarkers,
  attestationIdFor: (proof: Proof) => number | null,
): Promise<void> {
  // Snapshot utuh diganti atomik dalam satu transaksi; kegagalan rollback
  // penuh sehingga baca berikutnya menganggap tidak ada snapshot (null)
  // lalu regenerasi — tidak pernah menyajikan setengah snapshot sebagai current.
  await db.transaction(async (tx) => {
    await tx.delete(proofs).where(eq(proofs.walletAddress, address));
    if (fresh.length === 0) return;
    await tx.insert(proofs).values(
      fresh.map((proof) => ({
        walletAddress: address,
        proofType: proof.type,
        source: proof.source,
        value: proof.value,
        // numeric insert butuh string; baca kembali via Number() di toProof.
        confidence: proof.confidence.toString(),
        verificationMethod: proof.verification_method,
        evidenceReference: proof.evidence_reference,
        evidenceReferences: proof.evidence_references ?? null,
        attestationId: attestationIdFor(proof),
        statsFetchedAt: markers.statsFetchedAt,
        graphFetchedAt: markers.graphFetchedAt,
        attestationsStamp: markers.attestationsStamp,
        protocolsStamp: markers.protocolsStamp,
      })),
    );
  });
}
