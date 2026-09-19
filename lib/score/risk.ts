import { THRESHOLDS } from "@/config/thresholds";
import { explorerAddressUrl } from "@/lib/chain/blockscout";
import type { OnchainStats } from "@/lib/chain/onchain-stats";
import type { TrustGraphSummary } from "@/lib/chain/trust-graph";
import type { Address } from "@/lib/score/types";
import {
  evaluateAbnormalTransactionPattern,
  type AbnormalTxPoint,
} from "@/lib/score/risk-abnormal";
import { evaluateSuspiciousVouchClustering } from "@/lib/score/risk-vouch";
import type { FlaggedAddress } from "@/lib/score/flagged-address-provider";
import { evaluateFlaggedCounterpartyExposure } from "@/lib/score/risk-flagged-exposure";
import type { MaliciousContract } from "@/lib/score/malicious-contract-provider";
import { evaluateMaliciousContractInteraction } from "@/lib/score/risk-malicious-contract";
import { evaluateHighSybilSimilarity } from "@/lib/score/risk-sybil";
import {
  evaluateActiveDisputes,
  type ActiveDisputePoint,
} from "@/lib/score/risk-active-disputes";

/**
 * Risk Engine (Spec 05). Pure, tanpa I/O — sama seperti proofs.ts.
 *
 * Signal dihitung ulang dari data indexed yang sudah dinormalisasi (reproducible),
 * bukan tabel baru. Risiko BUKAN bukti wrongdoing: setiap signal menyertakan
 * evidence-nya sendiri dan tidak pernah melabeli wallet "malicious".
 *
 * Lima detector baru (abnormal, vouch, flagged, malicious-contract, sybil)
 * adalah modul murni yang PROVISIONAL dan config-driven (thresholds.ts);
 * input yang tidak tersedia menghasilkan `not_evaluable`, bukan "clear".
 */

export type RiskSignalType =
  | "fresh_wallet"
  | "abnormal_transaction_pattern"
  | "circular_relationship_graph"
  | "concentrated_counterparty_graph"
  | "suspicious_vouch_clustering"
  | "flagged_counterparty_exposure"
  | "malicious_contract_interaction"
  | "high_sybil_similarity"
  | "active_disputes";

export type RiskSeverity = "low" | "medium" | "high";
export type RiskStatus = "detected" | "clear" | "not_evaluable";

export interface RiskSignal {
  type: RiskSignalType;
  severity: RiskSeverity;
  evidence: Record<string, unknown>;
  evidence_reference: string;
  detected_at: string;
}

export interface RiskState {
  id: RiskSignalType;
  label: string;
  status: RiskStatus;
  severity: RiskSeverity | null;
  evidence: Record<string, unknown> | null;
  evidence_reference: string | null;
  /** Alasan kalau not_evaluable. */
  reason: string | null;
  /** Fase/sumber yang akan menyuplai data (null kalau sudah evaluable). */
  suppliedBy: string | null;
}

interface SignalDefinition {
  id: RiskSignalType;
  label: string;
  severity: RiskSeverity;
}

// Urutan mengikuti Spec 05 §Initial Signals.
const DEFINITIONS: SignalDefinition[] = [
  { id: "fresh_wallet", label: "Fresh wallet", severity: "medium" },
  {
    id: "abnormal_transaction_pattern",
    label: "Abnormal transaction pattern",
    severity: "medium",
  },
  {
    id: "circular_relationship_graph",
    label: "Circular relationship graph",
    severity: "medium",
  },
  {
    id: "concentrated_counterparty_graph",
    label: "Concentrated counterparty graph",
    severity: "low",
  },
  {
    id: "suspicious_vouch_clustering",
    label: "Suspicious vouch clustering",
    severity: "medium",
  },
  {
    id: "flagged_counterparty_exposure",
    label: "Flagged counterparty exposure",
    severity: "medium",
  },
  {
    id: "malicious_contract_interaction",
    label: "Malicious contract interaction",
    severity: "high",
  },
  {
    id: "high_sybil_similarity",
    label: "High sybil similarity",
    severity: "medium",
  },
  {
    id: "active_disputes",
    label: "Active disputes",
    severity: "medium",
  },
];

