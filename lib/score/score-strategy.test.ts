import { describe, expect, it } from "vitest";
import { computeScore } from "@/lib/score/score-engine";
import { ScoreStrategyV1 } from "@/lib/score/score-strategy";
import { TierStrategyV1 } from "@/lib/score/tier-strategy";
import type { ScoreAvailability, ScoreInput } from "@/lib/score/types";

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
const dimension = (id: string) =>
  strategy.compute(input).breakdown.dimensions.find((item) => item.id === id);

describe("ScoreStrategyV1 (calibrated 1.1.0)", () => {
  it("is deterministic for the same JSON input", () => {
    expect(strategy.compute(input)).toEqual(strategy.compute(input));
  });

  it("scores economic at calibrated fixture inputs (age 100 + tx 20 + volume 47)", () => {
    expect(dimension("economic_history")?.contribution).toBe(167);
  });

  it("scores counterparty at calibrated fixture inputs (unique 40 + repeat 25 + longevity 50)", () => {
    expect(dimension("counterparty_history")?.contribution).toBe(115);
  });

  it("scores one verified contract proof at 50", () => {
    expect(dimension("contract_history")?.contribution).toBe(50);
  });

  it("gives no bonus for clear risk and never negative zero", () => {
    const risk = strategy.compute(input).breakdown.riskAdjustment;
    expect(risk.contribution).toBe(0);
    expect(Object.is(risk.contribution, -0)).toBe(false);
  });

  it("carries proof references through dimensions", () => {
    expect(
      dimension("economic_history")?.evidenceReferences.proofs.map((p) => p.evidenceReference),
    ).toEqual(["ev-wallet-age"]);
    expect(
      dimension("counterparty_history")?.evidenceReferences.proofs.map((p) => p.evidenceReference),
    ).toEqual(["ev-counterparty"]);
  });

  it("marks unavailable sources with zero contribution", () => {
    const noEconomic = strategy.compute({
      ...input,
      availability: { ...availability, economicHistory: source("unavailable") },
    });
    expect(noEconomic.breakdown.dimensions[0].available).toBe(false);
    expect(noEconomic.breakdown.dimensions[0].contribution).toBe(0);
  });

  it("deducts 100 for one high risk signal with evidence reference", () => {
    const highRisk = strategy.compute({
      ...input,
      risk: { detected: [{ id: "test_signal", severity: "high", evidenceReference: "ev-risk" }] },
    });
    expect(highRisk.breakdown.riskAdjustment.contribution).toBe(-100);
    expect(highRisk.breakdown.riskAdjustment.evidenceReferences.direct[0]?.reference).toBe("ev-risk");
  });

  it("grants a tier only when complete", () => {
    const engine = (candidate: ScoreInput) =>
      computeScore(candidate, new ScoreStrategyV1(), new TierStrategyV1());
    const complete = engine(input);
    expect(complete.completeness).toBe("complete");
    expect(complete.tier?.id).toBe("emerging");

    const partial = engine({ ...input, availability: { ...availability, riskSignals: source("not_indexed") } });
    expect(partial.completeness).toBe("partial");
    expect(partial.tier).toBeNull();

    const optionalMissing = engine({
      ...input,
      availability: { ...availability, vouches: source("not_indexed"), attestations: source("not_indexed"), contractHistory: source("not_indexed") },
    });
    expect(optionalMissing.completeness).toBe("complete");
    expect(optionalMissing.tier).not.toBeNull();
  });

  it("is unavailable only when every source is unusable", () => {
    const engine = (candidate: ScoreInput) =>
      computeScore(candidate, new ScoreStrategyV1(), new TierStrategyV1());
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
    expect(unavailable.completeness).toBe("unavailable");
    expect(unavailable.tier).toBeNull();
  });
});
