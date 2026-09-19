import { THRESHOLDS } from "@/config/thresholds";
import type { Evaluation } from "@/lib/score/risk";
import type { TrustGraphSummary } from "@/lib/chain/trust-graph";

/**
 * High Sybil Similarity detector (Spec 05). Pure, tanpa I/O.
 *
 * PROVISIONAL: sidik perilaku seragam — kelompok counterparty terbesar dengan
 * (interactionCount, valueSent, valueReceived) identik. Wallet hasil farming
 * bot sering menunjukkan jumlah/nilai seragam ke banyak alamat; detector
 * menandai polanya, bukan pelakunya.
 */

export function evaluateHighSybilSimilarity(graph: TrustGraphSummary): Evaluation {
  if (!graph.complete) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Transaction walk is incomplete, so relationships are lower bounds.",
      suppliedBy: "a deeper indexed walk",
    };
  }
  if (graph.relationships.length < THRESHOLDS.risk.sybilMinSharedCounterparties) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Too few counterparties to judge behavioral similarity.",
      suppliedBy: "more indexed interactions",
    };
  }
  const groups = new Map<string, string[]>();
  for (const rel of graph.relationships) {
    const fingerprint = `${rel.interactionCount}:${rel.valueSent.toString()}:${rel.valueReceived.toString()}`;
    const members = groups.get(fingerprint) ?? [];
    members.push(rel.counterparty);
    groups.set(fingerprint, members);
  }
  let topFingerprint = "";
  let topMembers: string[] = [];
  for (const [fingerprint, members] of groups) {
    if (members.length > topMembers.length) {
      topFingerprint = fingerprint;
      topMembers = members;
    }
  }
  const share = topMembers.length / graph.relationships.length;
  const evidence = {
    relationshipsChecked: graph.relationships.length,
    fingerprint: topFingerprint,
    uniformGroupSize: topMembers.length,
    minGroupSize: THRESHOLDS.risk.sybilMinSharedCounterparties,
    share,
    shareThreshold: THRESHOLDS.risk.sybilMinOverlapShare,
    members: topMembers,
  };
  if (share >= THRESHOLDS.risk.sybilMinOverlapShare) {
    return { status: "detected", evidence, reason: null, suppliedBy: null };
  }
  return { status: "clear", evidence, reason: null, suppliedBy: null };
}
