import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { normalizeAddress } from "@/lib/chain/address";
import { explorerTransactionUrl } from "@/lib/chain/blockscout";
import type { TrustGraphSummary } from "@/lib/chain/trust-graph";
import { getWalletProfile, type WalletProfile } from "@/lib/wallet/profile";
import type { Proof, ProofType } from "@/lib/score/proofs";
import type { DimensionState } from "@/lib/score/dimensions";
import type { RiskState, RiskSignal, RiskSignalType } from "@/lib/score/risk";
import type { Address } from "@/lib/score/types";
import { WalletShell } from "@/components/wallet-shell";
import { CopyAddress } from "@/components/copy-address";
import { AliasEditor } from "@/components/alias-editor";
import { AttestationForm } from "@/components/attestation-form";
import { DisputeForm } from "@/components/dispute-form";
import { TrustGraphVisualization } from "@/components/trust-graph-visualization";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

const PROOF_LABELS: Record<ProofType, string> = {
  wallet_age: "Wallet age",
  transaction_history: "Transaction history",
  unique_counterparty: "Unique counterparties",
  repeat_counterparty: "Repeat counterparties",
  economic_history: "Economic history",
  contract_history: "Contract history",
  protocol_history: "Protocol history",
  role_attestation: "Role attestation",
};

const RISK_LABELS: Record<RiskSignalType, string> = {
  fresh_wallet: "Fresh wallet",
  abnormal_transaction_pattern: "Abnormal transaction pattern",
  circular_relationship_graph: "Circular relationship graph",
  concentrated_counterparty_graph: "Concentrated counterparty graph",
  suspicious_vouch_clustering: "Suspicious vouch clustering",
  flagged_counterparty_exposure: "Flagged counterparty exposure",
  malicious_contract_interaction: "Malicious contract interaction",
  high_sybil_similarity: "High sybil similarity",
};

/** Ringkas evidence risk signal untuk tampilan — hanya field primitif. */
function formatRiskEvidence(evidence: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(evidence)) {
    if (Array.isArray(value)) {
      parts.push(`${key}: ${value.length} item${value.length === 1 ? "" : "s"}`);
    } else if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.join(" · ");
}

const WEI_PER_ETH = BigInt(10) ** BigInt(18);

/** Format nilai wei ke native unit untuk tampilan (AGENTS §9: hanya di boundary presentasi). */
function formatNative(wei: string): string {
  try {
    const value = BigInt(wei);
    const whole = value / WEI_PER_ETH;
    const fraction = value % WEI_PER_ETH;
    if (fraction === BigInt(0)) return `${whole} ETH`;
    const padded = fraction.toString().padStart(18, "0").replace(/0+$/, "");
    return `${whole}.${padded} ETH`;
  } catch {
    return `${wei} wei`;
  }
}

function formatProofValue(proof: Proof): string {
  switch (proof.type) {
    case "wallet_age": {
      const { ageDays } = proof.value as { ageDays: number };
      return `${ageDays} days since first transaction`;
    }
    case "transaction_history": {
      const { txCount } = proof.value as { txCount: number };
      return `${txCount} direct transactions`;
    }
    case "unique_counterparty": {
      const { uniqueCounterparties } = proof.value as { uniqueCounterparties: number };
      return `${uniqueCounterparties} unique counterparties`;
    }
    case "repeat_counterparty": {
      const { repeatCounterparties, minInteractions } = proof.value as {
        repeatCounterparties: number;
        minInteractions: number;
      };
      return `${repeatCounterparties} counterparties with ${minInteractions}+ interactions`;
    }
    case "economic_history": {
      const { nativeSentWei, nativeReceivedWei } = proof.value as {
        nativeSentWei: string;
        nativeReceivedWei: string;
      };
      return `Sent ${formatNative(nativeSentWei)} · Received ${formatNative(nativeReceivedWei)}`;
    }
    case "contract_history": {
      const { contractCounterparties } = proof.value as {
        contractCounterparties: number;
      };
      return `${contractCounterparties} contract counterparties`;
    }
    case "protocol_history": {
      const { protocolName, source } = proof.value as {
        protocolName: string;
        source: string;
      };
      return `${protocolName} · verified via ${source}`;
    }
    case "role_attestation": {
      const { role, relationship, durationMonths, attester } = proof.value as {
        role: string;
        relationship: string;
        durationMonths: number | null;
        attester: string;
      };
      const duration =
        durationMonths === null ? "" : ` · ${durationMonths} months`;
      return `${role} · ${relationship}${duration} · by ${shortAddress(attester)}`;
    }
  }
}

