import assert from "node:assert/strict";
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  parseAbiItem,
  parseAbiParameters,
  type Log,
} from "viem";
import {
  applyDecodedEvents,
  decodeRegistryLogs,
  statusForEvent,
  type DecodedRegistryEvent,
  type VouchEventStore,
  type VouchIndexState,
} from "./vouch-registry";
import type { Address } from "@/lib/score/types";

/**
 * Self-check Vouch Registry Indexer (Spec 08). Bukan test framework —
 * dijalankan dengan `node node_modules/tsx/dist/cli.mjs
 * lib/chain/vouch-registry.check.ts`. Fixture = log ter-encode viem
 * (bukan RPC, bukan DB): decode, normalisasi, transisi status,
 * idempotency, indexerState, malformed. Gagal = perilaku indexer berubah.
 */

const VOUCHED = parseAbiItem(
  "event Vouched(address indexed voucher, address indexed target, uint256 stakeAdded, uint256 totalStake, uint64 pairCount)",
);
const WITHDRAWN = parseAbiItem(
  "event Withdrawn(address indexed voucher, address indexed target, uint256 amount, uint256 remainingStake)",
);

// Checksummed (mixed-case) supaya lolos validasi viem; decoder harus
// menormalisasi ke lowercase.
const VOUCHER = getAddress(`0x${"aa".repeat(20)}`);
const TARGET = getAddress(`0x${"bb".repeat(20)}`);
const TX = `0x${"cc".repeat(32)}`;

/** Encode log fixture manual (viem tanpa encodeEventLog): topics + data. */
function encodeVouched(voucher: string, target: string, stake: bigint) {
  return {
    data: encodeAbiParameters(parseAbiParameters("uint256, uint256, uint64"), [
      stake,
      stake,
      BigInt(1),
    ]),
    topics: encodeEventTopics({
      abi: [VOUCHED],
      eventName: "Vouched",
      args: {
        voucher: voucher as Address,
        target: target as Address,
      },
    }) as [`0x${string}`, ...`0x${string}`[]],
  };
}

function encodeWithdrawn(voucher: string, target: string, amount: bigint) {
  return {
    data: encodeAbiParameters(parseAbiParameters("uint256, uint256"), [
      amount,
      BigInt(0),
    ]),
    topics: encodeEventTopics({
      abi: [WITHDRAWN],
      eventName: "Withdrawn",
      args: {
        voucher: voucher as Address,
        target: target as Address,
      },
    }) as [`0x${string}`, ...`0x${string}`[]],
  };
}

function fixtureLog(
  encoded: { data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]] },
  overrides?: { txHash?: string | null; logIndex?: number | null },
): Log {
  return {
    address: "0x1111111111111111111111111111111111111111",
    blockHash: `0x${"dd".repeat(32)}`,
    blockNumber: BigInt(100),
    data: encoded.data,
    logIndex: overrides?.logIndex === undefined ? 0 : overrides.logIndex,
    transactionHash: overrides?.txHash === undefined ? TX : overrides.txHash,
    transactionIndex: 0,
    topics: encoded.topics,
    removed: false,
  } as unknown as Log;
}

/** Store memori dengan key unik yang sama dengan constraint DB. */
function memoryStore(): VouchEventStore & {
  rows: Map<string, object>;
  wallets: Set<string>;
  state: VouchIndexState | null;
} {
  const rows = new Map<string, object>();
  const wallets = new Set<string>();
  let state: VouchIndexState | null = null;
  return {
    rows,
    wallets,
    state: null,
    async ensureWallets(addresses: Address[]) {
      for (const a of addresses) wallets.add(a);
    },
    async insertVouch(row) {
      const key = `${row.chainId}:${row.txHash}:${row.logIndex}`;
      if (rows.has(key)) return false;
      rows.set(key, row);
      return true;
    },
    async readState() {
      return state;
    },
    async writeState(s) {
      state = s;
    },
  };
}

// 1. Decode Vouched: kind + normalisasi lowercase + amount bigint.
{
  const { events, malformed } = decodeRegistryLogs([
    fixtureLog(encodeVouched(VOUCHER, TARGET, BigInt(500))),
  ]);
  assert.equal(malformed, 0);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.kind, "Vouched");
  assert.equal(events[0]?.voucher, VOUCHER.toLowerCase());
  assert.equal(events[0]?.target, TARGET.toLowerCase());
  assert.equal(events[0]?.amount, BigInt(500));
  assert.equal(statusForEvent("Vouched"), "active");
}

