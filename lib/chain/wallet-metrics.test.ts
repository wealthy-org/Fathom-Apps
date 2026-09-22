import { describe, expect, it } from "vitest";
import { txPerActiveDay } from "@/lib/chain/wallet-metrics";

describe("txPerActiveDay", () => {
  it("divides direct transactions by active days", () => {
    expect(txPerActiveDay(100, 10)).toBe(10);
  });

  it("returns null when either input is missing or days are not positive", () => {
    expect(txPerActiveDay(null, 10)).toBeNull();
    expect(txPerActiveDay(100, null)).toBeNull();
    expect(txPerActiveDay(100, 0)).toBeNull();
    expect(txPerActiveDay(100, -3)).toBeNull();
  });

  it("never returns NaN or zero-division artifacts", () => {
    const result = txPerActiveDay(0, 5);
    expect(result).toBe(0);
    expect(Number.isNaN(txPerActiveDay(null, null))).toBe(false);
  });
});
