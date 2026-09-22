import { describe, expect, it } from "vitest";
import { generateProofs, type Proof } from "@/lib/score/proofs";
import type { OnchainStats } from "@/lib/chain/onchain-stats";
import type { TrustGraphSummary } from "@/lib/chain/trust-graph";
import type { Address } from "@/lib/score/types";

const SUBJECT = "0xd58dc8a8edd6a8f439a360367f5826ab8442f414" as Address;
const NOW = new Date("2026-09-22T00:00:00.000Z");

const stats = (overrides: Partial<OnchainStats> = {}): OnchainStats => ({
  firstTxAt: new Date("2025-09-22T00:00:00.000Z"),
  lastTxAt: new Date("2026-09-20T00:00:00.000Z"),
  txCount: 100,
  fetchedAt: NOW,
  ...overrides,
});

const graph = (overrides: Partial<TrustGraphSummary> = {}): TrustGraphSummary =>
  ({
    uniqueCounterparties: 2,
    repeatCounterparties: 1,
    longestRelationshipDays: 100,
    relationships: [],
    attesters: [],
    disputes: [],
    vouches: [],
    invitedBy: null,
    firstTxHash: null,
    fetchedAt: NOW,
    complete: true,
    ...overrides,
  }) as TrustGraphSummary;

const types = (proofs: Proof[]) => proofs.map((p) => p.type);

describe("generateProofs", () => {
  it("emits wallet_age with age in days", () => {
    const proofs = generateProofs(SUBJECT, stats(), graph(), [], NOW);
    const age = proofs.find((p) => p.type === "wallet_age");
    expect(age?.value).toEqual({ ageDays: 365, firstTxAt: "2025-09-22T00:00:00.000Z" });
  });

  it("skips transaction_history when txCount is unknown (null)", () => {
    const proofs = generateProofs(SUBJECT, stats({ txCount: null }), graph(), [], NOW);
    expect(types(proofs)).not.toContain("transaction_history");
  });

  it("skips graph-derived proofs when the walk is incomplete", () => {
    const proofs = generateProofs(SUBJECT, stats(), graph({ complete: false }), [], NOW);
    expect(types(proofs)).not.toContain("unique_counterparty");
    expect(types(proofs)).not.toContain("repeat_counterparty");
    expect(types(proofs)).not.toContain("economic_history");
    expect(types(proofs)).not.toContain("contract_history");
  });

  it("emits one role_attestation proof per attestation", () => {
    const proofs = generateProofs(
      SUBJECT,
      stats(),
      null,
      [
        {
          attester: "0xf9f179f3ef0a5801ddc25d3ed12d3348d2da2c7a" as Address,
          role: "Builder",
          relationship: "Worked Together",
          durationMonths: 8,
          message: "canonical",
          onchainIdentity: null,
          createdAt: new Date("2026-09-01T00:00:00.000Z"),
        },
      ],
      NOW,
    );
    const attestations = proofs.filter((p) => p.type === "role_attestation");
    expect(attestations).toHaveLength(1);
    expect(attestations[0].value).toMatchObject({ role: "Builder" });
  });

  it("is deterministic for the same indexed inputs", () => {
    const a = generateProofs(SUBJECT, stats(), graph(), [], NOW);
    const b = generateProofs(SUBJECT, stats(), graph(), [], NOW);
    expect(a).toEqual(b);
  });
});
