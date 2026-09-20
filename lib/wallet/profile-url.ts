import { normalizeAddress } from "@/lib/chain/address";
import type { Address } from "@/lib/score/types";

/** Canonical relative path back to the wallet profile. No hardcoded hostname. */
export function profileUrl(address: Address): string {
  return `/wallets/${normalizeAddress(address)}`;
}
