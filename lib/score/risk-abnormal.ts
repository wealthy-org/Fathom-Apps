import type { Evaluation } from "@/lib/score/risk";

/**
 * Abnormal Transaction Pattern detector (Spec 05). Pure, tanpa I/O.
 *
 * BLOCKED_BY_PRODUCT_RULE (Spec 05 §abnormal_transaction_pattern): neither PRD
 * nor Spec 05 defines what counts as "abnormal" — no detection rule, no
 * thresholds. Always returns not_evaluable until the rule is specified.
 * TBD values are not guessed; no detection logic is added.
 */

export interface AbnormalTxPoint {
  timestamp: Date | null;
  valueWei: bigint;
  toIsContract: boolean;
}

export function evaluateAbnormalTransactionPattern(
  _txs: AbnormalTxPoint[] | undefined,
): Evaluation {
  return {
    status: "not_evaluable",
    evidence: null,
    reason: "No product rule defines what counts as abnormal.",
    suppliedBy: "Spec 05 detection rule",
  };
}
