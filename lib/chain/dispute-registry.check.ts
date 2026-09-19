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
  applyDecodedDisputes,
  decodeDisputeLogs,
  getDisputeRegistryAddress,
  statusForEvent,
  type DisputeEventStore,
  type DisputeIndexState,
} from "./dispute-registry";
import type { Address } from "@/lib/score/types";

/**
 * Self-check Dispute Registry Indexer (Spec 09). Bukan test framework —
 * dijalankan dengan `node node_modules/tsx/dist/cli.mjs
 * lib/chain/dispute-registry.check.ts`. Fixture = log ter-encode viem
 * (bukan RPC, bukan DB): decode, lifecycle mapping, idempotent indexing,
 * ordering, malformed, missing config. Gagal = perilaku indexer berubah.
 */

const OPENED = parseAbiItem(
  "event DisputeOpened(uint256 indexed disputeId, address indexed reporter, address indexed target, bytes32 reasonHash, bytes32 evidenceRef)",
);
const DISPUTED = parseAbiItem(
  "event DisputeDisputed(uint256 indexed disputeId, address indexed reporter, address indexed target)",
);
const UPHELD = parseAbiItem(
  "event DisputeUpheld(uint256 indexed disputeId, address indexed reporter, address indexed target)",
);
const DISMISSED = parseAbiItem(
  "event DisputeDismissed(uint256 indexed disputeId, address indexed reporter, address indexed target)",
);

// Checksummed (mixed-case) supaya lolos validasi viem; decoder harus
// menormalisasi ke lowercase.
const REPORTER = getAddress(`0x${"aa".repeat(20)}`);
const TARGET = getAddress(`0x${"bb".repeat(20)}`);
const TX = `0x${"cc".repeat(32)}`;
const REASON_HASH = `0x${"11".repeat(32)}`;
const EVIDENCE_REF = `0x${"22".repeat(32)}`;

function encodeOpened(disputeId: bigint) {
  return {
    data: encodeAbiParameters(parseAbiParameters("bytes32, bytes32"), [
      REASON_HASH as `0x${string}`,
      EVIDENCE_REF as `0x${string}`,
    ]),
    topics: encodeEventTopics({
      abi: [OPENED],
      eventName: "DisputeOpened",
      args: {
        disputeId,
        reporter: REPORTER as Address,
        target: TARGET as Address,
      },
    }) as [`0x${string}`, ...`0x${string}`[]],
  };
}

