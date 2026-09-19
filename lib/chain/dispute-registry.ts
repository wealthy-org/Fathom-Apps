import {
  createPublicClient,
  decodeEventLog,
  http,
  isAddress,
  parseAbiItem,
  type Log,
} from "viem";
import { and, eq } from "drizzle-orm";
import { disputes, indexerState, wallets } from "@/lib/db/schema";
import { normalizeAddress } from "@/lib/chain/address";
import {
  ROBINHOOD_TESTNET_CHAIN_ID,
  robinhoodTestnet,
} from "@/lib/wallet/chains";
import type { Address } from "@/lib/score/types";

/**
 * Indexer event FathomDisputeRegistry (Spec 09) → tabel `disputes`.
 *
 * Lifecycle on-chain: open → disputed → upheld | dismissed. Mapping jujur:
 * DisputeOpened→insert (status "open"), DisputeDisputed/Upheld/Dismissed→
 * update status baris identitas itu. Event chain otoritatif untuk status;
 * tidak ada inferensi dari UI. Report != vonis: registry mencatat klaim.
 * Event = evidence; indexer tidak menilai, tidak memberi skor.
 */

export const DISPUTE_REGISTRY_CONTRACT_NAME = "FathomDisputeRegistry";
export const DISPUTE_REGISTRY_CHAIN_ID = ROBINHOOD_TESTNET_CHAIN_ID;

const DisputeOpenedAbi = parseAbiItem(
  "event DisputeOpened(uint256 indexed disputeId, address indexed reporter, address indexed target, bytes32 reasonHash, bytes32 evidenceRef)",
);
const DisputeDisputedAbi = parseAbiItem(
  "event DisputeDisputed(uint256 indexed disputeId, address indexed reporter, address indexed target)",
);
const DisputeUpheldAbi = parseAbiItem(
  "event DisputeUpheld(uint256 indexed disputeId, address indexed reporter, address indexed target)",
);
const DisputeDismissedAbi = parseAbiItem(
  "event DisputeDismissed(uint256 indexed disputeId, address indexed reporter, address indexed target)",
);
const REGISTRY_ABI = [
  DisputeOpenedAbi,
  DisputeDisputedAbi,
  DisputeUpheldAbi,
  DisputeDismissedAbi,
] as const;

type RegistryEventKind =
  | "DisputeOpened"
  | "DisputeDisputed"
  | "DisputeUpheld"
  | "DisputeDismissed";

export type DisputeLifecycleStatus = "open" | "disputed" | "upheld" | "dismissed";

/** Lifecycle jujur sesuai event kontrak — event chain otoritatif. */
export function statusForEvent(kind: RegistryEventKind): DisputeLifecycleStatus {
  switch (kind) {
    case "DisputeOpened":
      return "open";
    case "DisputeDisputed":
      return "disputed";
    case "DisputeUpheld":
      return "upheld";
    case "DisputeDismissed":
      return "dismissed";
  }
}

export interface DecodedDisputeEvent {
  kind: RegistryEventKind;
  disputeId: bigint;
  reporter: Address;
  target: Address;
  reasonHash: string | null;
  evidenceRef: string | null;
  txHash: string;
  logIndex: number;
  blockNumber: number;
}

/**
 * Alamat registry hanya dari env — tidak pernah dikarang.
 * Null = belum dikonfigurasi (indexer menolak jalan, bukan menebak).
 */
export function getDisputeRegistryAddress(): Address | null {
  const raw = process.env.FATHOM_DISPUTE_REGISTRY_ADDRESS;
  if (!raw || !isAddress(raw)) return null;
  return normalizeAddress(raw);
}

/**
 * Decode log mentah → event registry. Pure (tanpa I/O) supaya bisa diuji
 * dengan fixture. Log cacat dilewati dan dihitung sebagai malformed —
 * bukan gagal run.
 */
