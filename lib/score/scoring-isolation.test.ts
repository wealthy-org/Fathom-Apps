import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guard batas arsitektur (Spec 04 section 2.3 + 3.3): risk_detections
 * dan attestation_reactions adalah tabel DISPLAY-ONLY. File scoring
 * inti tidak boleh mengimpornya — risk selalu assessRisk on-the-fly,
 * reaksi tidak pernah menyentuh skor. lib/score/score-refresh.ts
 * dikecualikan: itu persistence boundary yang MENULIS risk_detections.
 */
const SCORING_SOURCES = [
  "lib/score/score-engine.ts",
  "lib/score/score-strategy.ts",
  "lib/score/score-domain.ts",
  "lib/score/tier-strategy.ts",
  "lib/score/score-snapshot.ts",
  "lib/score/dimensions.ts",
  "lib/score/risk.ts",
];

const DISPLAY_ONLY_SYMBOLS = [
  "attestationReactions",
  "riskDetections",
  "attestation_reactions",
  "risk_detections",
];

describe("scoring never reads display-only feed tables", () => {
  for (const file of SCORING_SOURCES) {
    it(`${file} imports no reactions/detections table`, () => {
      const source = readFileSync(file, "utf8");
      for (const symbol of DISPLAY_ONLY_SYMBOLS) {
        expect(source).not.toContain(symbol);
      }
    });
  }
});
