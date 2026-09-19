import { THRESHOLDS } from "@/config/thresholds";
import type { Evaluation } from "@/lib/score/risk";

/**
 * Abnormal Transaction Pattern detector (Spec 05). Pure, tanpa I/O.
 *
 * PROVISIONAL (Fase 13 tuning): tiga pemicu heuristik dari wallet_transactions
 * yang sudah diindeks — burst dalam jendela geser, nilai outlier
 * (mean + N·stddev), dan dominasi interaksi kontrak. Satu pemicu = detected;
 * evidence selalu menyebut pemicu mana + ambang yang dipakai.
 */

export interface AbnormalTxPoint {
  timestamp: Date | null;
  valueWei: bigint;
  toIsContract: boolean;
}

interface TimedTx {
  time: number;
  value: number;
  toIsContract: boolean;
}

function maxInWindow(sortedTimes: number[], windowMs: number): number {
  let best = 0;
  let start = 0;
  for (let end = 0; end < sortedTimes.length; end += 1) {
    while (sortedTimes[end]! - sortedTimes[start]! > windowMs) start += 1;
    best = Math.max(best, end - start + 1);
  }
  return best;
}

export function evaluateAbnormalTransactionPattern(
  txs: AbnormalTxPoint[] | undefined,
): Evaluation {
  if (!txs) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Transaction rows are unavailable.",
      suppliedBy: "Spec 01 indexed history (wallet_transactions)",
    };
  }
  const timed: TimedTx[] = txs
    .filter((t) => t.timestamp !== null)
    .map((t) => ({
      time: (t.timestamp as Date).getTime(),
      // ponytail: Number() presisi ~15 digit — cukup untuk heuristik outlier,
      // bukan akuntansi. Nilai presisi tetap bigint di evidence mentah lain.
      value: Number(t.valueWei),
      toIsContract: t.toIsContract,
    }));
  if (timed.length < THRESHOLDS.risk.abnormalMinTx) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Too few timestamped transactions to judge a pattern.",
      suppliedBy: "more indexed transactions",
    };
  }

  const times = timed
    .map((t) => t.time)
    .sort((a, b) => a - b);
  const burstCount = maxInWindow(times, THRESHOLDS.risk.abnormalWindowMs);
  const burst = burstCount >= THRESHOLDS.risk.abnormalMaxPerWindow;

  const mean = timed.reduce((s, t) => s + t.value, 0) / timed.length;
  const variance =
    timed.reduce((s, t) => s + (t.value - mean) ** 2, 0) / timed.length;
  const outlierLine = mean + THRESHOLDS.risk.abnormalValueStdDevs * Math.sqrt(variance);
  const outliers = timed.filter((t) => t.value >= outlierLine).length;
  const hasOutlier = outliers > 0 && variance > 0;

  const contractCount = timed.filter((t) => t.toIsContract).length;
  const contractShare = contractCount / timed.length;
  const contractHeavy = contractShare >= THRESHOLDS.risk.abnormalContractShare;

  const evidence = {
    txCount: timed.length,
    burstCount,
    maxPerWindow: THRESHOLDS.risk.abnormalMaxPerWindow,
    windowMs: THRESHOLDS.risk.abnormalWindowMs,
    outlierCount: outliers,
    valueStdDevs: THRESHOLDS.risk.abnormalValueStdDevs,
    contractShare,
    contractShareThreshold: THRESHOLDS.risk.abnormalContractShare,
    triggers: [
      burst ? "burst" : null,
      hasOutlier ? "value_outlier" : null,
      contractHeavy ? "contract_heavy" : null,
    ].filter((t): t is string => t !== null),
  };

  if (burst || hasOutlier || contractHeavy) {
    return { status: "detected", evidence, reason: null, suppliedBy: null };
  }
  return { status: "clear", evidence, reason: null, suppliedBy: null };
}