// Signal yang tidak punya sumber data sekarang. Alasan eksplisit, jangan diisi 0.
// Lima detector baru (abnormal, vouch, flagged, malicious-contract, sybil)
// mengevaluasi apa adanya; input yang tidak tersedia (undefined) tetap
// not_evaluable per detector — bukan clear.
const NOT_EVALUABLE: Partial<Record<RiskSignalType, { reason: string; suppliedBy: string }>> = {};

const MS_PER_DAY = 86_400_000;
const ZERO = BigInt(0);

// Diekspor untuk detector murni (risk-abnormal dkk.) — type-only, tanpa siklus runtime.
export interface Evaluation {
  status: RiskStatus;
  evidence: Record<string, unknown> | null;
  reason: string | null;
  suppliedBy: string | null;
}

/** Umur wallet (hari). Null kalau timestamp pertama tidak diketahui. */
function walletAgeDays(stats: OnchainStats, now: Date): number | null {
  if (!stats.firstTxAt) return null;
  return Math.floor((now.getTime() - stats.firstTxAt.getTime()) / MS_PER_DAY);
}

function evaluateFreshWallet(stats: OnchainStats, now: Date): Evaluation {
  const ageDays = walletAgeDays(stats, now);
  if (ageDays === null) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "No reliable first-transaction timestamp.",
      suppliedBy: "Spec 01 indexed history",
    };
  }

  const evidence = {
    ageDays,
    txCount: stats.txCount,
    maxAgeDays: THRESHOLDS.risk.freshWalletMaxAgeDays,
    maxTxCount: THRESHOLDS.risk.freshWalletMaxTxCount,
  };
  const ageOld = ageDays >= THRESHOLDS.risk.freshWalletMaxAgeDays;
  // txCount null = riwayat terpotong; jangan anggap aktif atau pasif.
  const activeEnough =
    stats.txCount !== null && stats.txCount >= THRESHOLDS.risk.freshWalletMaxTxCount;

  if (ageOld || activeEnough) {
    return { status: "clear", evidence, reason: null, suppliedBy: null };
  }

  return { status: "detected", evidence, reason: null, suppliedBy: null };
}

function evaluateCircular(graph: TrustGraphSummary): Evaluation {
  if (!graph.complete) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Transaction walk is incomplete, so relationships are lower bounds.",
      suppliedBy: "a deeper indexed walk",
    };
  }

  const mutual = graph.relationships.filter(
    (rel) => rel.valueSent > ZERO && rel.valueReceived > ZERO,
  );
  const evidence = {
    mutualCounterparties: mutual.length,
    counterparties: mutual.map((rel) => rel.counterparty),
    minRequired: THRESHOLDS.risk.circularMinMutualCounterparties,
  };

  if (mutual.length >= THRESHOLDS.risk.circularMinMutualCounterparties) {
    return { status: "detected", evidence, reason: null, suppliedBy: null };
  }
  return { status: "clear", evidence, reason: null, suppliedBy: null };
}

function evaluateConcentration(graph: TrustGraphSummary): Evaluation {
  if (!graph.complete) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Transaction walk is incomplete, so relationships are lower bounds.",
      suppliedBy: "a deeper indexed walk",
    };
  }

  if (graph.relationships.length < THRESHOLDS.risk.concentrationMinCounterparties) {
    return {
      status: "not_evaluable",
      evidence: null,
      reason: "Too few counterparties to judge how concentrated the graph is.",
      suppliedBy: "more indexed interactions",
    };
  }

  const counterpartyInteractions = graph.relationships.reduce(
    (sum, rel) => sum + rel.interactionCount,
    0,
  );
  const top = graph.relationships.reduce((best, rel) =>
    rel.interactionCount > best.interactionCount ? rel : best,
  );
  const share =
    counterpartyInteractions === 0
      ? 0
      : top.interactionCount / counterpartyInteractions;

  const evidence = {
    topCounterparty: top.counterparty,
    topInteractions: top.interactionCount,
    counterpartyInteractions,
    share,
    threshold: THRESHOLDS.risk.concentrationTopShare,
  };

  if (share >= THRESHOLDS.risk.concentrationTopShare) {
    return { status: "detected", evidence, reason: null, suppliedBy: null };
  }
  return { status: "clear", evidence, reason: null, suppliedBy: null };
}