export function decodeDisputeLogs(logs: Log[]): {
  events: DecodedDisputeEvent[];
  malformed: number;
} {
  const events: DecodedDisputeEvent[] = [];
  let malformed = 0;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: REGISTRY_ABI, ...log });
      if (
        decoded.eventName !== "DisputeOpened" &&
        decoded.eventName !== "DisputeDisputed" &&
        decoded.eventName !== "DisputeUpheld" &&
        decoded.eventName !== "DisputeDismissed"
      ) {
        malformed += 1;
        continue;
      }
      const args = decoded.args as {
        disputeId?: bigint;
        reporter?: string;
        target?: string;
        reasonHash?: string;
        evidenceRef?: string;
      };
      if (
        typeof args.disputeId !== "bigint" ||
        typeof args.reporter !== "string" ||
        typeof args.target !== "string"
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
      let reasonHash: string | null = null;
      let evidenceRef: string | null = null;
      if (decoded.eventName === "DisputeOpened") {
        if (
          typeof args.reasonHash !== "string" ||
          typeof args.evidenceRef !== "string"
        ) {
          malformed += 1;
          continue;
        }
        reasonHash = args.reasonHash;
        evidenceRef = args.evidenceRef;
      }
      events.push({
        kind: decoded.eventName,
        disputeId: args.disputeId,
        reporter: normalizeAddress(args.reporter),
        target: normalizeAddress(args.target),
        reasonHash,
        evidenceRef,
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

export interface DisputeIndexState {
  lastBlock: number;
  status: string | null;
  error: string | null;
  lastIndexedAt: Date | null;
}

/**
 * Store minimal di balik indexer — produksi (drizzle) vs memori (check).
 * Idempotency: insert idempoten via constraint unik on-chain identity;
 * update status idempoten (baris tak ada = duplikat/no-op, bukan error).
 */
export interface DisputeEventStore {
  ensureWallets(addresses: Address[]): Promise<void>;
  insertDispute(row: {
    reporterAddress: Address;
    targetAddress: Address;
    reasonHash: string;
    evidenceRef: string;
    registryId: string;
    chainId: number;
    txHash: string;
    blockNumber: number;
    logIndex: number;
    openedAt: Date;
  }): Promise<boolean>;
  updateDisputeStatus(
    registryId: string,
    chainId: number,
    status: DisputeLifecycleStatus,
    resolvedAt: Date | null,
  ): Promise<boolean>;
  readState(): Promise<DisputeIndexState | null>;
  writeState(state: DisputeIndexState): Promise<void>;
}

export const drizzleDisputeEventStore: DisputeEventStore = {
  async ensureWallets(addresses) {
    const { db } = await import("@/lib/db/client");
    for (const address of addresses) {
      await db.insert(wallets).values({ address }).onConflictDoNothing();
    }
  },
  async insertDispute(row) {
    const { db } = await import("@/lib/db/client");
    const inserted = await db
      .insert(disputes)
      .values({
        ...row,
        reason: null,
        evidence: null,
        message: null,
        signature: null,
        status: "open",
      })
      .onConflictDoNothing()
      .returning({ id: disputes.id });
    return inserted.length > 0;
  },
  async updateDisputeStatus(registryId, chainId, status, resolvedAt) {
    const { db } = await import("@/lib/db/client");
    const updated = await db
      .update(disputes)
      .set({
        status,
        resolvedAt,
        resolutionNote: null,
      })
      .where(
        and(
          eq(disputes.registryId, registryId),
          eq(disputes.chainId, chainId),
        ),
      )
      .returning({ id: disputes.id });
    return updated.length > 0;
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
          eq(indexerState.contractName, DISPUTE_REGISTRY_CONTRACT_NAME),
          eq(indexerState.chainId, DISPUTE_REGISTRY_CHAIN_ID),
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
        contractName: DISPUTE_REGISTRY_CONTRACT_NAME,
        chainId: DISPUTE_REGISTRY_CHAIN_ID,
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

export interface DisputeIndexSummary {
  ok: boolean;
  fromBlock: bigint;
  toBlock: bigint;
  indexed: number;
  transitions: number;
  duplicates: number;
  malformed: number;
  error: string | null;
}

/**
 * Tulis event ter-decode ke store. Pure orchestration (I/O hanya via store)
 * supaya idempotency bisa diuji tanpa DB. Urutan deterministik:
 * (blockNumber, logIndex) — transisi diproses setelah open yang sama.
 */
export async function applyDecodedDisputes(
  store: DisputeEventStore,
  events: DecodedDisputeEvent[],
  at: Date,
): Promise<{ indexed: number; transitions: number; duplicates: number }> {
  const ordered = [...events].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
  );
  const parties = new Set<Address>();
  for (const e of ordered) {
    parties.add(e.reporter);
    parties.add(e.target);
  }
  // FK disputes → wallets: pastikan kedua sisi ada dulu (idempoten).
  await store.ensureWallets([...parties]);
  let indexed = 0;
  let transitions = 0;
  let duplicates = 0;
  for (const e of ordered) {
    if (e.kind === "DisputeOpened") {
      // Opened selalu membawa reasonHash/evidenceRef (dijamin decode).
      const inserted = await store.insertDispute({
        reporterAddress: e.reporter,
        targetAddress: e.target,
        reasonHash: e.reasonHash ?? "",
        evidenceRef: e.evidenceRef ?? "",
        registryId: e.disputeId.toString(),
        chainId: DISPUTE_REGISTRY_CHAIN_ID,
        txHash: e.txHash,
        blockNumber: e.blockNumber,
        logIndex: e.logIndex,
        openedAt: at,
      });
      if (inserted) indexed += 1;
      else duplicates += 1;
      continue;
    }
    const status = statusForEvent(e.kind);
    const changed = await store.updateDisputeStatus(
      e.disputeId.toString(),
      DISPUTE_REGISTRY_CHAIN_ID,
      status,
      status === "open" || status === "disputed" ? null : at,
    );
    if (changed) transitions += 1;
    else duplicates += 1;
  }
  return { indexed, transitions, duplicates };
}

/**
 * Index inkremental rentang [fromBlock, toBlock] dari registry terkonfigurasi.
 * Deterministik dan callable ulang: lanjut dari indexer_state.lastBlock,
 * event yang sudah ada dilewati via constraint unik. Tanpa scheduler —
 * pemanggil (route/cron manual) yang memutuskan kapan jalan.
 */
export async function indexDisputeRegistry(options?: {
  fromBlock?: bigint;
  toBlock?: bigint;
  store?: DisputeEventStore;
}): Promise<DisputeIndexSummary> {
  const store = options?.store ?? drizzleDisputeEventStore;
  const registry = getDisputeRegistryAddress();
  if (!registry) {
    throw new Error(
      "FATHOM_DISPUTE_REGISTRY_ADDRESS is not set or not a valid address — refusing to index without a configured contract.",
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
    transitions: 0,
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
    const [openedLogs, disputedLogs, upheldLogs, dismissedLogs] =
      await Promise.all([
        client.getLogs({
          address: registry,
          event: DisputeOpenedAbi,
          fromBlock,
          toBlock,
        }),
        client.getLogs({
          address: registry,
          event: DisputeDisputedAbi,
          fromBlock,
          toBlock,
        }),
        client.getLogs({
          address: registry,
          event: DisputeUpheldAbi,
          fromBlock,
          toBlock,
        }),
        client.getLogs({
          address: registry,
          event: DisputeDismissedAbi,
          fromBlock,
          toBlock,
        }),
      ]);
    const { events, malformed } = decodeDisputeLogs([
      ...openedLogs,
      ...disputedLogs,
      ...upheldLogs,
      ...dismissedLogs,
    ]);
    // Timestamp = blok asal event (bukti), bukan waktu index.
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
      parties.add(e.reporter);
      parties.add(e.target);
    }
    await store.ensureWallets([...parties]);
    let indexed = 0;
    let transitions = 0;
    let duplicates = 0;
    for (const e of ordered) {
      const r = await applyDecodedDisputes(
        store,
        [e],
        blockTimes.get(e.blockNumber) ?? new Date(),
      );
      indexed += r.indexed;
      transitions += r.transitions;
      duplicates += r.duplicates;
    }
    await store.writeState({
      lastBlock: Number(toBlock),
      status: "ok",
      error: null,
      lastIndexedAt: new Date(),
    });
    return { ...empty, toBlock, indexed, transitions, duplicates, malformed, ok: true, error: null };
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
 * bedakan dari confirmed-zero (sudah jalan, tabel disputes on-chain kosong).
 */
export async function readDisputeIndexState(
  store: DisputeEventStore = drizzleDisputeEventStore,
): Promise<DisputeIndexState | null> {
  return store.readState();
}
