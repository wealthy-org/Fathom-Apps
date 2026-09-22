import { THRESHOLDS } from "@/config/thresholds";
import type { ScoreResult, SourceState } from "@/lib/score/types";

/**
 * Canonical Reputation Dimensions section (presentation only).
 *
 * Visualizes the existing ScoreStrategyV1 contributions as normalized 0–100
 * bars: `contribution / maxPoints * 100` (risk: `|contribution| / maxPenalty`).
 * The normalized value is a UI visualization, not a new scoring system —
 * raw contributions stay visible per row. No scoring logic lives here.
 */

const MAX = {
  economic_history: THRESHOLDS.score.dimensions.economicHistory.maxPoints,
  counterparty_history: THRESHOLDS.score.dimensions.counterpartyHistory.maxPoints,
  contract_history: THRESHOLDS.score.dimensions.contractHistory.maxPoints,
  community_trust: THRESHOLDS.score.dimensions.communityTrust.maxPoints,
  risk_signals: THRESHOLDS.score.dimensions.riskSignals.maxPenalty,
} as const;

type DimensionId = keyof typeof MAX;

const LABELS: Record<DimensionId, string> = {
  economic_history: "Economic History",
  counterparty_history: "Counterparty History",
  contract_history: "Contract History",
  community_trust: "Community Trust",
  risk_signals: "Risk Signals",
};

/** Fathom semantics per dimension — words for existing behavior, no new meaning. */
const NOTES: Record<DimensionId, string> = {
  economic_history: "Historical economic activity.",
  counterparty_history: "Counterparties and repeated relationships.",
  contract_history: "Verified contract evidence only — not protocol identity.",
  community_trust: "Attestations and vouches where available.",
  risk_signals: "More fill = more observed risk. This is not reputation.",
};

/** ScoreInput fields behind each dimension — words for the engine's inputs, no new meaning. */
const INPUTS: Record<DimensionId, string> = {
  economic_history: "Wallet age · Direct transaction count · Indexed native volume.",
  counterparty_history:
    "Unique counterparties · Repeat counterparties · Longest relationship.",
  contract_history: "Verified contract-history proofs only (capped count).",
  community_trust:
    "Active vouches (stake-weighted, decayed, anti-farming discounted) · Role attestations (capped).",
  risk_signals: "Detected risk signals only — a penalty mechanism, not reputation.",
};
function stateLabel(state: SourceState): string {
  switch (state) {
    case "empty":
      return "No evidence yet";
    case "not_indexed":
      return "Not indexed";
    case "incomplete":
      return "Incomplete data";
    default:
      return "Unavailable";
  }
}

export function ReputationDimensions({
  reputation,
  evidenceHref = "#why-evidence",
}: {
  reputation: ScoreResult;
  /** Where "View evidence" points — "#evidence" from the Overview tab, "#why-evidence" inside the Evidence tab. */
  evidenceHref?: string;
}) {
  const byId = new Map(
    [...reputation.breakdown.dimensions, reputation.breakdown.riskAdjustment].map(
      (dimension) => [dimension.id, dimension] as const,
    ),
  );

  const rows = (Object.keys(MAX) as DimensionId[]).map((id) => {
    const dimension = byId.get(id);
    const availability = reputation.availability;
    // Primary source states behind this dimension (community merges two).
    const states: SourceState[] =
      id === "community_trust"
        ? [availability.vouches.state, availability.attestations.state]
        : id === "economic_history"
          ? [availability.economicHistory.state]
          : id === "counterparty_history"
            ? [availability.counterpartyHistory.state]
            : id === "contract_history"
              ? [availability.contractHistory.state]
              : [availability.riskSignals.state];

    const evaluated = states.some((state) => state === "available");
    const showBar = dimension !== undefined && dimension.available && evaluated;
    const max = MAX[id];
    // ponytail: normalized 0–100 view of the existing contribution; clamps, never new scoring.
    const pct = showBar
      ? Math.min(100, Math.max(0, Math.round((Math.abs(dimension.contribution) / max) * 100)))
      : 0;
    const refCount = showBar
      ? dimension.evidenceReferences.proofs.length +
        dimension.evidenceReferences.direct.length
      : 0;
    // Honest empty slot: worst concrete state wins, "no evidence" only when indexed.
    const status = states.includes("unavailable")
      ? stateLabel("unavailable")
      : states.every((state) => state === "not_indexed")
        ? stateLabel("not_indexed")
        : states.includes("incomplete")
          ? stateLabel("incomplete")
          : stateLabel("empty");

    return { id, dimension, showBar, pct, refCount, status, max };
  });

  return (
    <section aria-label="Reputation Dimensions">
      <h2 className="font-display text-xl font-semibold">Reputation Dimensions</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate400">
        Context behind the global Fathom Score — not a trust decision.
      </p>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
        Fathom Score → Dimensions → Evidence
      </p>

      <div className="panel-brutal mt-5 space-y-6 p-6">
        {rows.map(({ id, dimension, showBar, pct, refCount, status, max }) => {
          if (!showBar || !dimension) {
            return (
              <div
                key={id}
                className="flex flex-col gap-2 sm:grid sm:grid-cols-[200px_1fr_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <div className="font-display text-base">{LABELS[id]}</div>
                  <div className="mt-0.5 text-xs text-slate400">{NOTES[id]}</div>
                </div>
                <div className="min-w-0 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  {status}
                </div>
              </div>
            );
          }
          const isRisk = id === "risk_signals";
          return (
            <details key={id}>
              <summary className="cursor-pointer">
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[200px_1fr_auto] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <div className="font-display text-base">{LABELS[id]}</div>
                    <div className="mt-0.5 text-xs text-slate400">{NOTES[id]}</div>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={LABELS[id]}
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-3 min-w-0 overflow-hidden rounded-full border border-black/10 bg-white"
                  >
                    <div
                      className={`h-full ${isRisk ? "bg-purple" : "bg-accent"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="shrink-0 font-mono text-sm text-ink tabular-nums">
                    {isRisk ? `${dimension.contribution} penalty` : `${pct}/100`}
                  </div>
                </div>
              </summary>
              <div className="mt-3 border-t-2 border-ink/10 pt-3 sm:ml-[216px]">
                <dl className="space-y-2 text-sm">
                  <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-3">
                    <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">Result</dt>
                    <dd className="font-mono text-ink tabular-nums">
                      {isRisk
                        ? `${dimension.contribution} (penalty of max ${max})`
                        : `+${dimension.contribution} of ${max} max pts · ${pct}/100 visual`}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-3">
                    <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">Input</dt>
                    <dd className="text-slate400">{INPUTS[id]}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-3">
                    <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">Calculation</dt>
                    <dd className="text-slate400">
                      Calculated from the available evidence. Subcomponent
                      splits are not shown here — inspect the evidence.
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-3">
                    <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">Weight</dt>
                    <dd className="text-slate400">
                      {isRisk
                        ? `Maximum penalty ${max} — set by Fathom, not this view.`
                        : `Dimension maximum ${max} — set by Fathom, not this view.`}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-sm text-slate400">{dimension.explanation}</p>
                {refCount > 0 && (
                  <a
                    href={evidenceHref}
                    className="mt-1 inline-block font-mono text-[11px] text-accent-ink hover:underline"
                  >
                    Why → evidence ({refCount})
                  </a>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