function encodeTransition(
  item: typeof DISPUTED | typeof UPHELD | typeof DISMISSED,
  eventName: "DisputeDisputed" | "DisputeUpheld" | "DisputeDismissed",
  disputeId: bigint,
) {
  return {
    data: "0x" as `0x${string}`,
    topics: encodeEventTopics({
      abi: [item],
      eventName,
      args: {
        disputeId,
        reporter: REPORTER as Address,
        target: TARGET as Address,
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
function memoryStore(): DisputeEventStore & {
  rows: Map<string, { status: string; registryId: string; chainId: number }>;
  wallets: Set<string>;
  state: DisputeIndexState | null;
} {
  const rows = new Map<
    string,
    { status: string; registryId: string; chainId: number }
  >();
  const wallets = new Set<string>();
  let state: DisputeIndexState | null = null;
  return {
    rows,
    wallets,
    state: null,
    async ensureWallets(addresses: Address[]) {
      for (const a of addresses) wallets.add(a);
    },
    async insertDispute(row) {
      const key = `${row.registryId}:${row.chainId}:${row.txHash}:${row.logIndex}`;
      if (rows.has(key)) return false;
      rows.set(key, {
        status: "open",
        registryId: row.registryId,
        chainId: row.chainId,
      });
      return true;
    },
    async updateDisputeStatus(registryId, chainId, status) {
      for (const row of rows.values()) {
        if (row.registryId === registryId && row.chainId === chainId) {
          row.status = status;
          return true;
        }
      }
      return false;
    },
    async readState() {
      return state;
    },
    async writeState(s) {
      state = s;
    },
  };
}

// 1. Decode Opened: kind + id + hashes + normalisasi.
{
  const { events, malformed } = decodeDisputeLogs([
    fixtureLog(encodeOpened(BigInt(3))),
  ]);
  assert.equal(malformed, 0);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.kind, "DisputeOpened");
  assert.equal(events[0]?.disputeId, BigInt(3));
  assert.equal(events[0]?.reporter, REPORTER.toLowerCase());
  assert.equal(events[0]?.target, TARGET.toLowerCase());
  assert.equal(events[0]?.reasonHash, REASON_HASH);
  assert.equal(events[0]?.evidenceRef, EVIDENCE_REF);
  assert.equal(statusForEvent("DisputeOpened"), "open");
}

// 2. Lifecycle mapping: keempat event → status yang benar.
{
  assert.equal(statusForEvent("DisputeDisputed"), "disputed");
  assert.equal(statusForEvent("DisputeUpheld"), "upheld");
  assert.equal(statusForEvent("DisputeDismissed"), "dismissed");
  const { events } = decodeDisputeLogs([
    fixtureLog(encodeTransition(DISPUTED, "DisputeDisputed", BigInt(3)), {
      logIndex: 1,
    }),
    fixtureLog(encodeTransition(UPHELD, "DisputeUpheld", BigInt(3)), {
      logIndex: 2,
    }),
  ]);
  assert.equal(events.length, 2);
  assert.equal(events[0]?.kind, "DisputeDisputed");
  assert.equal(events[1]?.kind, "DisputeUpheld");
}

// 3. Malformed: event asing + txHash null → dihitung, tidak throw.
{
  const transfer = parseAbiItem(
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  );
  const { events, malformed } = decodeDisputeLogs([
    fixtureLog({
      data: encodeAbiParameters(parseAbiParameters("uint256"), [BigInt(1)]),
      topics: encodeEventTopics({
        abi: [transfer],
        eventName: "Transfer",
        args: {
          from: REPORTER as Address,
          to: TARGET as Address,
        },
      }) as [`0x${string}`, ...`0x${string}`[]],
    }),
    fixtureLog(encodeOpened(BigInt(1)), { txHash: null }),
  ]);
  assert.equal(events.length, 0);
  assert.equal(malformed, 2);
}

// 4. Missing config: tanpa env → null (bukan alamat karangan).
{
  delete process.env.FATHOM_DISPUTE_REGISTRY_ADDRESS;
  assert.equal(getDisputeRegistryAddress(), null);
}

// 5-8 memakai store async → dibungkus main (tsx CJS tanpa top-level await).
async function main() {
// 5. Lifecycle sync: Opened → Disputed → Upheld, berurutan.
{
  const store = memoryStore();
  const opened = decodeDisputeLogs([fixtureLog(encodeOpened(BigInt(3)))]).events;
  const disputed = decodeDisputeLogs([
    fixtureLog(encodeTransition(DISPUTED, "DisputeDisputed", BigInt(3)), {
      logIndex: 1,
    }),
  ]).events;
  const upheld = decodeDisputeLogs([
    fixtureLog(encodeTransition(UPHELD, "DisputeUpheld", BigInt(3)), {
      logIndex: 2,
    }),
  ]).events;
  const r1 = await applyDecodedDisputes(store, opened, new Date(0));
  assert.equal(r1.indexed, 1);
  const r2 = await applyDecodedDisputes(store, disputed, new Date(0));
  assert.equal(r2.transitions, 1);
  const r3 = await applyDecodedDisputes(store, upheld, new Date(0));
  assert.equal(r3.transitions, 1);
  assert.equal([...store.rows.values()][0]?.status, "upheld");
  assert.ok(store.wallets.has(REPORTER.toLowerCase()));
  assert.ok(store.wallets.has(TARGET.toLowerCase()));
}

// 6. Idempotency: Opened ulang + transisi tanpa baris = duplikat.
{
  const store = memoryStore();
  const { events } = decodeDisputeLogs([fixtureLog(encodeOpened(BigInt(3)))]);
  const first = await applyDecodedDisputes(store, events, new Date(0));
  const second = await applyDecodedDisputes(store, events, new Date(0));
  assert.equal(first.indexed, 1);
  assert.equal(second.indexed, 0);
  assert.equal(second.duplicates, 1);
  const orphan = decodeDisputeLogs([
    fixtureLog(encodeTransition(DISMISSED, "DisputeDismissed", BigInt(99))),
  ]).events;
  const r = await applyDecodedDisputes(store, orphan, new Date(0));
  assert.equal(r.transitions, 0);
  assert.equal(r.duplicates, 1);
  assert.equal(store.rows.size, 1);
}

// 7. Ordering: transisi sebelum open dalam batch acak tetap benar.
{
  const store = memoryStore();
  const opened = decodeDisputeLogs([fixtureLog(encodeOpened(BigInt(3)))]).events;
  const dismissed = decodeDisputeLogs([
    fixtureLog(encodeTransition(DISMISSED, "DisputeDismissed", BigInt(3)), {
      logIndex: 1,
    }),
  ]).events;
  // Simulasi apply terpisah: open dulu (sorting menjamin urutan by logIndex).
  const r = await applyDecodedDisputes(
    store,
    [...dismissed, ...opened],
    new Date(0),
  );
  assert.equal(r.indexed, 1);
  assert.equal(r.transitions, 1);
  assert.equal([...store.rows.values()][0]?.status, "dismissed");
}

// 8. indexerState: null = belum pernah jalan; tulis lalu baca kembali.
{
  const store = memoryStore();
  assert.equal(await store.readState(), null);
  const written: DisputeIndexState = {
    lastBlock: 100,
    status: "ok",
    error: null,
    lastIndexedAt: new Date(0),
  };
  await store.writeState(written);
  assert.deepEqual(await store.readState(), written);
}
}

void main().then(() => {
  console.log("dispute-registry.check: ok");
});
