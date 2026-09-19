import assert from "node:assert/strict";
import { assessRisk } from "./risk";
import type { OnchainStats } from "@/lib/chain/onchain-stats";
import type { TrustGraphSummary } from "@/lib/chain/trust-graph";
import type { Address } from "@/lib/score/types";

/**
 * Self-check Risk Engine (Spec 05). Bukan test framework — dijalankan dengan
 * `npx tsx lib/score/risk.check.ts`. Gagal = logic risk berubah perilaku.
 */

const NOW = new Date("2026-09-19T00:00:00.000Z");
const SUBJECT = "0x0000000000000000000000000000000000000001" as Address;
const OTHER = "0x0000000000000000000000000000000000000002" as Address;

function stats(partial: Partial<OnchainStats>): OnchainStats {
  return {
    firstTxAt: null,
    lastTxAt: null,
    txCount: null,
    fetchedAt: null,
    ...partial,
  };
}

function graph(partial: Partial<TrustGraphSummary>): TrustGraphSummary {
  return {
    uniqueCounterparties: 0,
    repeatCounterparties: 0,
    longestRelationshipDays: null,
    relationships: [],
    attesters: [],
    disputes: [],
    vouches: [],
    invitedBy: null,
    complete: true,
    firstTxHash: null,
    fetchedAt: null,
    ...partial,
  };
}

function rel(
  counterparty: Address,
  interactionCount: number,
  sent: bigint,
  received: bigint,
) {
  return {
    counterparty,
    isContract: false,
    protocolId: null,
    protocolName: null,
    interactionCount,
    valueSent: sent,
    valueReceived: received,
    firstInteractionAt: null,
    lastInteractionAt: null,
    durationDays: null,
    txHashes: [],
  };
}

const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

// 1. Fresh wallet: muda dan sedikit tx → detected.
{
  const r = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(5), txCount: 2 }),
    graph({}),
    NOW,
  );
  assert.equal(
    r.states.find((s) => s.id === "fresh_wallet")?.status,
    "detected",
  );
  assert.ok(r.signals.some((s) => s.type === "fresh_wallet"));
  assert.ok(r.signals.find((s) => s.type === "fresh_wallet")?.evidence.ageDays === 5);
}

// 2. Wallet tua → fresh clear, bukan detected.
{
  const r = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    graph({}),
    NOW,
  );
  assert.equal(r.states.find((s) => s.id === "fresh_wallet")?.status, "clear");
}

// 3. Circular: >= 3 counterparty dua arah → detected.
{
  const r = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    graph({
      relationships: [
        rel(OTHER, 3, BigInt(1), BigInt(1)),
        rel("0x0000000000000000000000000000000000000003", 2, BigInt(1), BigInt(2)),
        rel("0x0000000000000000000000000000000000000004", 4, BigInt(5), BigInt(5)),
      ],
    }),
    NOW,
  );
  assert.equal(
    r.states.find((s) => s.id === "circular_relationship_graph")?.status,
    "detected",
  );
}

// 4. Incomplete graph → circular/concentration not_evaluable, tidak clear palsu.
{
  const r = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    graph({ complete: false, relationships: [rel(OTHER, 3, BigInt(1), BigInt(1))] }),
    NOW,
  );
  assert.equal(
    r.states.find((s) => s.id === "circular_relationship_graph")?.status,
    "not_evaluable",
  );
  assert.equal(
    r.states.find((s) => s.id === "concentrated_counterparty_graph")?.status,
    "not_evaluable",
  );
}

// 5. Concentrated: satu counterparty 6/8 interaksi (75% >= 50%) → detected,
//    dan dimension lain tetap terdaftar sebagai not_evaluable.
{
  const r = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    graph({
      relationships: [
        rel(OTHER, 6, BigInt(1), BigInt(0)),
        rel("0x0000000000000000000000000000000000000003", 1, BigInt(1), BigInt(0)),
        rel("0x0000000000000000000000000000000000000004", 1, BigInt(1), BigInt(0)),
        rel("0x0000000000000000000000000000000000000005", 0, BigInt(0), BigInt(0)),
        rel("0x0000000000000000000000000000000000000006", 0, BigInt(0), BigInt(0)),
      ],
    }),
    NOW,
  );
  assert.equal(
    r.states.find((s) => s.id === "concentrated_counterparty_graph")?.status,
    "detected",
  );
  assert.equal(
    r.states.find((s) => s.id === "suspicious_vouch_clustering")?.status,
    "not_evaluable",
  );
  assert.equal(r.states.length, 9, "kesembilan slot signal harus hadir");
}

// 6. Terlalu sedikit counterparty → concentration not_evaluable (bukan detected).
{
  const r = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    graph({ relationships: [rel(OTHER, 5, BigInt(1), BigInt(0))] }),
    NOW,
  );
  assert.equal(
    r.states.find((s) => s.id === "concentrated_counterparty_graph")?.status,
    "not_evaluable",
  );
}

