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
  applyDecodedAttestations,
  decodeAttestationLogs,
  MAX_RELATIONSHIP_LENGTH,
  MAX_ROLE_LENGTH,
  type AttestationEventStore,
  type AttestationIndexState,
} from "./attestation-registry";
import type { Address } from "@/lib/score/types";

/**
 * Self-check Attestation Registry Indexer (Spec 07). Bukan test framework —
 * dijalankan dengan `node node_modules/tsx/dist/cli.mjs
 * lib/chain/attestation-registry.check.ts`. Fixture = log ter-encode viem
 * (bukan RPC, bukan DB): decode, normalisasi, mapping DB, revoke lifecycle,
 * idempotency, indexerState, malformed. Gagal = perilaku indexer berubah.
 */

const CREATED = parseAbiItem(
  "event AttestationCreated(uint256 indexed attestationId, address indexed attester, address indexed subject, string role, string relationship, uint32 durationMonths)",
);
const REVOKED = parseAbiItem(
  "event AttestationRevoked(uint256 indexed attestationId, address indexed attester, address indexed subject)",
);

// Checksummed (mixed-case) supaya lolos validasi viem; decoder harus
// menormalisasi ke lowercase.
const ATTESTER = getAddress(`0x${"aa".repeat(20)}`);
const SUBJECT = getAddress(`0x${"bb".repeat(20)}`);
const TX = `0x${"cc".repeat(32)}`;

/** Encode log fixture manual (viem tanpa encodeEventLog): topics + data. */
function encodeCreated(
  attestationId: bigint,
  role = "mentor",
  relationship = "worked together",
  durationMonths = 6,
) {
  return {
    data: encodeAbiParameters(parseAbiParameters("string, string, uint32"), [
      role,
      relationship,
      durationMonths,
    ]),
    topics: encodeEventTopics({
      abi: [CREATED],
      eventName: "AttestationCreated",
      args: {
        attestationId,
        attester: ATTESTER as Address,
        subject: SUBJECT as Address,
      },
    }) as [`0x${string}`, ...`0x${string}`[]],
  };
}

