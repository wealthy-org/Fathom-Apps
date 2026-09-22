import { describe, expect, it } from "vitest";
import { assessVouchFarming, type VouchSummary } from "@/lib/score/vouch-farming";
import type { Address } from "@/lib/score/types";

const a = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const vouch = (from: number, to: number, status = "active"): VouchSummary => ({
  from: a(from),
  to: a(to),
  status,
});

describe("assessVouchFarming", () => {
  it("applies no discount below the minimum active count", () => {
    expect(assessVouchFarming([vouch(1, 9), vouch(2, 9)]).discountFactor).toBe(1);
  });

  it("ignores non-active vouches", () => {
    const vouches = [vouch(1, 9), vouch(2, 9), vouch(3, 9, "withdrawn")];
    expect(assessVouchFarming(vouches).discountFactor).toBe(1);
  });

  it("applies the single discount for a reciprocal pair without concentration", () => {
    // Thresholds: minActive 3, reciprocalPairs 2, topVoucherShare 0.5.
    // 4 vouches, one reciprocal pair, no voucher above 50% share → single discount.
    const vouches = [vouch(1, 9), vouch(9, 1), vouch(2, 9), vouch(3, 9)];
    const result = assessVouchFarming(vouches);
    expect(result.reciprocalPairs).toBe(1);
    expect(result.discountFactor).toBe(1);
  });

  it("applies the single discount for concentration without reciprocity", () => {
    const vouches = [vouch(1, 9), vouch(1, 8), vouch(1, 7)];
    const result = assessVouchFarming(vouches);
    expect(result.topVoucherShare).toBe(1);
    expect(result.discountFactor).toBe(0.5);
  });

  it("applies the both discount for reciprocal and concentrated vouches", () => {
    const vouches = [vouch(1, 9), vouch(9, 1), vouch(1, 9), vouch(9, 1)];
    const result = assessVouchFarming(vouches);
    expect(result.reciprocalPairs).toBe(2);
    expect(result.discountFactor).toBe(0.25);
  });
});
