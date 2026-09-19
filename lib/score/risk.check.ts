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
  assert.equal(r.states.length, 6, "keenam slot signal harus hadir");
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

console.log("risk.check: ok");
