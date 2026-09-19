import { THRESHOLDS } from "@/config/thresholds";
import type { Evaluation } from "@/lib/score/risk";
import type { VouchSummary } from "@/lib/chain/trust-graph";

/**
 * Suspicious Vouch Clustering detector (Spec 05/08). Pure, tanpa I/O.
 *
 * PROVISIONAL: dua pemicu dari vouch aktif yang sudah diindeks — pasangan
 * resiprokal (A↔B) dan dominasi satu voucher. Vouch resiprokal dicatat,
 * bukan disembunyikan; detector hanya menandai polanya sebagai evidence.
 */

export function evaluateSuspiciousVouchClustering(
  vouches: VouchSummary[] | undefined,
): Evaluation {
  if (!vouches) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Indexed vouch edges are unavailable.",
      suppliedBy: "Spec 08 vouch indexer (vouches table)",
    };
  }
  const active = vouches.filter((v) => v.status === "active");
  if (active.length < THRESHOLDS.risk.vouchMinActive) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Too few active vouches to judge clustering.",
      suppliedBy: "more indexed vouch edges",
    };
  }

  const edges = new Set(active.map((v) => `${v.from}>${v.to}`));
  let reciprocalPairs = 0;
  for (const v of active) {
    if (edges.has(`${v.to}>${v.from}`)) reciprocalPairs += 1;
  }
  reciprocalPairs /= 2;

  const perVoucher = new Map<string, number>();
  for (const v of active) perVoucher.set(v.from, (perVoucher.get(v.from) ?? 0) + 1);
  const [topVoucher, topCount] = [...perVoucher.entries()].reduce((a, b) =>
    b[1] > a[1] ? b : a,
  );
  const topShare = (topCount ?? 0) / active.length;

  const evidence = {
    activeVouches: active.length,
    reciprocalPairs,
    minReciprocalPairs: THRESHOLDS.risk.vouchMinReciprocalPairs,
    topVoucher,
    topShare,
    topShareThreshold: THRESHOLDS.risk.vouchTopShare,
  };

  if (
    reciprocalPairs >= THRESHOLDS.risk.vouchMinReciprocalPairs ||
    topShare >= THRESHOLDS.risk.vouchTopShare
  ) {
    return { status: "detected", evidence, reason: null, suppliedBy: null };
  }
  return { status: "clear", evidence, reason: null, suppliedBy: null };
}