// 2. Decode Withdrawn → status withdrawn.
{
  const { events, malformed } = decodeRegistryLogs([
    fixtureLog(encodeWithdrawn(VOUCHER, TARGET, BigInt(200)), { logIndex: 1 }),
  ]);
  assert.equal(malformed, 0);
  assert.equal(events[0]?.kind, "Withdrawn");
  assert.equal(statusForEvent("Withdrawn"), "withdrawn");
}

// 3. Malformed: event asing + field chain null → dihitung, tidak throw.
{
  const transfer = parseAbiItem(
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  );
  const { events, malformed } = decodeRegistryLogs([
    fixtureLog({
      data: encodeAbiParameters(parseAbiParameters("uint256"), [BigInt(1)]),
      topics: encodeEventTopics({
        abi: [transfer],
        eventName: "Transfer",
        args: {
          from: VOUCHER as Address,
          to: TARGET as Address,
        },
      }) as [`0x${string}`, ...`0x${string}`[]],
    }),
    fixtureLog(encodeVouched(VOUCHER, TARGET, BigInt(1)), { txHash: null }),
  ]);
  assert.equal(events.length, 0);
  assert.equal(malformed, 2);
}

// 4-7 memakai store async → dibungkus main (tsx CJS tanpa top-level await).
async function main() {
// 4. Transisi: Vouched lalu Withdrawn = dua baris (active, withdrawn).
{
  const store = memoryStore();
  const v = decodeRegistryLogs([
    fixtureLog(encodeVouched(VOUCHER, TARGET, BigInt(500))),
  ]).events;
  const w = decodeRegistryLogs([
    fixtureLog(encodeWithdrawn(VOUCHER, TARGET, BigInt(500)), { logIndex: 1 }),
  ]).events;
  const r = await applyDecodedEvents(store, [...v, ...w], new Date(0));
  assert.equal(r.indexed, 2);
  assert.equal(r.duplicates, 0);
  assert.equal(store.rows.size, 2);
  const statuses = [...store.rows.values()].map(
    (row) => (row as { status: string }).status,
  );
  assert.deepEqual(statuses, ["active", "withdrawn"]);
  // FK: kedua sisi wallet dipastikan ada.
  assert.ok(store.wallets.has(VOUCHER.toLowerCase()));
  assert.ok(store.wallets.has(TARGET.toLowerCase()));
}

// 5. Idempotency: run ulang event sama → semua duplikat, baris tetap.
{
  const store = memoryStore();
  const { events } = decodeRegistryLogs([
    fixtureLog(encodeVouched(VOUCHER, TARGET, BigInt(500))),
  ]);
  const first = await applyDecodedEvents(store, events, new Date(0));
  const second = await applyDecodedEvents(store, events, new Date(0));
  assert.equal(first.indexed, 1);
  assert.equal(second.indexed, 0);
  assert.equal(second.duplicates, 1);
  assert.equal(store.rows.size, 1);
}

// 6. indexerState: null = belum pernah jalan; tulis lalu baca kembali.
{
  const store = memoryStore();
  assert.equal(await store.readState(), null);
  const written: VouchIndexState = {
    lastBlock: 100,
    status: "ok",
    error: null,
    lastIndexedAt: new Date(0),
  };
  await store.writeState(written);
  assert.deepEqual(await store.readState(), written);
}

// 7. Urutan deterministik: input acak → insert berurutan (block, logIndex).
{
  const store = memoryStore();
  const mk = (block: number, logIndex: number): DecodedRegistryEvent => ({
    kind: "Vouched",
    voucher: VOUCHER.toLowerCase() as Address,
    target: TARGET.toLowerCase() as Address,
    amount: BigInt(1),
    txHash: TX,
    logIndex,
    blockNumber: block,
  });
  await applyDecodedEvents(
    store,
    [mk(102, 3), mk(100, 9), mk(100, 2)],
    new Date(0),
  );
  const keys = [...store.rows.keys()];
  // Urutan insert mengikuti (blockNumber, logIndex): (100,2), (100,9), (102,3).
  assert.deepEqual(keys, [
    `46630:${TX}:2`,
    `46630:${TX}:9`,
    `46630:${TX}:3`,
  ]);
}
}

void main().then(() => {
  console.log("vouch-registry.check: ok");
});
