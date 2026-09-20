import Link from "next/link";
import { explorerTransactionUrl } from "@/lib/chain/blockscout";
import type { RiskSignalType, RiskState } from "@/lib/score/risk";

/**
 * Risk Signals section (presentation only).
 *
 * Consumes the existing Risk Engine `RiskState[]` — status, evidence,
 * references — and renders it as grouped, expandable, evidence-first cards.
 * No thresholds are recalculated here; threshold values shown come from the
 * evidence records themselves. Trigger sentences are words for those values.
 */

const LABELS: Record<RiskSignalType, string> = {
  fresh_wallet: "Fresh wallet",
  abnormal_transaction_pattern: "Abnormal transaction pattern",
  circular_relationship_graph: "Circular relationship graph",
  concentrated_counterparty_graph: "Concentrated counterparty graph",
  suspicious_vouch_clustering: "Suspicious vouch clustering",
  flagged_counterparty_exposure: "Flagged counterparty exposure",
  malicious_contract_interaction: "Malicious contract interaction",
  high_sybil_similarity: "High sybil similarity",
  active_disputes: "Active disputes",
};

const CATEGORIES: { title: string; ids: RiskSignalType[] }[] = [
  {
    title: "Wallet / Activity",
    ids: ["fresh_wallet", "abnormal_transaction_pattern"],
  },
  {
    title: "Relationship / Graph",
    ids: [
      "circular_relationship_graph",
      "concentrated_counterparty_graph",
      "high_sybil_similarity",
    ],
  },
  {
    title: "Community",
    ids: ["active_disputes", "suspicious_vouch_clustering"],
  },
  {
    title: "External / Curated Sources",
    ids: ["flagged_counterparty_exposure", "malicious_contract_interaction"],
  },
];

/** Signals whose evidence is rooted in the counterparty graph. */
const GRAPH_BACKED: ReadonlySet<RiskSignalType> = new Set([
  "circular_relationship_graph",
  "concentrated_counterparty_graph",
  "high_sybil_similarity",
]);

/** Signals rooted in community records (disputes, vouches). */
const COMMUNITY_BACKED: ReadonlySet<RiskSignalType> = new Set([
  "active_disputes",
  "suspicious_vouch_clustering",
]);

const STATUS_RANK = { detected: 0, not_evaluable: 1, clear: 2 } as const;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** Engine stores shares as 0–1 ratios; keys carrying them get % formatting. */
function isShareKey(key: string): boolean {
  return (
    key === "share" ||
    key === "threshold" ||
    key.toLowerCase().includes("share")
  );
}

function formatScalar(value: string | number | boolean, key: string): string {
  if (typeof value === "number" && isShareKey(key)) {
    return `${Math.round(value * 100)}%`;
  }
  if (key === "windowMs" && typeof value === "number") {
    if (value % 3_600_000 === 0) return `${value / 3_600_000} hour(s)`;
    if (value % 60_000 === 0) return `${value / 60_000} minute(s)`;
    return `${value} ms`;
  }
  return String(value);
}

function num(evidence: Record<string, unknown>, key: string): number | null {
  const value = evidence[key];
  return typeof value === "number" ? value : null;
}