export interface RiskAssessment {
  /** Hanya signal yang benar-benar terdeteksi. */
  signals: RiskSignal[];
  /** Kesembilan slot, termasuk yang clear dan not_evaluable. */
  states: RiskState[];
}

/**
 * Input tambahan untuk lima detector baru. Setiap field opsional: undefined =
 * sumber tidak tersedia → detector mengembalikan not_evaluable (bukan clear).
 * assessRisk tetap pure & sinkron; I/O (DB/provider) milik pemanggil.
 */
export interface RiskInputs {
  transactions?: AbnormalTxPoint[];
  flaggedAddresses?: FlaggedAddress[];
  maliciousContracts?: MaliciousContract[];
  /**
   * Dispute terhadap subject (Fase 9, Spec 09). undefined = sumber tidak
   * tersedia → not_evaluable. Kosong = evaluable, tidak ada dispute → clear.
   */
  disputes?: ActiveDisputePoint[];
}

/**
 * Nilai kesembilan risk signal dari data indexed (Spec 05). Setiap signal yang
 * terdeteksi wajib membawa evidence; yang tidak bisa dinilai menyatakan alasannya.
 */
export function assessRisk(
  address: Address,
  stats: OnchainStats,
  graph: TrustGraphSummary,
  now: Date,
  inputs: RiskInputs = {},
): RiskAssessment {
  const reference = explorerAddressUrl(address);
  const detectedAt = now.toISOString();

  const counterparties = graph.relationships.map((rel) => rel.counterparty);
  const contractCounterparties = graph.relationships
    .filter((rel) => rel.isContract)
    .map((rel) => rel.counterparty);

  const evaluated: Partial<Record<RiskSignalType, Evaluation>> = {
    fresh_wallet: evaluateFreshWallet(stats, now),
    abnormal_transaction_pattern: evaluateAbnormalTransactionPattern(
      inputs.transactions,
    ),
    circular_relationship_graph: evaluateCircular(graph),
    concentrated_counterparty_graph: evaluateConcentration(graph),
    suspicious_vouch_clustering: evaluateSuspiciousVouchClustering(graph.vouches),
    flagged_counterparty_exposure: evaluateFlaggedCounterpartyExposure(
      counterparties,
      inputs.flaggedAddresses,
    ),
    malicious_contract_interaction: evaluateMaliciousContractInteraction(
      contractCounterparties,
      inputs.maliciousContracts,
    ),
    high_sybil_similarity: evaluateHighSybilSimilarity(graph),
    active_disputes: evaluateActiveDisputes(inputs.disputes),
  };

  const signals: RiskSignal[] = [];
  const states: RiskState[] = DEFINITIONS.map((definition) => {
    const result = evaluated[definition.id];
    const blocked = NOT_EVALUABLE[definition.id];

    if (!result) {
      return {
        id: definition.id,
        label: definition.label,
        status: "not_evaluable",
        severity: null,
        evidence: null,
        evidence_reference: null,
        reason: blocked?.reason ?? "Not evaluable yet.",
        suppliedBy: blocked?.suppliedBy ?? null,
      };
    }

    if (result.status === "detected" && result.evidence) {
      signals.push({
        type: definition.id,
        severity: definition.severity,
        evidence: result.evidence,
        evidence_reference: reference,
        detected_at: detectedAt,
      });
    }

    return {
      id: definition.id,
      label: definition.label,
      status: result.status,
      severity: result.status === "detected" ? definition.severity : null,
      evidence: result.evidence,
      evidence_reference: result.status === "not_evaluable" ? null : reference,
      reason: result.reason,
      suppliedBy: result.suppliedBy,
    };
  });

  return { signals, states };
}
