import { and, eq, inArray, max } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { protocols } from "@/lib/db/schema";
import { normalizeAddress } from "@/lib/chain/address";
import type { Address } from "@/lib/score/types";

/**
 * Lapisan identitas protocol milik Fathom (Fase 2, PRD §15): pemetaan
 * `chainId + contractAddress → protocol` yang bisa diaudit.
 *
 * Aturan keras (locked):
 * - TIDAK menyimpulkan protocol dari nama kontrak, label explorer, atau TVL.
 * - Hanya record `verified` yang boleh dipakai proof/graph. `unverified`
 *   adalah jejak audit, bukan otoritas.
 * - Mapping ambigu (satu kontrak diklaim dua protocol verified berbeda) =
 *   tidak dipakai, bukan dipilih diam-diam.
 * - Tanpa mapping verified: `protocol_history` tidak diterbitkan
 *   (not_evaluable), dan node tetap Contract — bukan Protocol karangan.
 *
 * Sumber eksplisit:
 * - "official": diterbitkan tim protocol sendiri (wajib sourceUrl).
 * - "curated": kurasi Fathom (sourceUrl opsional).
 * - "verified_external": pemetaan eksternal yang sudah diverifikasi
 *   (wajib sourceUrl).
 */

export type ProtocolSource = "official" | "curated" | "verified_external";
export type ProtocolVerificationStatus = "unverified" | "verified";

const SOURCES: readonly ProtocolSource[] = [
  "official",
  "curated",
  "verified_external",
];

export interface ProtocolIdentity {
  protocolId: string;
  protocolName: string;
  chainId: number;
  contractAddress: Address;
  source: ProtocolSource;
  sourceUrl: string | null;
  verificationStatus: ProtocolVerificationStatus;
  verifiedAt: Date | null;
}

export interface ProtocolMappingInput {
  chainId: number;
  contractAddress: string;
  protocolId: string;
  protocolName: string;
  source: ProtocolSource;
  sourceUrl?: string | null;
  verificationStatus?: ProtocolVerificationStatus;
  verifiedAt?: Date | null;
}

interface ProtocolRow {
  protocolId: string;
  protocolName: string;
  chainId: number;
  contractAddress: string;
  source: string;
  sourceUrl: string | null;
  verificationStatus: string;
  verifiedAt: Date | null;
}

function toIdentity(row: ProtocolRow): ProtocolIdentity {
  return {
    protocolId: row.protocolId,
    protocolName: row.protocolName,
    chainId: row.chainId,
    contractAddress: row.contractAddress as Address,
    source: row.source as ProtocolSource,
    sourceUrl: row.sourceUrl,
    verificationStatus: row.verificationStatus as ProtocolVerificationStatus,
    verifiedAt: row.verifiedAt,
  };
}

function pickVerified(rows: ProtocolRow[]): ProtocolIdentity | null {
  const verified = rows.filter((r) => r.verificationStatus === "verified");
  if (verified.length === 0) return null;
  // Satu kontrak, dua protocol verified berbeda = konflik yang belum
  // terselesaikan — kembalikan null, jangan menebak.
  const ids = new Set(verified.map((r) => r.protocolId));
  if (ids.size !== 1) return null;
  return toIdentity(verified[0]);
}

/**
 * Baca satu mapping verified untuk kontrak. Null = tidak ada mapping
 * verified (atau konflik) — pemanggil harus memperlakukan sebagai
 * not_evaluable, bukan sebagai "bukan protocol apa-apa".
 * Kegagalan DB → null (degradasi: node tetap Contract, proof dilewati).
 */
export async function resolveProtocol(
  chainId: number,
  contractAddress: Address,
): Promise<ProtocolIdentity | null> {
  try {
    const rows = await db
      .select({
        protocolId: protocols.protocolId,
        protocolName: protocols.protocolName,
        chainId: protocols.chainId,
        contractAddress: protocols.contractAddress,
        source: protocols.source,
        sourceUrl: protocols.sourceUrl,
        verificationStatus: protocols.verificationStatus,
        verifiedAt: protocols.verifiedAt,
      })
      .from(protocols)
      .where(
        and(
          eq(protocols.chainId, chainId),
          eq(protocols.contractAddress, normalizeAddress(contractAddress)),
        ),
      );
    return pickVerified(rows);
  } catch {
    return null;
  }
}