/** One-sentence claim per proof — words for what the code already asserts, no new semantics. */
const PROOF_CLAIM: Record<ProofType, string> = {
  wallet_age:
    "Fathom claims this wallet has a known on-chain age, measured from its earliest indexed transaction.",
  transaction_history:
    "Fathom claims this many direct transactions involving the wallet, as counted from indexed history.",
  unique_counterparty:
    "Fathom claims this many distinct counterparties, derived from a complete transaction walk.",
  repeat_counterparty:
    "Fathom claims this many counterparties interacted with repeatedly — at least the interaction threshold shown.",
  economic_history:
    "Fathom claims these native sent/received totals, summed across direct transfers.",
  contract_history:
    "Fathom claims this many contract counterparties — contract identity only, never named protocols.",
  protocol_history:
    "Fathom claims this wallet interacted with this named protocol, per a verified Fathom protocol mapping.",
  role_attestation:
    "Fathom claims another wallet signed this structured attestation about the subject.",
};

/** How each value is produced — derivation plus its important limitation. */
const PROOF_DERIVATION: Record<ProofType, string> = {
  wallet_age:
    "Age is the whole-day difference between today and the earliest first-transaction timestamp from indexed history. If no first transaction is indexed, no wallet_age proof is emitted.",
  transaction_history:
    "Counted by walking indexed per-address transactions where the wallet is sender or receiver. Internal transactions and token transfers are out of scope. A null count (pagination cap exceeded) suppresses this proof entirely.",
  unique_counterparty:
    "Counted from counterparty relationships derived from the transaction walk. Emitted only when the walk is complete — otherwise the count would be a lower bound and the proof is suppressed.",
  repeat_counterparty:
    "Relationships whose interaction count meets the repeat threshold. Same complete-walk requirement as unique counterparties.",
  economic_history:
    "Summed per-counterparty sent/received across direct native transfers. Contract creations and self-transfers are excluded by derivation; internal and token transfers are out of scope.",
  contract_history:
    "Counterparties flagged as contracts by the indexed source. This is contract identity, not protocol identity — do not read these as named protocols.",
  protocol_history:
    "One proof per verified protocol mapping covering an interacted contract. Emitted only when the walk is complete and a verified mapping exists — without one, no protocol_history proof is emitted and the contract stays under contract_history.",
  role_attestation:
    "Recorded from a stored signed attestation. The message and signature are inspectable and re-verifiable in the Attestations section below.",
};