// 7. Vouch resiprokal: 2 pasang A↔B aktif → clustering detected.
{
  const ADDR3 = "0x0000000000000000000000000000000000000003" as Address;
  const r = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    graph({
      vouches: [
        { from: SUBJECT, to: OTHER, stakeAmount: BigInt(100), status: "active" },
        { from: OTHER, to: SUBJECT, stakeAmount: BigInt(100), status: "active" },
        { from: SUBJECT, to: ADDR3, stakeAmount: BigInt(50), status: "active" },
        { from: ADDR3, to: SUBJECT, stakeAmount: BigInt(50), status: "active" },
      ],
    }),
    NOW,
  );
  assert.equal(
    r.states.find((s) => s.id === "suspicious_vouch_clustering")?.status,
    "detected",
  );
}

// 8. Abnormal: 10 tx dalam satu jam → burst detected.
{
  const burstTxs = Array.from({ length: 10 }, (_, i) => ({
    timestamp: new Date(NOW.getTime() - i * 60_000),
    valueWei: BigInt(100),
    toIsContract: false,
  }));
  const r = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    graph({}),
    NOW,
    { transactions: burstTxs },
  );
  assert.equal(
    r.states.find((s) => s.id === "abnormal_transaction_pattern")?.status,
    "detected",
  );
}

// 9. Flagged: registry kosong → not_evaluable; ada match → detected.
{
  const g = graph({ relationships: [rel(OTHER, 2, BigInt(1), BigInt(0))] });
  const empty = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    g,
    NOW,
    { flaggedAddresses: [] },
  );
  assert.equal(
    empty.states.find((s) => s.id === "flagged_counterparty_exposure")?.status,
    "not_evaluable",
  );
  const hit = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    g,
    NOW,
    { flaggedAddresses: [{ address: OTHER, source: "test", reason: null }] },
  );
  assert.equal(
    hit.states.find((s) => s.id === "flagged_counterparty_exposure")?.status,
    "detected",
  );
}

// 10. Malicious contract: registry kosong → not_evaluable; match → detected.
{
  const CONTRACT = "0x0000000000000000000000000000000000000007" as Address;
  const g = graph({
    relationships: [
      { ...rel(CONTRACT, 2, BigInt(1), BigInt(0)), isContract: true },
    ],
  });
  const empty = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    g,
    NOW,
    { maliciousContracts: [] },
  );
  assert.equal(
    empty.states.find((s) => s.id === "malicious_contract_interaction")?.status,
    "not_evaluable",
  );
  const hit = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    g,
    NOW,
    { maliciousContracts: [{ address: CONTRACT, source: "test", reason: "test" }] },
  );
  assert.equal(
    hit.states.find((s) => s.id === "malicious_contract_interaction")?.status,
    "detected",
  );
}

// 11. Sybil: 5 counterparty dengan sidik seragam → detected.
{
  const addrs = ["0000000000000000000000000000000000000008", "0000000000000000000000000000000000000009", "0000000000000000000000000000000000000010", "0000000000000000000000000000000000000011", "0000000000000000000000000000000000000012"].map(
    (h) => `0x${h}` as Address,
  );
  const r = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    graph({
      relationships: addrs.map((a) => rel(a, 2, BigInt(5), BigInt(0))),
    }),
    NOW,
  );
  assert.equal(
    r.states.find((s) => s.id === "high_sybil_similarity")?.status,
    "detected",
  );
}

// 12. Input tak tersedia (undefined) → detector baru not_evaluable, bukan clear.
{
  const r = assessRisk(
    SUBJECT,
    stats({ firstTxAt: days(400), txCount: 900 }),
    graph({}),
    NOW,
  );
  for (const id of [
    "abnormal_transaction_pattern",
    "flagged_counterparty_exposure",
    "malicious_contract_interaction",
    "high_sybil_similarity",
    "active_disputes",
  ] as const) {
    assert.equal(r.states.find((s) => s.id === id)?.status, "not_evaluable");
  }
}

// 13. Active disputes: open/disputed → detected dengan evidence; resolved
//     atau kosong → clear (bukan clear palsu — data evaluable).
{
  const base = stats({ firstTxAt: days(400), txCount: 900 });
  const open = assessRisk(SUBJECT, base, graph({}), NOW, {
    disputes: [
      { reporter: OTHER, status: "open", registryId: "3", txHash: null },
    ],
  });
  const openState = open.states.find((s) => s.id === "active_disputes");
  assert.equal(openState?.status, "detected");
  assert.equal(openState?.evidence?.activeDisputes, 1);
  assert.ok(
    open.signals.some((s) => s.type === "active_disputes"),
    "detected wajib masuk signals",
  );

  const disputed = assessRisk(SUBJECT, base, graph({}), NOW, {
    disputes: [{ reporter: OTHER, status: "disputed", registryId: null, txHash: null }],
  });
  assert.equal(
    disputed.states.find((s) => s.id === "active_disputes")?.status,
    "detected",
  );

  const resolved = assessRisk(SUBJECT, base, graph({}), NOW, {
    disputes: [
      { reporter: OTHER, status: "upheld", registryId: "3", txHash: null },
      { reporter: OTHER, status: "dismissed", registryId: "4", txHash: null },
    ],
  });
  assert.equal(
    resolved.states.find((s) => s.id === "active_disputes")?.status,
    "clear",
  );

  const none = assessRisk(SUBJECT, base, graph({}), NOW, { disputes: [] });
  assert.equal(
    none.states.find((s) => s.id === "active_disputes")?.status,
    "clear",
  );
}

console.log("risk.check: ok");