/** "1 counterparty" vs "3 counterparties" — labels, not logic. */
function plural(count: number | null, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * One-line trigger sentence — words for the evidence values, per the
 * detected/clear/not_evaluable semantics. Never a verdict on the wallet.
 */
export function signalSummary(state: RiskState): string {
  const evidence = state.evidence ?? {};
  if (state.status === "not_evaluable") {
    return `${state.reason ?? "Cannot be evaluated yet."}${state.suppliedBy ? ` Will be supplied by ${state.suppliedBy}.` : ""}`;
  }
  const detected = state.status === "detected";
  switch (state.id) {
    case "fresh_wallet": {
      const age = num(evidence, "ageDays");
      const txs = num(evidence, "txCount");
      const maxAge = num(evidence, "maxAgeDays");
      const maxTxs = num(evidence, "maxTxCount");
      return detected
        ? `Wallet is ${age} days old with ${txs} transactions (fresh below ${maxAge} days / ${maxTxs} transactions).`
        : `Wallet age or activity is above the fresh threshold (${maxAge} days / ${maxTxs} transactions).`;
    }
    case "abnormal_transaction_pattern": {
      const txs = num(evidence, "txCount");
      const triggers = Array.isArray(evidence.triggers)
        ? evidence.triggers.filter((t): t is string => typeof t === "string")
        : [];
      const names: Record<string, string> = {
        burst: "burst",
        value_outlier: "value outlier",
        contract_heavy: "contract-heavy",
      };
      return detected
        ? `Triggers fired: ${triggers.map((t) => names[t] ?? t).join(", ")} across ${txs} transactions.`
        : `No burst, value-outlier, or contract-heavy pattern across ${txs} transactions.`;
    }
    case "circular_relationship_graph": {
      const mutual = num(evidence, "mutualCounterparties");
      const min = num(evidence, "minRequired");
      return detected
        ? `${mutual} mutual counterparties (minimum ${min}).`
        : `${mutual} mutual counterparties — below the minimum of ${min}.`;
    }
    case "concentrated_counterparty_graph": {
      const share = num(evidence, "share");
      const total = num(evidence, "counterpartyInteractions");
      const threshold = num(evidence, "threshold");
      const shareText =
        share === null || threshold === null
          ? ""
          : ` Top holds ${Math.round(share * 100)}% of ${total} interactions (threshold ${Math.round(threshold * 100)}%).`;
      return detected
        ? `One counterparty dominates interaction share.${shareText}`
        : `No single counterparty dominates interaction share.${shareText}`;
    }
    case "suspicious_vouch_clustering": {
      const active = num(evidence, "activeVouches");
      const pairs = num(evidence, "reciprocalPairs");
      const minPairs = num(evidence, "minReciprocalPairs");
      const topShare = num(evidence, "topShare");
      const topThreshold = num(evidence, "topShareThreshold");
      if (!detected)
        return `${active} active vouches — no reciprocal-pair or single-voucher dominance.`;
      const parts: string[] = [];
      if (pairs !== null && minPairs !== null && pairs >= minPairs)
        parts.push(`${pairs} reciprocal pair(s) (minimum ${minPairs})`);
      if (topShare !== null && topThreshold !== null && topShare >= topThreshold)
        parts.push(
          `top voucher holds ${Math.round(topShare * 100)}% of ${active} active vouches (threshold ${Math.round(topThreshold * 100)}%)`,
        );
      if (parts.length > 0) return `Clustering pattern: ${parts.join(" · ")}.`;
      return `${active} active vouches with a clustering pattern — see evidence.`;
    }
    case "flagged_counterparty_exposure": {
      const matches = Array.isArray(evidence.matches) ? evidence.matches.length : 0;
      const checked = num(evidence, "counterpartiesChecked");
      return detected
        ? `${plural(matches, "counterparty matches", "counterparties match")} the flagged registry (${checked} checked).`
        : `No flagged-registry match across ${checked} counterparties.`;
    }
    case "malicious_contract_interaction": {
      const matches = Array.isArray(evidence.matches) ? evidence.matches.length : 0;
      const checked = num(evidence, "contractsChecked");
      return detected
        ? `${plural(matches, "contract interaction matches", "contract interactions match")} the curated registry (${checked} checked).`
        : `No curated-registry match across ${checked} contract interactions.`;
    }
    case "high_sybil_similarity": {
      const size = num(evidence, "uniformGroupSize");
      const checked = num(evidence, "relationshipsChecked");
      const share = num(evidence, "share");
      const threshold = num(evidence, "shareThreshold");
      const detail =
        share === null || threshold === null
          ? ""
          : ` (${Math.round(share * 100)}%; threshold ${Math.round(threshold * 100)}%)`;
      return detected
        ? `Largest uniform-behavior group: ${size} of ${checked} relationships${detail}.`
        : `Largest uniform-behavior group stays below threshold: ${size} of ${checked} relationships${detail}.`;
    }
    case "active_disputes": {
      const active = num(evidence, "activeDisputes");
      const total = num(evidence, "totalDisputes");
      return detected
        ? `${active} active of ${total} disputes — claims, not verdicts.`
        : `No active disputes (${total} total).`;
    }
  }
}

function AddressLink({ address }: { address: string }) {
  return (
    <Link
      href={`/wallets/${address}`}
      className="text-accent-ink hover:underline"
    >
      {shortAddress(address)}
    </Link>
  );
}

function EvidenceValue({
  value,
  label,
}: {
  value: unknown;
  label: string;
}) {
  if (value === null || value === undefined) return <>—</>;
  if (isAddress(value)) return <AddressLink address={value} />;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return <>{formatScalar(value, label)}</>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <>none</>;
    // Registry matches: { address, source, reason }.
    if (
      value.every(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          "address" in item &&
          "source" in item,
      )
    ) {
      return (
        <ul className="space-y-1">
          {(value as { address: string; source: string; reason?: unknown }[]).map(
            (item) => (
              <li key={item.address} className="flex flex-wrap gap-x-2">
                {isAddress(item.address) ? (
                  <AddressLink address={item.address} />
                ) : (
                  <span>{String(item.address)}</span>
                )}
                <span className="text-slate400">
                  · {item.source}
                  {typeof item.reason === "string" && item.reason
                    ? ` — ${item.reason}`
                    : ""}
                </span>
              </li>
            ),
          )}
        </ul>
      );
    }
    // Dispute points: { reporter, status, registryId?, txHash? }.
    if (
      value.every(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          "reporter" in item &&
          "status" in item,
      )
    ) {
      return (
        <ul className="space-y-1">
          {(
            value as {
              reporter: string;
              status: string;
              registryId?: string;
              txHash?: string;
            }[]
          ).map((item, i) => (
            <li key={`${item.reporter}-${i}`} className="flex flex-wrap gap-x-2">
              {isAddress(item.reporter) ? (
                <AddressLink address={item.reporter} />
              ) : (
                <span>{String(item.reporter)}</span>
              )}
              <span className="text-slate400">· {item.status}</span>
              {typeof item.txHash === "string" && (
                <a
                  href={explorerTransactionUrl(item.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-ink hover:underline"
                >
                  {shortAddress(item.txHash)}
                </a>
              )}
            </li>
          ))}
        </ul>
      );
    }
    // Address lists (counterparties, members): link first few, count the rest.
    if (value.every((item) => isAddress(item))) {
      const shown = (value as string[]).slice(0, 3);
      return (
        <span className="flex flex-wrap gap-x-3">
          {shown.map((address) => (
            <AddressLink key={address} address={address} />
          ))}
          {value.length > shown.length && (
            <span className="text-slate400">+ {value.length - shown.length} more</span>
          )}
        </span>
      );
    }
    return <>{value.map((item) => String(item)).join(", ")}</>;
  }
  if (typeof value === "object") return <>{JSON.stringify(value)}</>;
  return <>{String(value)}</>;
}

/** Detail rows for the expanded card — engine keys, human labels, no new math. */
export function evidenceRows(
  state: RiskState,
): { label: string; value: unknown }[] {
  const evidence = state.evidence;
  if (!evidence) return [];
  const PRETTY: Record<string, string> = {
    ageDays: "Age",
    txCount: "Transaction count",
    maxAgeDays: "Fresh threshold (age)",
    maxTxCount: "Fresh threshold (transactions)",
    burstCount: "Max tx in window",
    maxPerWindow: "Burst threshold",
    windowMs: "Window",
    outlierCount: "Value outliers",
    valueStdDevs: "Outlier line (std devs)",
    contractShare: "Contract share",
    contractShareThreshold: "Contract-share threshold",
    triggers: "Triggers fired",
    mutualCounterparties: "Mutual counterparties",
    counterparties: "Mutual counterparties",
    minRequired: "Minimum required",
    topCounterparty: "Top counterparty",
    topInteractions: "Top interactions",
    counterpartyInteractions: "Total interactions",
    share: "Share",
    threshold: "Threshold",
    activeVouches: "Active vouches",
    reciprocalPairs: "Reciprocal pairs",
    minReciprocalPairs: "Minimum pairs",
    topVoucher: "Top voucher",
    topShare: "Top voucher share",
    topShareThreshold: "Top-share threshold",
    counterpartiesChecked: "Counterparties checked",
    contractsChecked: "Contracts checked",
    registrySize: "Registry size",
    matches: "Matches",
    relationshipsChecked: "Relationships checked",
    fingerprint: "Uniform fingerprint",
    uniformGroupSize: "Uniform group size",
    minGroupSize: "Minimum group size",
    shareThreshold: "Share threshold",
    members: "Uniform group",
    activeDisputes: "Active disputes",
    totalDisputes: "Total disputes",
    disputes: "Active dispute records",
  };
  // ponytail: engine key order is already meaningful — no re-sorting.
  return Object.entries(evidence).map(([key, value]) => ({
    label: PRETTY[key] ?? key,
    value,
  }));
}

function StatusChip({ state }: { state: RiskState }) {
  const config = {
    detected: { mark: "●", text: "Detected", className: "text-accent-ink" },
    clear: { mark: "✓", text: "Clear", className: "text-slate400" },
    not_evaluable: { mark: "—", text: "Not evaluable", className: "text-ink/40" },
  } as const;
  const { mark, text, className } = config[state.status];
  return (
    <span
      className={`chip-mono ${className}`}
      aria-label={`Status: ${text}`}
    >
      {mark} {text}
    </span>
  );
}

function SignalCard({ state }: { state: RiskState }) {
  const rows = evidenceRows(state);
  return (
    <details className="panel-brutal p-5">
      <summary className="cursor-pointer">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-display text-base">
            {LABELS[state.id]}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {state.status === "detected" && state.severity && (
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
                {state.severity} severity
              </span>
            )}
            <StatusChip state={state} />
          </span>
        </div>
        <p className="mt-2 text-sm text-slate400">{signalSummary(state)}</p>
      </summary>
      <div className="mt-4 border-t-2 border-ink/10 pt-4">
        {rows.length > 0 ? (
          <dl className="space-y-2 font-mono text-[12px]">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[220px_1fr] sm:gap-3">
                <dt className="uppercase tracking-[0.12em] text-slate400">
                  {row.label}
                </dt>
                <dd className="min-w-0 break-all text-ink">
                  <EvidenceValue value={row.value} label={row.label} />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate400">
            No structured evidence for this signal.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {state.evidence_reference && (
            <a
              href={state.evidence_reference}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-accent-ink hover:underline"
            >
              View evidence →
            </a>
          )}
          {GRAPH_BACKED.has(state.id) && (
            <a
              href="#graph"
              className="font-mono text-[11px] text-accent-ink hover:underline"
            >
              View graph →
            </a>
          )}
          {COMMUNITY_BACKED.has(state.id) && (
            <a
              href="#community"
              className="font-mono text-[11px] text-accent-ink hover:underline"
            >
              Open community →
            </a>
          )}
        </div>
      </div>
    </details>
  );
}

export function RiskSignals({ states }: { states: RiskState[] }) {
  const byId = new Map(states.map((state) => [state.id, state]));
  const detectedCount = states.filter((s) => s.status === "detected").length;
  const clearCount = states.filter((s) => s.status === "clear").length;
  const notEvaluableCount = states.filter(
    (s) => s.status === "not_evaluable",
  ).length;

  return (
    <section id="risk" aria-label="Risk Signals">
      <h2 className="font-display text-lg">Risk Signals</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate400">
        Evidence that may require further inspection.
      </p>
      <p className="mt-1 max-w-2xl text-sm text-slate400">
        These signals describe observed patterns in indexed data. They are not
        proof of wrongdoing and do not determine whether a wallet should be
        trusted. Risk is kept separate from reputation: reputation shows what
        history and relationships exist; risk flags patterns worth a second look.
      </p>

      <div className="panel-brutal mt-5 p-6">
        <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-sm">
          <span>
            <span className="text-accent-ink tabular-nums">{detectedCount}</span>{" "}
            <span className="text-slate400">detected</span>
          </span>
          <span>
            <span className="text-ink tabular-nums">{clearCount}</span>{" "}
            <span className="text-slate400">clear</span>
          </span>
          <span>
            <span className="text-ink tabular-nums">{notEvaluableCount}</span>{" "}
            <span className="text-slate400">not evaluable</span>
          </span>
        </div>
        {detectedCount === 0 && (
          <div className="mt-4 border-t-2 border-ink/10 pt-4">
            <p className="font-display text-base">No risk signals detected</p>
            <p className="mt-1 text-sm text-slate400">
              The currently evaluated rules did not identify any risk pattern
              in the indexed evidence. This does not mean the wallet is
              guaranteed safe.
              {notEvaluableCount > 0 &&
                ` ${notEvaluableCount} signal${notEvaluableCount === 1 ? "" : "s"} could not be evaluated because required data is unavailable — see below.`}
            </p>
          </div>
        )}
      </div>

      {CATEGORIES.map((category) => {
        const cards = category.ids
          .map((id) => byId.get(id))
          .filter((state): state is RiskState => state !== undefined)
          .sort(
            (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
          );
        if (cards.length === 0) return null;
        return (
          <div key={category.title} className="mt-8">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
              {category.title}
            </h3>
            <div className="mt-3 space-y-3">
              {cards.map((state) => (
                <SignalCard key={state.id} state={state} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
