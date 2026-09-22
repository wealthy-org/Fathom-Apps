import assert from "node:assert/strict";
import { computeScore } from "./score-engine";
import { ScoreStrategyV1 } from "./score-strategy";
import { TierStrategyV1 } from "./tier-strategy";
import type { ScoreAvailability, ScoreInput } from "./types";

const A = "0x0000000000000000000000000000000000000001" as const;
const source = (state: ScoreAvailability[keyof ScoreAvailability]["state"]) => ({ state });
const availability: ScoreAvailability = {
  onchain: source("available"),
  economicHistory: source("available"),
  counterpartyHistory: source("available"),
  contractHistory: source("available"),
  attestations: source("available"),
  vouches: source("available"),
  riskSignals: source("available"),
};

const input: ScoreInput = {
  address: A,
  evaluatedAt: "2026-09-19T00:00:00.000Z",
  availability,
  onchain: {
    firstTxAt: "2025-09-19T00:00:00.000Z",
    txCount: 100,
    volumeWei: "1000000000000000000",
    proofs: [{ type: "wallet_age", evidenceReference: "ev-wallet-age" }],
  },
  counterparty: {
    uniqueCount: 10,
    repeatCount: 5,
    longestRelationshipDays: 365,
    proofs: [{ type: "unique_counterparty", evidenceReference: "ev-counterparty" }],
  },
  contracts: [{ type: "contract_history", evidenceReference: "ev-contract" }],
  community: { vouches: [], attestations: [] },
  risk: { detected: [] },
};

const strategy = new ScoreStrategyV1();
const first = strategy.compute(input);
assert.deepEqual(strategy.compute(input), first, "same JSON input is deterministic");

const dimension = (id: string) => first.breakdown.dimensions.find((item) => item.id === id);
assert.equal(dimension("economic_history")?.contribution, 167, "economic at calibrated fixture inputs (age 100 + tx 20 + volume 47)");
assert.equal(dimension("counterparty_history")?.contribution, 115, "counterparty at calibrated fixture inputs (unique 40 + repeat 25 + longevity 50)");
assert.equal(dimension("contract_history")?.contribution, 50, "one verified contract proof");
assert.equal(first.breakdown.riskAdjustment.contribution, 0, "clear risk gives no bonus");
assert.ok(!Object.is(first.breakdown.riskAdjustment.contribution, -0), "no negative zero penalty");

assert.deepEqual(
  dimension("economic_history")?.evidenceReferences.proofs.map((p) => p.evidenceReference),
  ["ev-wallet-age"],
  "economic dimension carries proof references",
);
assert.deepEqual(
  dimension("counterparty_history")?.evidenceReferences.proofs.map((p) => p.evidenceReference),
  ["ev-counterparty"],
  "counterparty dimension carries proof references",
);

const noEconomic = strategy.compute({
  ...input,
  availability: { ...availability, economicHistory: source("unavailable") },
});
assert.equal(noEconomic.breakdown.dimensions[0].available, false);
assert.equal(noEconomic.breakdown.dimensions[0].contribution, 0);

const highRisk = strategy.compute({
  ...input,
  risk: { detected: [{ id: "test_signal", severity: "high", evidenceReference: "ev-risk" }] },
});
assert.equal(highRisk.breakdown.riskAdjustment.contribution, -100, "one high risk signal deducts 100");
assert.equal(highRisk.breakdown.riskAdjustment.evidenceReferences.direct[0]?.reference, "ev-risk");

const engine = (candidate: ScoreInput) => computeScore(candidate, new ScoreStrategyV1(), new TierStrategyV1());
const complete = engine(input);
assert.equal(complete.completeness, "complete");
assert.equal(complete.tier?.id, "emerging", "complete score receives a provisional tier");

const partial = engine({ ...input, availability: { ...availability, riskSignals: source("not_indexed") } });
assert.equal(partial.completeness, "partial");
assert.equal(partial.tier, null, "incomplete score never receives a tier");

const unavailable = engine({
  ...input,
  availability: {
    onchain: source("not_indexed"),
    economicHistory: source("not_indexed"),
    counterpartyHistory: source("not_indexed"),
    contractHistory: source("not_indexed"),
    attestations: source("not_indexed"),
    vouches: source("not_indexed"),
    riskSignals: source("not_indexed"),
  },
});
assert.equal(unavailable.completeness, "unavailable");
assert.equal(unavailable.tier, null);

const optionalMissing = engine({ ...input, availability: { ...availability, vouches: source("not_indexed"), attestations: source("not_indexed"), contractHistory: source("not_indexed") } });
assert.equal(optionalMissing.completeness, "complete", "optional unindexed sources do not block tier eligibility");
assert.notEqual(optionalMissing.tier, null);

console.log("score.check: ok");
