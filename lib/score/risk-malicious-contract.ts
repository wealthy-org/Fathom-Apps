import type { Evaluation } from "@/lib/score/risk";
import type { MaliciousContract } from "@/lib/score/malicious-contract-provider";

/**
 * Malicious Contract Interaction detector (Spec 05). Pure, tanpa I/O.
 *
 * Satu interaksi dengan kontrak terdaftar = detected. Registry kosong =
 * not_evaluable, bukan clear. Temuan menunjuk kontrak terdaftar sebagai
 * evidence; wallet tidak pernah dilabeli "malicious" oleh detector ini.
 */

export function evaluateMaliciousContractInteraction(
  contractCounterparties: string[],
  malicious: MaliciousContract[] | undefined,
): Evaluation {
  if (!malicious) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Malicious-contract source is unavailable.",
      suppliedBy: "curated malicious-contract registry",
    };
  }
  if (malicious.length === 0) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "No malicious-contract source exists yet.",
      suppliedBy: "curated malicious-contract registry",
    };
  }
  const maliciousSet = new Map(malicious.map((m) => [m.address.toLowerCase(), m]));
  const matches = contractCounterparties
    .filter((c) => maliciousSet.has(c.toLowerCase()))
    .map((c) => {
      const m = maliciousSet.get(c.toLowerCase())!;
      return { address: c, source: m.source, reason: m.reason };
    });
  const evidence = {
    contractsChecked: contractCounterparties.length,
    registrySize: malicious.length,
    matches,
  };
  if (matches.length > 0) {
    return { status: "detected", evidence, reason: null, suppliedBy: null };
  }
  return { status: "clear", evidence, reason: null, suppliedBy: null };
}
