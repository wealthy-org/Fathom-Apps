import { describe, expect, it } from "vitest";
import { TierStrategyV1 } from "@/lib/score/tier-strategy";

const tiers = new TierStrategyV1();

describe("TierStrategyV1", () => {
  it("maps boundary scores to the higher tier", () => {
    expect(tiers.getTier(750).id).toBe("exceptional");
    expect(tiers.getTier(500).id).toBe("established");
    expect(tiers.getTier(250).id).toBe("emerging");
    expect(tiers.getTier(0).id).toBe("new");
  });

  it("maps mid-range scores correctly", () => {
    expect(tiers.getTier(1000).id).toBe("exceptional");
    expect(tiers.getTier(749).id).toBe("established");
    expect(tiers.getTier(332).id).toBe("emerging");
    expect(tiers.getTier(249).id).toBe("new");
  });

  it("caps maxScore at the next boundary minus one", () => {
    expect(tiers.getTier(500).maxScore).toBe(749);
    expect(tiers.getTier(1000).maxScore).toBe(1000);
  });
});