/**
 * Batch untuk trust graph: satu query untuk banyak kontrak.
 * Key map = contract address (lowercase, sesuai normalizeAddress).
 */
export async function resolveProtocols(
  chainId: number,
  contractAddresses: Address[],
): Promise<Map<string, ProtocolIdentity>> {
  const out = new Map<string, ProtocolIdentity>();
  const targets = [
    ...new Set(
      contractAddresses.map((a) => {
        try {
          return normalizeAddress(a);
        } catch {
          return null;
        }
      }),
    ),
  ].filter((a): a is Address => a !== null);
  if (targets.length === 0) return out;
  try {
    const rows = await db
      .select({
        protocolId: protocols.protocolId,
        protocolName: protocols.protocolName,
        chainId: protocols.chainId,
        contractAddress: protocols.contractAddress,
        source: protocols.source,
        sourceUrl: protocols.sourceUrl,
        verificationStatus: protocols.verificationStatus,
        verifiedAt: protocols.verifiedAt,
      })
      .from(protocols)
      .where(
        and(
          eq(protocols.chainId, chainId),
          inArray(protocols.contractAddress, targets),
        ),
      );
    const byAddress = new Map<string, ProtocolRow[]>();
    for (const row of rows) {
      const key = row.contractAddress.toLowerCase();
      const list = byAddress.get(key) ?? [];
      list.push(row);
      byAddress.set(key, list);
    }
    for (const [address, list] of byAddress) {
      const identity = pickVerified(list);
      if (identity) out.set(address, identity);
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Write path kurasi (dipakai skrip/admin berikutnya — bukan seed otomatis).
 * Validasi: chainId integer positif, address EVM valid, source dikenal,
 * official/verified_external wajib sourceUrl, verified wajib/harus
 * konsisten dengan verifiedAt.
 */
export async function upsertMapping(input: ProtocolMappingInput): Promise<void> {
  if (!Number.isInteger(input.chainId) || input.chainId <= 0) {
    throw new Error("invalid_chain_id");
  }
  let contractAddress: Address;
  try {
    contractAddress = normalizeAddress(input.contractAddress);
  } catch {
    throw new Error("invalid_contract_address");
  }
  if (!SOURCES.includes(input.source)) {
    throw new Error("invalid_source");
  }
  const protocolId = input.protocolId.trim();
  const protocolName = input.protocolName.trim();
  if (protocolId.length === 0 || protocolId.length > 64) {
    throw new Error("invalid_protocol_id");
  }
  if (protocolName.length === 0 || protocolName.length > 128) {
    throw new Error("invalid_protocol_name");
  }
  const sourceUrl = input.sourceUrl?.trim() || null;
  if (
    (input.source === "official" || input.source === "verified_external") &&
    !sourceUrl
  ) {
    throw new Error("source_url_required");
  }
  const verificationStatus = input.verificationStatus ?? "unverified";
  if (verificationStatus !== "unverified" && verificationStatus !== "verified") {
    throw new Error("invalid_verification_status");
  }
  const verifiedAt =
    verificationStatus === "verified"
      ? (input.verifiedAt ?? new Date())
      : null;

  await db
    .insert(protocols)
    .values({
      chainId: input.chainId,
      contractAddress,
      protocolId,
      protocolName,
      source: input.source,
      sourceUrl,
      verificationStatus,
      verifiedAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        protocols.chainId,
        protocols.contractAddress,
        protocols.source,
      ],
      set: {
        protocolId,
        protocolName,
        sourceUrl,
        verificationStatus,
        verifiedAt,
        updatedAt: new Date(),
      },
    });
}

/**
 * Watermark global mapping protocol (max updated_at) untuk snapshot Proof.
 * Null = belum ada mapping sama sekali atau baca gagal — snapshot lama
 * dengan stamp null tetap dianggap current (equality), regenerasi terjadi
 * saat mapping pertama ditulis.
 */
export async function protocolsStamp(): Promise<Date | null> {
  try {
    const [row] = await db
      .select({ stamp: max(protocols.updatedAt) })
      .from(protocols);
    return row?.stamp ?? null;
  } catch {
    return null;
  }
}
