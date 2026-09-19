import {
  createPublicClient,
  decodeEventLog,
  http,
  isAddress,
  parseAbiItem,
  type Log,
} from "viem";
import { and, eq } from "drizzle-orm";
import { indexerState, vouches, wallets } from "@/lib/db/schema";
import { normalizeAddress } from "@/lib/chain/address";
import {
  ROBINHOOD_TESTNET_CHAIN_ID,
  robinhoodTestnet,
} from "@/lib/wallet/chains";
import type { Address, VouchStatus } from "@/lib/score/types";

/**
 * Indexer event FathomVouchRegistry (Spec 08) → tabel `vouches`.
 *
 * Kontrak hanya meng-emit Vouched + Withdrawn (+ DisputeLockSet/ParamsUpdated
 * yang bukan lifecycle vouch). Mapping jujur: Vouched→active,
 * Withdrawn→withdrawn. Tidak ada event Revoked/Slashed di kontrak — status
 * disputed/slashed datang dari alur Spec 09 nanti, bukan dikarang di sini.
 * Event = evidence; indexer tidak menilai, tidak memberi skor.
 */

export const VOUCH_REGISTRY_CONTRACT_NAME = "FathomVouchRegistry";
export const VOUCH_REGISTRY_CHAIN_ID = ROBINHOOD_TESTNET_CHAIN_ID;

const VouchedAbi = parseAbiItem(
  "event Vouched(address indexed voucher, address indexed target, uint256 stakeAdded, uint256 totalStake, uint64 pairCount)",
);
const WithdrawnAbi = parseAbiItem(
  "event Withdrawn(address indexed voucher, address indexed target, uint256 amount, uint256 remainingStake)",
);
const REGISTRY_ABI = [VouchedAbi, WithdrawnAbi] as const;

type RegistryEventKind = "Vouched" | "Withdrawn";

export interface DecodedRegistryEvent {
  kind: RegistryEventKind;
  voucher: Address;
  target: Address;
  /** stakeAdded (Vouched) atau amount (Withdrawn), wei. */
  amount: bigint;
  txHash: string;
  logIndex: number;
  blockNumber: number;
}

/** Lifecycle jujur sesuai event kontrak. DisputeLockSet tidak menyentuh baris vouches. */
export function statusForEvent(kind: RegistryEventKind): VouchStatus {
  return kind === "Vouched" ? "active" : "withdrawn";
}

/**
 * Alamat registry hanya dari env — tidak pernah dikarang.
 * Null = belum dikonfigurasi (indexer menolak jalan, bukan menebak).
 */
export function getRegistryAddress(): Address | null {
  const raw = process.env.FATHOM_VOUCH_REGISTRY_ADDRESS;
  if (!raw || !isAddress(raw)) return null;
  return normalizeAddress(raw);
}

/**
 * Decode log mentah → event registry. Pure (tanpa I/O) supaya bisa diuji
 * dengan fixture. Log cacat (bukan event registry, address invalid, field
 * chain null) dilewati dan dihitung sebagai malformed — bukan gagal run.
 */