function encodeRevoked(attestationId: bigint) {
  return {
    data: "0x" as `0x${string}`,
    topics: encodeEventTopics({
      abi: [REVOKED],
      eventName: "AttestationRevoked",
      args: {
        attestationId,
        attester: ATTESTER as Address,
        subject: SUBJECT as Address,
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
function memoryStore(): AttestationEventStore & {
  rows: Map<string, object>;
  wallets: Set<string>;
  state: AttestationIndexState | null;
} {
  const rows = new Map<string, object>();
  const wallets = new Set<string>();
  let state: AttestationIndexState | null = null;
  return {
    rows,
    wallets,
    state: null,
    async ensureWallets(addresses: Address[]) {
      for (const a of addresses) wallets.add(a);
    },
    async insertAttestation(row) {
      const key = `${row.registryId}:${row.chainId}:${row.txHash}:${row.logIndex}`;
      if (rows.has(key)) return false;
      rows.set(key, row);
      return true;
    },
    async revokeAttestation(registryId, chainId) {
      for (const [key, row] of rows) {
        const r = row as { registryId: string; chainId: number };
        if (r.registryId === registryId && r.chainId === chainId) {
          rows.delete(key);
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

// 1. Decode Created: kind + id + normalisasi lowercase + field string.
{
  const { events, malformed } = decodeAttestationLogs([
    fixtureLog(encodeCreated(BigInt(7))),
  ]);
  assert.equal(malformed, 0);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.kind, "AttestationCreated");
  assert.equal(events[0]?.attestationId, BigInt(7));
  assert.equal(events[0]?.attester, ATTESTER.toLowerCase());
  assert.equal(events[0]?.subject, SUBJECT.toLowerCase());
  assert.equal(events[0]?.role, "mentor");
  assert.equal(events[0]?.relationship, "worked together");
  assert.equal(events[0]?.durationMonths, 6);
}

// 2. Decode Revoked: tanpa payload string, tetap ter-decode.
{
  const { events, malformed } = decodeAttestationLogs([
    fixtureLog(encodeRevoked(BigInt(7)), { logIndex: 1 }),
  ]);
  assert.equal(malformed, 0);
  assert.equal(events[0]?.kind, "AttestationRevoked");
  assert.equal(events[0]?.attestationId, BigInt(7));
  assert.equal(events[0]?.role, null);
}

// 3. Malformed: event asing + role over-long + relationship over-long +
//    duration nol + txHash null → dihitung, tidak throw.
{
  const transfer = parseAbiItem(
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  );
  const { events, malformed } = decodeAttestationLogs([
    fixtureLog({
      data: encodeAbiParameters(parseAbiParameters("uint256"), [BigInt(1)]),
      topics: encodeEventTopics({
        abi: [transfer],
        eventName: "Transfer",
        args: {
          from: ATTESTER as Address,
          to: SUBJECT as Address,
        },
      }) as [`0x${string}`, ...`0x${string}`[]],
    }),
    fixtureLog(encodeCreated(BigInt(1), "r".repeat(MAX_ROLE_LENGTH + 1))),
    fixtureLog(
      encodeCreated(BigInt(2), "mentor", "x".repeat(MAX_RELATIONSHIP_LENGTH + 1)),
    ),
    fixtureLog(encodeCreated(BigInt(3), "mentor", "worked together", 0)),
    fixtureLog(encodeCreated(BigInt(4)), { txHash: null }),
  ]);
  assert.equal(events.length, 0);
  assert.equal(malformed, 5);
}

// 4-8 memakai store async → dibungkus main (tsx CJS tanpa top-level await).
async function main() {
// 4. Mapping DB: Created → baris dengan identitas on-chain + payload null.
{
  const store = memoryStore();
  const { events } = decodeAttestationLogs([
    fixtureLog(encodeCreated(BigInt(7))),
  ]);
  const r = await applyDecodedAttestations(store, events, new Date(0));
  assert.equal(r.indexed, 1);
  assert.equal(r.revoked, 0);
  assert.equal(r.duplicates, 0);
  assert.equal(store.rows.size, 1);
  const row = [...store.rows.values()][0] as {
    attesterAddress: string;
    subjectAddress: string;
    role: string;
    registryId: string;
    chainId: number;
  };
  assert.equal(row.attesterAddress, ATTESTER.toLowerCase());
  assert.equal(row.subjectAddress, SUBJECT.toLowerCase());
  assert.equal(row.role, "mentor");
  assert.equal(row.registryId, "7");
  assert.equal(row.chainId, 46630);
  // FK: kedua sisi wallet dipastikan ada.
  assert.ok(store.wallets.has(ATTESTER.toLowerCase()));
  assert.ok(store.wallets.has(SUBJECT.toLowerCase()));
}

// 5. Lifecycle: Created lalu Revoked = baris hilang, revoked dihitung.
{
  const store = memoryStore();
  const created = decodeAttestationLogs([
    fixtureLog(encodeCreated(BigInt(7))),
  ]).events;
  const revoked = decodeAttestationLogs([
    fixtureLog(encodeRevoked(BigInt(7)), { logIndex: 1 }),
  ]).events;
  const r1 = await applyDecodedAttestations(store, created, new Date(0));
  assert.equal(r1.indexed, 1);
  const r2 = await applyDecodedAttestations(store, revoked, new Date(0));
  assert.equal(r2.revoked, 1);
  assert.equal(store.rows.size, 0);
}

// 6. Revoke tanpa Created = no-op idempoten (duplikat, bukan error).
{
  const store = memoryStore();
  const { events } = decodeAttestationLogs([
    fixtureLog(encodeRevoked(BigInt(99))),
  ]);
  const r = await applyDecodedAttestations(store, events, new Date(0));
  assert.equal(r.revoked, 0);
  assert.equal(r.duplicates, 1);
}

// 7. Idempotency: run ulang Created sama → duplikat, baris tetap satu.
{
  const store = memoryStore();
  const { events } = decodeAttestationLogs([
    fixtureLog(encodeCreated(BigInt(7))),
  ]);
  const first = await applyDecodedAttestations(store, events, new Date(0));
  const second = await applyDecodedAttestations(store, events, new Date(0));
  assert.equal(first.indexed, 1);
  assert.equal(second.indexed, 0);
  assert.equal(second.duplicates, 1);
  assert.equal(store.rows.size, 1);
}

// 8. indexerState: null = belum pernah jalan; tulis lalu baca kembali.
{
  const store = memoryStore();
  assert.equal(await store.readState(), null);
  const written: AttestationIndexState = {
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
  console.log("attestation-registry.check: ok");
});
