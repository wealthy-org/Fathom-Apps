import {
  createPublicClient,
  decodeEventLog,
  http,
  isAddress,
  parseAbiItem,
  type Log,
} from "viem";
import { and, eq } from "drizzle-orm";
import { attestations, indexerState, wallets } from "@/lib/db/schema";
import { normalizeAddress } from "@/lib/chain/address";
import {
  ROBINHOOD_TESTNET_CHAIN_ID,
  robinhoodTestnet,
} from "@/lib/wallet/chains";
import type { Address } from "@/lib/score/types";

/**
 * Indexer event FathomAttestationRegistry (Spec 07) → tabel `attestations`.
 *
 * Kontrak hanya meng-emit AttestationCreated + AttestationRevoked.
 * Mapping jujur: Created→insert baris (message/signature null — event
 * on-chain tidak membawa payload SIWE), Revoked→hapus baris identitas itu.
 * Role/relationship on-chain tak berbatas; yang melebihi varchar read model
 * (32/64) tidak diindeks — dihitung malformed, bukan dipotong diam-diam.
 * Event = evidence; indexer tidak menilai, tidak memberi skor.
 */

export const ATTESTATION_REGISTRY_CONTRACT_NAME = "FathomAttestationRegistry";
export const ATTESTATION_REGISTRY_CHAIN_ID = ROBINHOOD_TESTNET_CHAIN_ID;

// Batas read model — cermin varchar schema attestations.
export const MAX_ROLE_LENGTH = 32;
export const MAX_RELATIONSHIP_LENGTH = 64;

const AttestationCreatedAbi = parseAbiItem(
  "event AttestationCreated(uint256 indexed attestationId, address indexed attester, address indexed subject, string role, string relationship, uint32 durationMonths)",
);
const AttestationRevokedAbi = parseAbiItem(
  "event AttestationRevoked(uint256 indexed attestationId, address indexed attester, address indexed subject)",
);
const REGISTRY_ABI = [AttestationCreatedAbi, AttestationRevokedAbi] as const;

type RegistryEventKind = "AttestationCreated" | "AttestationRevoked";

export interface DecodedAttestationEvent {
  kind: RegistryEventKind;
  attestationId: bigint;
  attester: Address;
  subject: Address;
  role: string | null;
  relationship: string | null;
  durationMonths: number | null;
  txHash: string;
  logIndex: number;
  blockNumber: number;
}

/**
 * Alamat registry hanya dari env — tidak pernah dikarang.
 * Null = belum dikonfigurasi (indexer menolak jalan, bukan menebak).
 */
export function getAttestationRegistryAddress(): Address | null {
  const raw = process.env.FATHOM_ATTESTATION_REGISTRY_ADDRESS;
  if (!raw || !isAddress(raw)) return null;
  return normalizeAddress(raw);
}

/**
 * Decode log mentah → event registry. Pure (tanpa I/O) supaya bisa diuji
 * dengan fixture. Log cacat dilewati dan dihitung sebagai malformed —
 * bukan gagal run.
 */
export function decodeAttestationLogs(logs: Log[]): {
  events: DecodedAttestationEvent[];
  malformed: number;
} {
  const events: DecodedAttestationEvent[] = [];
  let malformed = 0;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: REGISTRY_ABI, ...log });
      if (
        decoded.eventName !== "AttestationCreated" &&
        decoded.eventName !== "AttestationRevoked"
      ) {
        malformed += 1;
        continue;
      }
      const args = decoded.args as {
        attestationId?: bigint;
        attester?: string;
        subject?: string;
        role?: string;
        relationship?: string;
        durationMonths?: number;
      };
      if (
        typeof args.attestationId !== "bigint" ||
        typeof args.attester !== "string" ||
        typeof args.subject !== "string"
      ) {
        malformed += 1;
        continue;
      }
      if (
        log.transactionHash == null ||
        log.logIndex == null ||
        log.blockNumber == null
      ) {
        malformed += 1;
        continue;
      }
      let role: string | null = null;
      let relationship: string | null = null;
      let durationMonths: number | null = null;
      if (decoded.eventName === "AttestationCreated") {
        if (
          typeof args.role !== "string" ||
          typeof args.relationship !== "string" ||
          typeof args.durationMonths !== "number"
        ) {
          malformed += 1;
          continue;
        }
        // Jangan potong diam-diam: yang tak muat read model = malformed.
        if (
          args.role.length === 0 ||
          args.role.length > MAX_ROLE_LENGTH ||
          args.relationship.length === 0 ||
          args.relationship.length > MAX_RELATIONSHIP_LENGTH ||
          args.durationMonths <= 0
        ) {
          malformed += 1;
          continue;
        }
        role = args.role;
        relationship = args.relationship;
        durationMonths = args.durationMonths;
      }
      events.push({
        kind: decoded.eventName,
        attestationId: args.attestationId,
        attester: normalizeAddress(args.attester),
        subject: normalizeAddress(args.subject),
        role,
        relationship,
        durationMonths,
        txHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber: Number(log.blockNumber),
      });
    } catch {
      malformed += 1;
    }
  }
  return { events, malformed };
}

