import type { Evaluation } from "@/lib/score/risk";
import type { FlaggedAddress } from "@/lib/score/flagged-address-provider";

/**
 * Flagged Counterparty Exposure detector (Spec 05). Pure, tanpa I/O.
 *
 * Match-based: satu counterparty yang cocok dengan registry = detected.
 * Registry kosong/belum ada sumber = not_evaluable, bukan clear.
 * Match menunjuk registry-nya sebagai evidence — bukan vonis atas wallet.
 */

export function evaluateFlaggedCounterpartyExposure(
  counterparties: string[],
  flagged: FlaggedAddress[] | undefined,
): Evaluation {
  if (!flagged) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Flagged-address source is unavailable.",
      suppliedBy: "external flagged-address registry",
    };
  }
  if (flagged.length === 0) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "No flagged-address source exists yet.",
      suppliedBy: "external flagged-address registry",
    };
  }
  const flaggedSet = new Map(flagged.map((f) => [f.address.toLowerCase(), f]));
  const matches = counterparties
    .filter((c) => flaggedSet.has(c.toLowerCase()))
    .map((c) => {
      const f = flaggedSet.get(c.toLowerCase())!;
      return { address: c, source: f.source, reason: f.reason };
    });
  const evidence = {
    counterpartiesChecked: counterparties.length,
    registrySize: flagged.length,
    matches,
  };
  if (matches.length > 0) {
    return { status: "detected", evidence, reason: null, suppliedBy: null };
  }
  return { status: "clear", evidence, reason: null, suppliedBy: null };
}
