import assert from "node:assert/strict";
import { computeScore } from "./score-engine";
import { ScoreStrategyV1 } from "./score-strategy";
import { tierStrategyV1 } from "./tier-strategy";
import { metric, truncateAlias } from "@/lib/wallet/card-utils";
import { profileUrl } from "@/lib/wallet/profile-url";
import { normalizeAddress } from "@/lib/chain/address";
import type { Address, ScoreInput, ScoreAvailability } from "./types";

const A = ("0x" + "f".repeat(40)) as Address;
const BASE = { firstTxAt: "2025-09-19T00:00:00.000Z", txCount: 100, volumeWei: "1000000000000000000" };

function input(overrides: Partial<ScoreInput>, availability: ScoreAvailability): ScoreInput {
  return {
    address: A,
    evaluatedAt: "2026-09-19T00:00:00.000Z",
    availability,
    onchain: { ...BASE, proofs: [] },
    counterparty: { uniqueCount: 10, repeatCount: 5, longestRelationshipDays: 365, proofs: [] },
    contracts: [],
    community: { vouches: [], attestations: [] },
    risk: { detected: [] },
    ...overrides,
  };
}

function availableState(): ScoreAvailability {
  return {
    onchain: { state: "available" },
    economicHistory: { state: "available" },
    counterpartyHistory: { state: "available" },
    contractHistory: { state: "available" },
    attestations: { state: "available" },
    vouches: { state: "available" },
    riskSignals: { state: "available" },
  };
}

const completeInput = input({}, availableState());
function partialInput(): ScoreInput {
  return input({}, { ...availableState(), counterpartyHistory: { state: "not_indexed" } });
}
function unavailableInput(): ScoreInput {
  return input({}, {
    onchain: { state: "not_indexed" },
    economicHistory: { state: "unavailable" },
    counterpartyHistory: { state: "unavailable" },
    contractHistory: { state: "unavailable" },
    attestations: { state: "unavailable" },
    vouches: { state: "unavailable" },
    riskSignals: { state: "unavailable" },
  });
}

// 1. Complete -> tier allowed.
const complete = computeScore(completeInput, new ScoreStrategyV1(), tierStrategyV1);
assert.equal(complete.completeness, "complete");
assert.notEqual(complete.tier, null);
assert.equal(complete.formulaVersion, "1.1.0-provisional");
assert.ok(complete.totalScore > 0);
assert.ok(complete.totalScore <= 1000);

// 2. Partial -> tier MUST be null.
const partial = computeScore(partialInput(), new ScoreStrategyV1(), tierStrategyV1);
assert.equal(partial.completeness, "partial");
assert.equal(partial.tier, null);

// 3. Unavailable -> tier MUST be null, no fabricated score.
const unavailable = computeScore(unavailableInput(), new ScoreStrategyV1(), tierStrategyV1);
assert.equal(unavailable.completeness, "unavailable");
assert.equal(unavailable.tier, null);
assert.equal(unavailable.totalScore, 0);

// 4. No detected risk signals -> no fabricated penalty.
assert.equal(complete.breakdown.riskAdjustment.contribution, 0);

// 5. metric helper.
assert.equal(metric(null), "—");
assert.equal(metric(100), "100");
assert.equal(metric("abc"), "abc");

// 6. alias truncation.
assert.equal(truncateAlias(null), null);
assert.equal(truncateAlias("short"), "short");
const longAlias = "a".repeat(40);
const truncated = truncateAlias(longAlias)!;
assert.equal(truncated.length, 28);
assert.ok(truncated.endsWith("..."), "truncation suffix");

// 7. Profile URL + address normalization.
assert.equal(profileUrl(A), `/wallets/${normalizeAddress(A)}`);
assert.throws(() => normalizeAddress("not-an-address"));

console.log("card.check: ok");
