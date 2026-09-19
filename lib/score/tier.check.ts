import assert from "node:assert/strict";
import { TierStrategyV1 } from "./tier-strategy";

const strategy = new TierStrategyV1();
assert.equal(strategy.getTier(0).id, "new");
assert.equal(strategy.getTier(250).id, "emerging");
assert.equal(strategy.getTier(500).id, "established");
assert.equal(strategy.getTier(750).id, "exceptional");
assert.equal(strategy.getTier(1000).maxScore, 1000);
console.log("tier.check: ok");
