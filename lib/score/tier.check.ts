import assert from "node:assert/strict";
import { TierStrategyV1 } from "./tier-strategy";

const strategy = new TierStrategyV1();
assert.equal(strategy.getTier(0).id, "new");
assert.equal(strategy.getTier(249).id, "new");
assert.equal(strategy.getTier(250).id, "emerging");
assert.equal(strategy.getTier(499).id, "emerging");
assert.equal(strategy.getTier(500).id, "established");
assert.equal(strategy.getTier(749).id, "established");
assert.equal(strategy.getTier(750).id, "exceptional");
assert.equal(strategy.getTier(1000).maxScore, 1000);
assert.equal(strategy.getTier(1500).id, "exceptional", "above maximum clamps to top tier");
assert.equal(strategy.getTier(1500).maxScore, 1000, "top tier maxScore stays at configured maxScore");
assert.equal(strategy.getTier(-5).id, "new", "negative score clamps to bottom tier");
const newTier = strategy.getTier(0);
assert.deepEqual({ min: newTier.minScore, max: newTier.maxScore }, { min: 0, max: 250 - 1 });
console.log("tier.check: ok");
