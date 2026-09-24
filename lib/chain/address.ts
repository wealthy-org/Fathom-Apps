import type { Address } from "@/lib/score/types";

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Normalisasi address ke lowercase. Satu-satunya jalan tulis address ke DB. */
export function normalizeAddress(input: string): Address {
  if (!ADDRESS_RE.test(input)) {
    throw new Error("Invalid wallet address");
  }
  return input.toLowerCase() as Address;
}