/** Max supporting rows shown per proof — display truncation, not a scoring parameter. */
const MAX_DETAIL_ROWS = 8;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Small explorer link used inside proof detail tables. */
function TxLink({ hash, label }: { hash: string; label: string }) {
  return (
    <a
      href={explorerTransactionUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className="rounded border border-ink/15 px-2 py-0.5 font-mono text-[10px] text-ink/70 hover:border-accent-ink/30 hover:text-accent-ink"
    >
      {label}
    </a>
  );
}

/** Per-proof supporting evidence — representative data for inspection, never a second proof of the aggregate. */
function ProofSupporting({
  proof,
  graph,
}: {
  proof: Proof;
  graph: TrustGraphSummary;
}) {
  const txLevel = (proof.evidence_references ?? []).length > 0;

  switch (proof.type) {
    case "wallet_age": {
      const { firstTxAt } = proof.value as { firstTxAt: string };
      return (
        <div className="space-y-1">
          <p>Earliest indexed transaction: {formatDate(firstTxAt)}.</p>
          {txLevel ? (
            <p>
              Representative supporting transaction:{" "}
              <a
                href={proof.evidence_reference}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] text-accent-ink hover:underline"
              >
                open transaction
              </a>{" "}
              — it supports the age claim but is{" "}
              <span className="text-ink">
                not proven to be the first transaction
              </span>
              .
            </p>
          ) : (
            <p>
              No transaction hash is indexed for this wallet yet, so the claim
              falls back to address-level evidence above.
            </p>
          )}
        </div>
      );
    }
    case "transaction_history": {
      const { txCount } = proof.value as { txCount: number };
      return (
        <div className="space-y-1">
          <p>
            Direct transactions where this wallet is sender or receiver — not
            internal or token transfers.
          </p>
          {txLevel ? (
            <p>
              The transaction links above are representative supporting
              transactions: they allow inspection but do{" "}
              <span className="text-ink">
                not independently prove the total of {txCount}
              </span>
              .
              {!graph.complete &&
                " Historical coverage is incomplete for this wallet."}
            </p>
          ) : (
            <p>
              No transaction hashes are indexed for this wallet yet, so the
              claim falls back to address-level evidence above.
            </p>
          )}
        </div>
      );
    }
    case "unique_counterparty": {
      const total = graph.relationships.length;
      const rows = graph.relationships.slice(0, MAX_DETAIL_ROWS);
      return (
        <div className="space-y-2">
          <p>
            {total} distinct counterparties from a complete walk. Showing{" "}
            {rows.length} of {total} — each link opens that
            counterparty&apos;s Fathom profile. Displayed rows are a viewing
            subset for inspection, not a separate count.
          </p>
          <ul className="space-y-1 font-mono text-[11px]">
            {rows.map((rel) => (
              <li key={rel.counterparty} className="flex flex-wrap gap-x-3">
                <Link
                  href={`/wallets/${rel.counterparty}`}
                  className="text-accent-ink hover:underline"
                >
                  {shortAddress(rel.counterparty)}
                </Link>
                <span className="text-slate400">
                  {rel.interactionCount} interactions
                  {rel.isContract ? " · contract" : ""}
                </span>
              </li>
            ))}
          </ul>
          {total > rows.length && <p>+ {total - rows.length} more.</p>}
        </div>
      );
    }
    case "repeat_counterparty": {
      const { minInteractions } = proof.value as { minInteractions: number };
      const repeated = graph.relationships.filter(
        (r) => r.interactionCount >= minInteractions,
      );
      const rows = repeated.slice(0, MAX_DETAIL_ROWS);
      return (
        <div className="space-y-2">
          <p>
            {repeated.length} counterparties with {minInteractions}+
            interactions. Showing {rows.length} of {repeated.length}.
          </p>
          <ul className="space-y-2 font-mono text-[11px]">
            {rows.map((rel) => (
              <li key={rel.counterparty} className="space-y-1">
                <span className="flex flex-wrap gap-x-3">
                  <Link
                    href={`/wallets/${rel.counterparty}`}
                    className="text-accent-ink hover:underline"
                  >
                    {shortAddress(rel.counterparty)}
                  </Link>
                  <span className="text-slate400">
                    {rel.interactionCount} interactions · first{" "}
                    {formatDate(
                      rel.firstInteractionAt
                        ? rel.firstInteractionAt.toISOString()
                        : null,
                    )}{" "}
                    · last{" "}
                    {formatDate(
                      rel.lastInteractionAt
                        ? rel.lastInteractionAt.toISOString()
                        : null,
                    )}
                    {rel.durationDays !== null &&
                      ` · ${rel.durationDays} days`}
                  </span>
                </span>
                {rel.txHashes.length > 0 && (
                  <span className="flex flex-wrap gap-2">
                    {rel.txHashes.slice(0, 5).map((hash, i) => (
                      <TxLink key={hash} hash={hash} label={`tx ${i + 1}`} />
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {repeated.length > rows.length && (
            <p>+ {repeated.length - rows.length} more.</p>
          )}
        </div>
      );
    }
    case "economic_history": {
      const ranked = [...graph.relationships]
        .sort((a, b) => {
          const totalA = a.valueSent + a.valueReceived;
          const totalB = b.valueSent + b.valueReceived;
          return totalA > totalB ? -1 : totalA < totalB ? 1 : 0;
        })
        .slice(0, MAX_DETAIL_ROWS);
      return (
        <div className="space-y-2">
          <p>
            Totals are summed across all direct relationships. Largest{" "}
            {ranked.length} counterparties by volume:
          </p>
          <ul className="space-y-2 font-mono text-[11px]">
            {ranked.map((rel) => (
              <li key={rel.counterparty} className="space-y-1">
                <span className="flex flex-wrap gap-x-3">
                  <Link
                    href={`/wallets/${rel.counterparty}`}
                    className="text-accent-ink hover:underline"
                  >
                    {shortAddress(rel.counterparty)}
                  </Link>
                  <span className="text-slate400">
                    sent {formatNative(rel.valueSent.toString())} · received{" "}
                    {formatNative(rel.valueReceived.toString())}
                  </span>
                </span>
                {rel.txHashes.length > 0 && (
                  <span className="flex flex-wrap gap-2">
                    {rel.txHashes.slice(0, 5).map((hash, i) => (
                      <TxLink key={hash} hash={hash} label={`tx ${i + 1}`} />
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {graph.relationships.length > ranked.length && (
            <p>+ {graph.relationships.length - ranked.length} more.</p>
          )}
        </div>
      );
    }
    case "contract_history": {
      const contracts = graph.relationships.filter((r) => r.isContract);
      const rows = contracts.slice(0, MAX_DETAIL_ROWS);
      return (
        <div className="space-y-2">
          <p>
            {contracts.length} contract counterparties (identity only — not
            named protocols). Showing {rows.length} of {contracts.length}.
          </p>
          <ul className="space-y-1 font-mono text-[11px]">
            {rows.map((rel) => (
              <li key={rel.counterparty} className="flex flex-wrap gap-x-3">
                <Link
                  href={`/wallets/${rel.counterparty}`}
                  className="text-accent-ink hover:underline"
                >
                  {shortAddress(rel.counterparty)}
                </Link>
                <span className="text-slate400">
                  {rel.interactionCount} interactions
                </span>
              </li>
            ))}
          </ul>
          {contracts.length > rows.length && (
            <p>+ {contracts.length - rows.length} more.</p>
          )}
        </div>
      );
    }
    case "role_attestation": {
      return (
        <p>
          This claim comes from a signed attestation. Inspect and re-verify the
          message and signature in the{" "}
          <a
            href="#attestations"
            className="font-mono text-[11px] text-accent-ink hover:underline"
          >
            Attestations section
          </a>
          .
        </p>
      );
    }
  }
}

/**
 * Inline expandable proof detail: Claim → Derivation → Verification →
 * Supporting evidence. Explorer links stay on the card itself. All content is
 * words for data already on the page — no new queries, no new semantics.
 */
function ProofDetail({
  proof,
  graph,
}: {
  proof: Proof;
  graph: TrustGraphSummary;
}) {
  return (
    <details className="mt-3 rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3">
      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-slate400 hover:text-accent-ink">
        Proof detail
      </summary>
      <div className="mt-3 space-y-3 text-sm text-slate400">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em]">
            Claim
          </div>
          <p className="mt-1 text-ink">{PROOF_CLAIM[proof.type]}</p>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em]">
            How it was derived
          </div>
          <p className="mt-1">{PROOF_DERIVATION[proof.type]}</p>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em]">
            Verification
          </div>
          <p className="mt-1 font-mono text-[11px]">
            source: {proof.source} · method: {proof.verification_method} ·
            confidence: {proof.confidence} (static per method — a deeper
            reference does not raise confidence)
          </p>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em]">
            Supporting evidence
          </div>
          <div className="mt-1">
            <ProofSupporting proof={proof} graph={graph} />
          </div>
        </div>
      </div>
    </details>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "Not available";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function Field({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="shine-border rounded-2xl border border-ink/10 bg-ink/[0.03] p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl">{value}</div>
      {note && <div className="mt-1 text-xs text-slate400">{note}</div>}
    </div>
  );
}

function DimensionRow({ dimension }: { dimension: DimensionState }) {
  return (
    <li className="shine-border rounded-2xl border border-ink/10 bg-ink/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-base">{dimension.label}</span>
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
            dimension.status === "supported" ? "text-accent-ink" : "text-slate400"
          }`}
        >
          {dimension.status}
        </span>
      </div>
      {dimension.status === "supported" ? (
        <p className="mt-2 text-sm text-slate400">
          {dimension.proofTypes.length > 0
            ? `Backed by proofs: ${dimension.proofTypes.join(", ")}.`
            : "Backed by dedicated risk signals."}
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate400">{dimension.reason}</p>
      )}
    </li>
  );
}

function AttestationsSection({
  address,
  attestations,
}: {
  address: string;
  attestations: WalletProfile["attestations"];
}) {
  return (
    <section id="attestations" className="mt-10">
      <h2 className="font-display text-lg">Attestations</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate400">
        Structured, signed claims from other wallets. Attestations are
        supporting evidence — they never replace on-chain behavior, and they do
        not create reputation on their own.
      </p>

      {attestations.length === 0 ? (
        <div className="shine-border mt-5 rounded-2xl border border-ink/10 bg-ink/[0.03] p-6 text-sm text-slate400">
          No attestations for this wallet yet.
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {attestations.map((attestation) => (
            <li
              key={attestation.id}
              className="shine-border rounded-2xl border border-ink/10 bg-ink/[0.03] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-base">
                  {attestation.role}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-ink">
                  signed
                </span>
              </div>
              <p className="mt-2 text-sm text-ink">
                {attestation.relationship}
                {attestation.durationMonths !== null &&
                  ` · ${attestation.durationMonths} months`}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-slate400">
                <span>
                  attester:{" "}
                  <Link
                    href={`/wallets/${attestation.attester}`}
                    className="text-accent-ink hover:underline"
                  >
                    {shortAddress(attestation.attester)}
                  </Link>
                </span>
                <span>at: {formatDate(attestation.createdAt)}</span>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate400">
                  Verify signature
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] text-slate400">
                  {attestation.message}
                  {"\n"}
                  {attestation.signature}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}

      <AttestationForm subject={address} />
    </section>
  );
}

function DisputesSection({
  address,
  disputes,
}: {
  address: string;
  disputes: WalletProfile["disputes"];
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg">Disputes</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate400">
        Signed reports filed against this wallet. A dispute is a claim, not
        proof of wrongdoing — it never changes reputation or risk here. No
        resolution process exists yet, so every dispute stays open.
      </p>

      {disputes.length === 0 ? (
        <div className="shine-border mt-5 rounded-2xl border border-ink/10 bg-ink/[0.03] p-6 text-sm text-slate400">
          No disputes filed against this wallet.
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {disputes.map((dispute) => (
            <li
              key={dispute.id}
              className="shine-border rounded-2xl border border-ink/10 bg-ink/[0.03] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-base">{dispute.reason}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
                  {dispute.status}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">
                {dispute.evidence}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-slate400">
                <span>
                  reporter:{" "}
                  <Link
                    href={`/wallets/${dispute.reporter}`}
                    className="text-accent-ink hover:underline"
                  >
                    {shortAddress(dispute.reporter)}
                  </Link>
                </span>
                <span>at: {formatDate(dispute.openedAt)}</span>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate400">
                  Verify signature
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] text-slate400">
                  {dispute.message}
                  {"\n"}
                  {dispute.signature}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}

      <DisputeForm target={address} />
    </section>
  );
}

function VouchesSection({
  address,
  vouches,
  vouchIndex,
}: {
  address: string;
  vouches: WalletProfile["trustGraph"]["vouches"];
  vouchIndex: WalletProfile["vouchIndex"];
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg">Vouches</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate400">
        On-chain vouch edges indexed from the Fathom registry (Spec 08). A
        vouch is economic-backing evidence — it never creates reputation score
        on its own, and reciprocal vouches are recorded, not hidden.
      </p>

      {vouchIndex === null ? (
        <div className="shine-border mt-5 rounded-2xl border border-ink/10 bg-ink/[0.03] p-6 text-sm text-slate400">
          Vouch index has not run yet — absence of vouches below means not
          indexed, not zero.
        </div>
      ) : (
        <>
          <p className="mt-3 font-mono text-[11px] text-slate400">
            Registry indexed through block {vouchIndex.lastBlock}
            {vouchIndex.status !== null && ` · status: ${vouchIndex.status}`}
          </p>
          {vouches.length === 0 ? (
            <div className="shine-border mt-4 rounded-2xl border border-ink/10 bg-ink/[0.03] p-6 text-sm text-slate400">
              No vouch edges involving this wallet — confirmed by the index,
              not missing data.
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {vouches.map((vouch, i) => {
                const received = vouch.to === address;
                const other = received ? vouch.from : vouch.to;
                return (
                  <li
                    key={`${vouch.from}-${vouch.to}-${i}`}
                    className="shine-border rounded-2xl border border-ink/10 bg-ink/[0.03] p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-base">
                        {received ? "Vouch received" : "Vouch given"}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
                        {vouch.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-slate400">
                      <span>
                        {received ? "from" : "to"}:{" "}
                        <Link
                          href={`/wallets/${other}`}
                          className="text-accent-ink hover:underline"
                        >
                          {shortAddress(other)}
                        </Link>
                      </span>
                      <span>stake: {vouch.stakeAmount.toString()} wei</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function TrustGraphSection({
  graph,
  address,
}: {
  graph: WalletProfile["trustGraph"];
  address: Address;
}) {
  const prefix = graph.complete ? "" : "At least ";
  const identifiedProtocols = new Set(
    graph.relationships
      .map((r) => r.protocolId)
      .filter((id): id is string => id !== null),
  ).size;
  // Edge sosial Fase 3 — count langsung dari baris tabel, bukan estimasi.
  const openDisputes = graph.disputes.filter((d) => d.status === "open").length;
  const activeVouches = graph.vouches.filter((v) => v.status === "active").length;
  const hasSocial =
    graph.attesters.length > 0 ||
    graph.disputes.length > 0 ||
    graph.vouches.length > 0 ||
    graph.invitedBy !== null;
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg">Trust Graph Summary</h2>
      <TrustGraphVisualization graph={graph} address={address} />
      {graph.relationships.length > 0 && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Unique counterparties"
              value={`${prefix}${graph.uniqueCounterparties}`}
            />
            <Field
              label="Repeat counterparties"
              value={`${prefix}${graph.repeatCounterparties}`}
              note="Repeat = 2 or more direct interactions."
            />
            <Field
              label="Identified protocols"
              value={
                identifiedProtocols === 0
                  ? "None verified"
                  : `${prefix}${identifiedProtocols}`
              }
              note="Contracts with a verified Fathom protocol mapping."
            />
            <Field
              label="Longest relationship"
              value={
                graph.longestRelationshipDays === null
                  ? "Not available"
                  : `${prefix}${graph.longestRelationshipDays} days`
              }
            />
          </div>
          {!graph.complete && (
            <p className="mt-3 text-xs text-slate400">
              Transaction walk hit the indexed query limit, so these counts are
              lower bounds — not exact totals.
            </p>
          )}
        </>
      )}
      {hasSocial && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Attesters"
            value={`${graph.attesters.length}`}
            note="Wallets that attested a role for this profile."
          />
          <Field
            label="Active vouches"
            value={`${activeVouches}`}
            note="On-chain vouch edges involving this wallet."
          />
          <Field
            label="Open disputes"
            value={`${openDisputes}`}
            note="Reports filed against this wallet — not verdicts."
          />
          <Field
            label="Invited by"
            value={graph.invitedBy === null ? "Not recorded" : "Recorded"}
            note="Invitation lineage from on-chain registration."
          />
        </div>
      )}
    </section>
  );
}

function RiskSection({
  states,
  signals,
}: {
  states: RiskState[];
  signals: RiskSignal[];
}) {
  const detected = new Set(signals.map((signal) => signal.type));
  const hasClear = states.some((state) => state.status === "clear");
  const hasNotEvaluable = states.some((state) => state.status === "not_evaluable");

  const summary =
    detected.size > 0
      ? "Risk signals were detected — inspect each one's evidence."
      : hasClear
        ? "Signal checks ran without raising a detection. This is not a guarantee of safety; signals cover only what indexed data can evaluate."
        : hasNotEvaluable
          ? "No signal could be evaluated from the data available for this wallet. That does not mean it is clear — it means there is not enough evidence to check."
          : "No risk signal was evaluated for this wallet.";

  return (
    <section id="risk" className="mt-10">
      <h2 className="font-display text-lg">Risk Signals</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate400">
        Risk is not proof of wrongdoing — every signal is backed by evidence you
        can inspect, and a signal never labels a wallet malicious. These are kept
        separate from reputation.
      </p>

      <div className="shine-border mt-5 rounded-2xl border border-ink/10 bg-ink/[0.03] p-6 text-sm text-slate400">
        {summary}
      </div>

      <ul className="mt-5 space-y-3">
        {states.map((state) => {
          const isDetected = detected.has(state.id);
          const statusLabel = state.status.replace("_", " ");
          return (
            <li
              key={state.id}
              className="shine-border rounded-2xl border border-ink/10 bg-ink/[0.03] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-base">
                  {RISK_LABELS[state.id]}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                    isDetected
                      ? "text-accent-ink"
                      : state.status === "not_evaluable"
                        ? "text-ink/40"
                        : "text-slate400"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
              {state.evidence ? (
                <p className="mt-2 font-mono text-sm text-ink">
                  {formatRiskEvidence(state.evidence)}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate400">
                  {state.reason}
                  {state.suppliedBy && ` Will be supplied by ${state.suppliedBy}.`}
                </p>
              )}
              {state.evidence_reference && (
                <a
                  href={state.evidence_reference}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block break-all font-mono text-[11px] text-accent-ink hover:underline"
                >
                  {state.evidence_reference}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return {};

  const address = normalizeAddress(parsed.data.address);
  const profile = await getWalletProfile(address);
  const title = `Fathom — ${shortAddress(address)}`;

  const metrics: string[] = [];
  if (profile.walletAgeDays !== null) metrics.push(`${profile.walletAgeDays}d old`);
  if (profile.txCount !== null) metrics.push(`${profile.txCount} transactions`);
  metrics.push(
    `${profile.trustGraph.uniqueCounterparties} unique counterparties`,
  );

  return {
    title,
    description: `Reputation evidence for ${title}. ${metrics.join(", ")}. Evidence before score.`,
    openGraph: {
      title,
      description: "Evidence-backed wallet reputation from Fathom.",
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: "Evidence-backed wallet reputation from Fathom.",
    },
  };
}

export default async function WalletProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    notFound();
  }

  const address = normalizeAddress(parsed.data.address);
  const profile = await getWalletProfile(address);

  return (
    <WalletShell>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate400">
        Wallet profile
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-3xl font-medium sm:text-4xl">
          {shortAddress(address)}
        </h1>
        <CopyAddress address={address} />
        {profile.alias && (
          <span className="rounded-full border border-ink/15 px-3 py-1 text-sm text-ink">
            {profile.alias}
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
              unverified
            </span>
          </span>
        )}
      </div>
      <p className="mt-3 break-all font-mono text-xs text-slate400">
        {address}
      </p>
      <p className="mt-3 text-xs text-slate400">
        {profile.claimedAt
          ? `Ownership proven · ${formatDate(profile.claimedAt)}`
          : "Unclaimed — owner has not signed in yet."}
      </p>
      <AliasEditor address={address} initialAlias={profile.alias} />

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field
            label="Wallet age"
            value={
              profile.walletAgeDays === null
                ? "Not available"
                : `${profile.walletAgeDays} days`
            }
            note={
              profile.walletAgeDays === null
                ? "No reliable historical source yet."
                : undefined
            }
          />
          <Field
            label="Direct transactions"
            value={
              profile.txCount === null ? "Not available" : String(profile.txCount)
            }
            note={
              profile.txCount === null
                ? "Exceeds the indexed query limit."
                : "Native transfers where this wallet is the sender or receiver — not internal or token transfers."
            }
          />
          <Field label="First on-chain tx" value={formatDate(profile.firstTxAt)} />
          <Field label="Last on-chain tx" value={formatDate(profile.lastTxAt)} />
          <Field label="First seen on Fathom" value={formatDate(profile.firstSeenAt)} />
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg">Reputation Dimensions</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate400">
            Reputation is presented as dimensions. A dimension appears only when
            its underlying evidence has been indexed — empty slots are labeled,
            never shown as zero.
          </p>
          <ul className="mt-5 space-y-3">
            {profile.dimensions.map((dimension) => (
              <DimensionRow key={dimension.id} dimension={dimension} />
            ))}
          </ul>
        </section>

        <TrustGraphSection graph={profile.trustGraph} address={address} />

        <RiskSection
          states={profile.riskStates}
          signals={profile.riskSignals}
        />

        <VouchesSection
          address={address}
          vouches={profile.trustGraph.vouches}
          vouchIndex={profile.vouchIndex}
        />

        <AttestationsSection
          address={address}
          attestations={profile.attestations}
        />

        <DisputesSection address={address} disputes={profile.disputes} />

        <section className="mt-10">
          <h2 className="font-display text-lg">Recent Proofs</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate400">
            Each proof records what is asserted, its source, and how to inspect
            it. Proofs are evidence — they never contain a reputation score.
            Fathom shows only what indexed data supports.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-slate400">
            Proof references point to raw evidence. Where a transaction hash is
            indexed, a proof links to that transaction; otherwise it falls back
            to the wallet&apos;s explorer page (address-level evidence). We never
            fabricate a reference that is not backed by indexed data.
          </p>

          {profile.proofs.length === 0 ? (
            <div className="shine-border mt-5 rounded-2xl border border-ink/10 bg-ink/[0.03] p-6 text-sm text-slate400">
              No proof can be produced for this wallet yet.
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {profile.proofs.map((proof, index) => (
                <li
                  key={`${proof.type}-${index}`}
                  className="shine-border rounded-2xl border border-ink/10 bg-ink/[0.03] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-base">
                      {PROOF_LABELS[proof.type]}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
                      {proof.type}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-sm text-ink">
                    {formatProofValue(proof)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-slate400">
                    <span>source: {proof.source}</span>
                    <span>method: {proof.verification_method}</span>
                    <span>confidence: {proof.confidence}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <a
                      href={proof.evidence_reference}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block break-all font-mono text-[11px] text-accent-ink hover:underline"
                    >
                      {proof.evidence_reference}
                    </a>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${
                        proof.evidence_references &&
                        proof.evidence_references.length > 0
                          ? "border border-accent-ink/20 text-accent-ink"
                          : "border border-ink/10 text-slate400"
                      }`}
                    >
                      {proof.evidence_references &&
                      proof.evidence_references.length > 0
                        ? "transaction-level"
                        : "address-level"}
                    </span>
                  </div>
                  {(proof.evidence_references ?? []).length > 1 && (
                    <div className="mt-2">
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
                        Evidence: {(proof.evidence_references ?? []).length}{" "}
                        transactions
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(proof.evidence_references ?? [])
                          .slice(1)
                          .map((ref, i) => (
                            <a
                              key={ref}
                              href={ref}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border border-ink/15 px-2 py-0.5 font-mono text-[10px] text-ink/70 hover:border-accent-ink/30 hover:text-accent-ink"
                            >
                              tx {i + 2}
                            </a>
                          ))}
                      </div>
                    </div>
                  )}
                  <ProofDetail proof={proof} graph={profile.trustGraph} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg">Why This Evidence?</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate400">
            This profile is built from evidence, not from a single number. Each
            layer points at the one above it, so every claim can be traced back
            to raw on-chain data:
          </p>
          <div className="shine-border mt-5 rounded-2xl border border-ink/10 bg-ink/[0.03] p-6">
            <p className="font-mono text-sm text-ink">
              Wallet → Onchain History → Proofs → Evidence → Trust Decision
            </p>
            <p className="mt-3 text-sm text-slate400">
              Each proof above names its source, verification method, and the
              explorer evidence it was derived from. A reputation score may
              eventually act as a compression layer over this evidence, but it is
              intentionally deferred until the scoring inputs are concrete. The
              trust decision stays yours.
            </p>
          </div>
        </section>
    </WalletShell>
  );
}
