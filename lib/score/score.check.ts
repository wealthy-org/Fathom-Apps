import assert from "node:assert/strict";
import { ScoreStrategyV1 } from "./score-strategy";
import type { ScoreInput } from "./types";

const address = "0x0000000000000000000000000000000000000001" as const;
const input: ScoreInput = {
  address, evaluatedAt: "2026-09-19T00:00:00.000Z",
  onchain: { firstTxAt: "2025-09-19T00:00:00.000Z", txCount: 100, volumeWei: "1000000000000000000" },
  counterparty: { available: true, uniqueCount: 10, repeatCount: 5, longestRelationshipDays: 365 },
  verifiedProtocolProofs: ["protocol-proof"],
  community: { vouches: [], attestations: [] },
  risk: { evaluable: true, detected: [] },
  proofReferences: { economic_history: ["economic-proof"], counterparty_history: ["counterparty-proof"] },
};

const strategy = new ScoreStrategyV1();
const first = strategy.compute(input);
assert.deepEqual(strategy.compute(input), first, "same JSON input is deterministic");
assert.equal(first.breakdown.dimensions.find((item) => item.id === "economic_history")?.contribution, 250);
assert.equal(first.breakdown.dimensions.find((item) => item.id === "counterparty_history")?.contribution, 200);
assert.equal(first.breakdown.riskAdjustment.contribution, 0, "clear risk gives no bonus");
const unavailable = strategy.compute({ ...input, onchain: { firstTxAt: null, txCount: null, volumeWei: null } });
assert.equal(unavailable.breakdown.dimensions[0].available, false);
assert.equal(unavailable.breakdown.dimensions[0].contribution, 0);
const risk = strategy.compute({ ...input, risk: { evaluable: true, detected: [{ id: "test", severity: "high", evidenceReference: "risk-proof" }] } });
assert.equal(risk.breakdown.riskAdjustment.contribution, -100);
console.log("score.check: ok");
