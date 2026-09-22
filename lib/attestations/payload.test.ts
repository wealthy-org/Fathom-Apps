import { describe, expect, it } from "vitest";
import { buildAttestationMessage } from "@/lib/attestations/payload";
import { buildDisputeMessage } from "@/lib/disputes/payload";

describe("buildAttestationMessage", () => {
  it("builds the canonical message with lowercased addresses", () => {
    expect(
      buildAttestationMessage({
        attester: "0xD58DC8a8EDD6A8F439A360367F5826AB8442F414",
        subject: "0xF9F179F3Ef0A5801Ddc25D3ED12D3348d2dA2C7A",
        role: "Builder",
        relationship: "Worked Together",
        durationMonths: 8,
        issuedAt: "2026-09-22T00:00:00.000Z",
      }),
    ).toBe(
      [
        "Fathom Attestation",
        "Attester: 0xd58dc8a8edd6a8f439a360367f5826ab8442f414",
        "Subject: 0xf9f179f3ef0a5801ddc25d3ed12d3348d2da2c7a",
        "Role: Builder",
        "Relationship: Worked Together",
        "Duration (months): 8",
        "Issued At: 2026-09-22T00:00:00.000Z",
      ].join("\n"),
    );
  });

  it("omits the duration line when null", () => {
    const message = buildAttestationMessage({
      attester: "0xd58dc8a8edd6a8f439a360367f5826ab8442f414",
      subject: "0xf9f179f3ef0a5801ddc25d3ed12d3348d2da2c7a",
      role: "Trader",
      relationship: "OTC",
      durationMonths: null,
      issuedAt: "2026-09-22T00:00:00.000Z",
    });
    expect(message).not.toContain("Duration");
  });

  it("is deterministic for the same input", () => {
    const input = {
      attester: "0xd58dc8a8edd6a8f439a360367f5826ab8442f414",
      subject: "0xf9f179f3ef0a5801ddc25d3ed12d3348d2da2c7a",
      role: "Builder" as const,
      relationship: "Worked Together",
      durationMonths: 8,
      issuedAt: "2026-09-22T00:00:00.000Z",
    };
    expect(buildAttestationMessage(input)).toBe(buildAttestationMessage(input));
  });
});

describe("buildDisputeMessage", () => {
  it("builds the canonical message with lowercased addresses", () => {
    expect(
      buildDisputeMessage({
        reporter: "0xD58DC8a8EDD6A8F439A360367F5826AB8442F414",
        target: "0xF9F179F3Ef0A5801Ddc25D3ED12D3348d2dA2C7A",
        reason: "Rug pull",
        evidence: "tx 0xabc",
        issuedAt: "2026-09-22T00:00:00.000Z",
      }),
    ).toBe(
      [
        "Fathom Dispute",
        "Reporter: 0xd58dc8a8edd6a8f439a360367f5826ab8442f414",
        "Target: 0xf9f179f3ef0a5801ddc25d3ed12d3348d2da2c7a",
        "Reason: Rug pull",
        "Evidence: tx 0xabc",
        "Issued At: 2026-09-22T00:00:00.000Z",
      ].join("\n"),
    );
  });
});
