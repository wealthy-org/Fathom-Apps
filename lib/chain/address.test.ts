import { describe, expect, it } from "vitest";
import { normalizeAddress } from "@/lib/chain/address";

describe("normalizeAddress", () => {
  it("lowercases a valid checksummed address", () => {
    expect(normalizeAddress("0xD58DC8a8EDD6A8F439A360367F5826AB8442F414")).toBe(
      "0xd58dc8a8edd6a8f439a360367f5826ab8442f414",
    );
  });

  it("passes through an already-lowercase address", () => {
    expect(normalizeAddress("0xd58dc8a8edd6a8f439a360367f5826ab8442f414")).toBe(
      "0xd58dc8a8edd6a8f439a360367f5826ab8442f414",
    );
  });

  it("throws for short, long, non-hex, and missing-0x inputs", () => {
    expect(() => normalizeAddress("0x123")).toThrow("Invalid wallet address");
    expect(() => normalizeAddress(`0x${"a".repeat(41)}`)).toThrow("Invalid wallet address");
    expect(() => normalizeAddress(`0x${"z".repeat(40)}`)).toThrow("Invalid wallet address");
    expect(() => normalizeAddress("d58dc8a8edd6a8f439a360367f5826ab8442f414")).toThrow(
      "Invalid wallet address",
    );
    expect(() => normalizeAddress("")).toThrow("Invalid wallet address");
  });
});