export function decodeRegistryLogs(logs: Log[]): {
  events: DecodedRegistryEvent[];
  malformed: number;
} {
  const events: DecodedRegistryEvent[] = [];
  let malformed = 0;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: REGISTRY_ABI, ...log });
      if (decoded.eventName !== "Vouched" && decoded.eventName !== "Withdrawn") {
        malformed += 1;
        continue;
      }
      const args = decoded.args as {
        voucher: string;
        target: string;
        stakeAdded?: bigint;
        amount?: bigint;
      };
      const amount =
        decoded.eventName === "Vouched" ? args.stakeAdded : args.amount;
      if (typeof amount !== "bigint") {
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
      events.push({
        kind: decoded.eventName,
        voucher: normalizeAddress(args.voucher),
        target: normalizeAddress(args.target),
        amount,
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

export interface VouchIndexState {
  lastBlock: number;
  status: string | null;
  error: string | null;
  lastIndexedAt: Date | null;
}

/**
 * Store minimal di balik indexer — produksi (drizzle) vs memori (check).
 * Idempotency dijamin constraint unik (chain_id, tx_hash, log_index);
 * insertVouch mengembalikan false bila baris sudah ada.
 */
export interface VouchEventStore {
  ensureWallets(addresses: Address[]): Promise<void>;
  insertVouch(row: {
    chainId: number;
    txHash: string;
    logIndex: number;
    blockNumber: number;
    fromAddress: Address;
    toAddress: Address;
    stakeAmount: string;
    status: VouchStatus;
    createdAt: Date;
  }): Promise<boolean>;
  readState(): Promise<VouchIndexState | null>;
  writeState(state: VouchIndexState): Promise<void>;
}

export const drizzleVouchEventStore: VouchEventStore = {
  async ensureWallets(addresses) {
    const { db } = await import("@/lib/db/client");
    for (const address of addresses) {
      await db.insert(wallets).values({ address }).onConflictDoNothing();
    }
  },
  async insertVouch(row) {
    const { db } = await import("@/lib/db/client");
    const inserted = await db
      .insert(vouches)
      .values(row)
      .onConflictDoNothing()
      .returning({ id: vouches.id });
    return inserted.length > 0;
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
          eq(indexerState.contractName, VOUCH_REGISTRY_CONTRACT_NAME),
          eq(indexerState.chainId, VOUCH_REGISTRY_CHAIN_ID),
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
        contractName: VOUCH_REGISTRY_CONTRACT_NAME,
        chainId: VOUCH_REGISTRY_CHAIN_ID,
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

export interface IndexSummary {
  ok: boolean;
  fromBlock: bigint;
  toBlock: bigint;
  indexed: number;
  duplicates: number;
  malformed: number;
  error: string | null;
}

/**
 * Tulis event ter-decode ke store. Pure orchestration (I/O hanya via store)
 * supaya idempotency bisa diuji tanpa DB. Urutan deterministik:
 * (blockNumber, logIndex).
 */
export async function applyDecodedEvents(
  store: VouchEventStore,
  events: DecodedRegistryEvent[],
  createdAt: Date,
): Promise<{ indexed: number; duplicates: number }> {
  const ordered = [...events].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
  );
  const parties = new Set<Address>();
  for (const e of ordered) {
    parties.add(e.voucher);
    parties.add(e.target);
  }
  // FK vouches → wallets: pastikan kedua sisi ada dulu (idempoten).
  await store.ensureWallets([...parties]);
  let indexed = 0;
  let duplicates = 0;
  for (const e of ordered) {
    const inserted = await store.insertVouch({
      chainId: VOUCH_REGISTRY_CHAIN_ID,
      txHash: e.txHash,
      logIndex: e.logIndex,
      blockNumber: e.blockNumber,
      fromAddress: e.voucher,
      toAddress: e.target,
      // numeric(78,0): string desimal, bukan float.
      stakeAmount: e.amount.toString(),
      status: statusForEvent(e.kind),
      createdAt,
    });
    if (inserted) indexed += 1;
    else duplicates += 1;
  }
  return { indexed, duplicates };
}

/**
 * Index inkremental rentang [fromBlock, toBlock] dari registry terkonfigurasi.
 * Deterministik dan callable ulang: lanjut dari indexer_state.lastBlock,
 * event yang sudah ada dilewati via constraint unik. Tanpa scheduler —
 * pemanggil (route/cron manual) yang memutuskan kapan jalan.
 */
export async function indexVouchRegistry(options?: {
  fromBlock?: bigint;
  toBlock?: bigint;
  store?: VouchEventStore;
}): Promise<IndexSummary> {
  const store = options?.store ?? drizzleVouchEventStore;
  const registry = getRegistryAddress();
  if (!registry) {
    throw new Error(
      "FATHOM_VOUCH_REGISTRY_ADDRESS is not set or not a valid address — refusing to index without a configured contract.",
    );
  }
  const client = createPublicClient({
    chain: robinhoodTestnet,
    transport: http(),
  });
  const prev = await store.readState();
  const fromBlock = options?.fromBlock ?? BigInt(prev?.lastBlock ?? 0);
  let toBlock = options?.toBlock ?? BigInt(0);
  try {
    if (options?.toBlock == null) toBlock = await client.getBlockNumber();
    if (toBlock < fromBlock) {
      await store.writeState({
        lastBlock: prev?.lastBlock ?? 0,
        status: "ok",
        error: null,
        lastIndexedAt: new Date(),
      });
      return {
        ok: true,
        fromBlock,
        toBlock,
        indexed: 0,
        duplicates: 0,
        malformed: 0,
        error: null,
      };
    }
    const [vouchedLogs, withdrawnLogs] = await Promise.all([
      client.getLogs({ address: registry, event: VouchedAbi, fromBlock, toBlock }),
      client.getLogs({ address: registry, event: WithdrawnAbi, fromBlock, toBlock }),
    ]);
    const { events, malformed } = decodeRegistryLogs([
      ...vouchedLogs,
      ...withdrawnLogs,
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
    let indexed = 0;
    let duplicates = 0;
    // Kelompokkan per event supaya createdAt-nya tepat (timestamp blok asal).
    // ensureWallets sekali di depan; di dalam apply juga idempoten (no-op).
    const ordered = [...events].sort(
      (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
    );
    const parties = new Set<Address>();
    for (const e of ordered) {
      parties.add(e.voucher);
      parties.add(e.target);
    }
    await store.ensureWallets([...parties]);
    for (const e of ordered) {
      const r = await applyDecodedEvents(
        store,
        [e],
        blockTimes.get(e.blockNumber) ?? new Date(),
      );
      indexed += r.indexed;
      duplicates += r.duplicates;
    }
    await store.writeState({
      lastBlock: Number(toBlock),
      status: "ok",
      error: null,
      lastIndexedAt: new Date(),
    });
    return {
      ok: true,
      fromBlock,
      toBlock,
      indexed,
      duplicates,
      malformed,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await store.writeState({
      lastBlock: prev?.lastBlock ?? 0,
      status: "error",
      error: message,
      lastIndexedAt: new Date(),
    });
    return {
      ok: false,
      fromBlock,
      toBlock,
      indexed: 0,
      duplicates: 0,
      malformed: 0,
      error: message,
    };
  }
}

/**
 * Baca state index registry. Null = indexer belum pernah jalan (no-index) —
 * bedakan dari confirmed-zero (sudah jalan, tabel vouches kosong).
 */
export async function readVouchIndexState(
  store: VouchEventStore = drizzleVouchEventStore,
): Promise<VouchIndexState | null> {
  return store.readState();
}