export interface AttestationIndexState {
  lastBlock: number;
  status: string | null;
  error: string | null;
  lastIndexedAt: Date | null;
}

/**
 * Store minimal di balik indexer — produksi (drizzle) vs memori (check).
 * Idempotency: insert idempoten via constraint unik on-chain identity;
 * revoke idempoten (hapus yang tak ada = no-op). Keduanya mengembalikan
 * apakah baris berubah.
 */
export interface AttestationEventStore {
  ensureWallets(addresses: Address[]): Promise<void>;
  insertAttestation(row: {
    attesterAddress: Address;
    subjectAddress: Address;
    role: string;
    relationship: string;
    durationMonths: number;
    registryId: string;
    chainId: number;
    txHash: string;
    blockNumber: number;
    logIndex: number;
    createdAt: Date;
  }): Promise<boolean>;
  revokeAttestation(registryId: string, chainId: number): Promise<boolean>;
  readState(): Promise<AttestationIndexState | null>;
  writeState(state: AttestationIndexState): Promise<void>;
}

export const drizzleAttestationEventStore: AttestationEventStore = {
  async ensureWallets(addresses) {
    const { db } = await import("@/lib/db/client");
    for (const address of addresses) {
      await db.insert(wallets).values({ address }).onConflictDoNothing();
    }
  },
  async insertAttestation(row) {
    const { db } = await import("@/lib/db/client");
    const inserted = await db
      .insert(attestations)
      .values({ ...row, message: null, signature: null })
      .onConflictDoNothing()
      .returning({ id: attestations.id });
    return inserted.length > 0;
  },
  async revokeAttestation(registryId, chainId) {
    const { db } = await import("@/lib/db/client");
    const deleted = await db
      .delete(attestations)
      .where(
        and(
          eq(attestations.registryId, registryId),
          eq(attestations.chainId, chainId),
        ),
      )
      .returning({ id: attestations.id });
    return deleted.length > 0;
  },
  async readState() {
    const { db } = await import("@/lib/db/client");
    const rows = await db
      .select({
        lastBlock: indexerState.lastBlock,
        status: indexerState.status,
        error: indexerState.error,
        lastIndexedAt: indexerState.lastIndexedAt,
      })
      .from(indexerState)
      .where(
        and(
          eq(indexerState.contractName, ATTESTATION_REGISTRY_CONTRACT_NAME),
          eq(indexerState.chainId, ATTESTATION_REGISTRY_CHAIN_ID),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  },
  async writeState(state) {
    const { db } = await import("@/lib/db/client");
    await db
      .insert(indexerState)
      .values({
        contractName: ATTESTATION_REGISTRY_CONTRACT_NAME,
        chainId: ATTESTATION_REGISTRY_CHAIN_ID,
        lastBlock: state.lastBlock,
        status: state.status,
        error: state.error,
        lastIndexedAt: state.lastIndexedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [indexerState.contractName, indexerState.chainId],
        set: {
          lastBlock: state.lastBlock,
          status: state.status,
          error: state.error,
          lastIndexedAt: state.lastIndexedAt,
          updatedAt: new Date(),
        },
      });
  },
};

export interface AttestationIndexSummary {
  ok: boolean;
  fromBlock: bigint;
  toBlock: bigint;
  indexed: number;
  revoked: number;
  duplicates: number;
  malformed: number;
  error: string | null;
}

/**
 * Tulis event ter-decode ke store. Pure orchestration (I/O hanya via store)
 * supaya idempotency bisa diuji tanpa DB. Urutan deterministik:
 * (blockNumber, logIndex).
 */
export async function applyDecodedAttestations(
  store: AttestationEventStore,
  events: DecodedAttestationEvent[],
  createdAt: Date,
): Promise<{ indexed: number; revoked: number; duplicates: number }> {
  const ordered = [...events].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
  );
  const parties = new Set<Address>();
  for (const e of ordered) {
    parties.add(e.attester);
    parties.add(e.subject);
  }
  // FK attestations → wallets: pastikan kedua sisi ada dulu (idempoten).
  await store.ensureWallets([...parties]);
  let indexed = 0;
  let revoked = 0;
  let duplicates = 0;
  for (const e of ordered) {
    if (e.kind === "AttestationRevoked") {
      const changed = await store.revokeAttestation(
        e.attestationId.toString(),
        ATTESTATION_REGISTRY_CHAIN_ID,
      );
      if (changed) revoked += 1;
      else duplicates += 1;
      continue;
    }
    // Created selalu membawa role/relationship/duration (dijamin decode).
    const inserted = await store.insertAttestation({
      attesterAddress: e.attester,
      subjectAddress: e.subject,
      role: e.role ?? "",
      relationship: e.relationship ?? "",
      durationMonths: e.durationMonths ?? 0,
      registryId: e.attestationId.toString(),
      chainId: ATTESTATION_REGISTRY_CHAIN_ID,
      txHash: e.txHash,
      blockNumber: e.blockNumber,
      logIndex: e.logIndex,
      createdAt,
    });
    if (inserted) indexed += 1;
    else duplicates += 1;
  }
  return { indexed, revoked, duplicates };
}

/**
 * Index inkremental rentang [fromBlock, toBlock] dari registry terkonfigurasi.
 * Deterministik dan callable ulang: lanjut dari indexer_state.lastBlock,
 * event yang sudah ada dilewati via constraint unik. Tanpa scheduler —
 * pemanggil (route/cron manual) yang memutuskan kapan jalan.
 */
export async function indexAttestationRegistry(options?: {
  fromBlock?: bigint;
  toBlock?: bigint;
  store?: AttestationEventStore;
}): Promise<AttestationIndexSummary> {
  const store = options?.store ?? drizzleAttestationEventStore;
  const registry = getAttestationRegistryAddress();
  if (!registry) {
    throw new Error(
      "FATHOM_ATTESTATION_REGISTRY_ADDRESS is not set or not a valid address — refusing to index without a configured contract.",
    );
  }
  const client = createPublicClient({
    chain: robinhoodTestnet,
    transport: http(),
  });
  const prev = await store.readState();
  const fromBlock = options?.fromBlock ?? BigInt(prev?.lastBlock ?? 0);
  let toBlock = options?.toBlock ?? BigInt(0);
  const empty = {
    fromBlock,
    toBlock,
    indexed: 0,
    revoked: 0,
    duplicates: 0,
    malformed: 0,
  };
  try {
    if (options?.toBlock == null) toBlock = await client.getBlockNumber();
    if (toBlock < fromBlock) {
      await store.writeState({
        lastBlock: prev?.lastBlock ?? 0,
        status: "ok",
        error: null,
        lastIndexedAt: new Date(),
      });
      return { ...empty, toBlock, ok: true, error: null };
    }
    const [createdLogs, revokedLogs] = await Promise.all([
      client.getLogs({
        address: registry,
        event: AttestationCreatedAbi,
        fromBlock,
        toBlock,
      }),
      client.getLogs({
        address: registry,
        event: AttestationRevokedAbi,
        fromBlock,
        toBlock,
      }),
    ]);
    const { events, malformed } = decodeAttestationLogs([
      ...createdLogs,
      ...revokedLogs,
    ]);
    // createdAt = timestamp blok asal event (bukti), bukan waktu index.
    // ponytail: satu getBlock per blok distinct; gagal → waktu index sebagai fallback.
    const blockTimes = new Map<number, Date>();
    await Promise.all(
      [...new Set(events.map((e) => e.blockNumber))].map(async (n) => {
        try {
          const block = await client.getBlock({ blockNumber: BigInt(n) });
          blockTimes.set(n, new Date(Number(block.timestamp) * 1000));
        } catch {
          blockTimes.set(n, new Date());
        }
      }),
    );
    const ordered = [...events].sort(
      (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
    );
    const parties = new Set<Address>();
    for (const e of ordered) {
      parties.add(e.attester);
      parties.add(e.subject);
    }
    await store.ensureWallets([...parties]);
    let indexed = 0;
    let revoked = 0;
    let duplicates = 0;
    for (const e of ordered) {
      const r = await applyDecodedAttestations(
        store,
        [e],
        blockTimes.get(e.blockNumber) ?? new Date(),
      );
      indexed += r.indexed;
      revoked += r.revoked;
      duplicates += r.duplicates;
    }
    await store.writeState({
      lastBlock: Number(toBlock),
      status: "ok",
      error: null,
      lastIndexedAt: new Date(),
    });
    return { ...empty, toBlock, indexed, revoked, duplicates, malformed, ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await store.writeState({
      lastBlock: prev?.lastBlock ?? 0,
      status: "error",
      error: message,
      lastIndexedAt: new Date(),
    });
    return { ...empty, toBlock, ok: false, error: message };
  }
}

/**
 * Baca state index registry. Null = indexer belum pernah jalan (no-index) —
 * bedakan dari confirmed-zero (sudah jalan, tabel attestations on-chain kosong).
 */
export async function readAttestationIndexState(
  store: AttestationEventStore = drizzleAttestationEventStore,
): Promise<AttestationIndexState | null> {
  return store.readState();
}
