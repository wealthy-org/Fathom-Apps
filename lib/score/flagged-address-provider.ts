import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { flaggedAddresses } from "@/lib/db/schema";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/wallet/chains";
import type { Address } from "@/lib/score/types";

/**
 * Flagged-address provider (Spec 05). Daftar tidak pernah di-hardcode —
 * sumbernya tabel `flagged_addresses` (seed manual/kurasi nanti).
 * Gagal DB = throw; pemanggil memetakan ke undefined → not_evaluable.
 */

export interface FlaggedAddress {
  address: Address;
  source: string;
  reason: string | null;
}

export interface FlaggedAddressProvider {
  list(): Promise<FlaggedAddress[]>;
}

class DrizzleFlaggedAddressProvider implements FlaggedAddressProvider {
  async list(): Promise<FlaggedAddress[]> {
    const rows = await db
      .select({
        address: flaggedAddresses.address,
        source: flaggedAddresses.source,
        reason: flaggedAddresses.reason,
      })
      .from(flaggedAddresses)
      .where(eq(flaggedAddresses.chainId, ROBINHOOD_TESTNET_CHAIN_ID));
    return rows.map((r) => ({
      address: r.address as Address,
      source: r.source,
      reason: r.reason,
    }));
  }
}

export const flaggedAddressProvider: FlaggedAddressProvider =
  new DrizzleFlaggedAddressProvider();
