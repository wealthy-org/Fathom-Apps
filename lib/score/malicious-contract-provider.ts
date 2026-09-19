import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { maliciousContracts } from "@/lib/db/schema";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/wallet/chains";
import type { Address } from "@/lib/score/types";

/**
 * Malicious-contract provider (Spec 05). Identitas kontrak (isContract dari
 * counterparties — data) terpisah dari klasifikasi malicious (registry ini —
 * kurasi). Tidak pernah hardcode. Gagal DB = throw → not_evaluable.
 */

export interface MaliciousContract {
  address: Address;
  source: string;
  reason: string | null;
}

export interface MaliciousContractProvider {
  list(): Promise<MaliciousContract[]>;
}

class DrizzleMaliciousContractProvider implements MaliciousContractProvider {
  async list(): Promise<MaliciousContract[]> {
    const rows = await db
      .select({
        address: maliciousContracts.address,
        source: maliciousContracts.source,
        reason: maliciousContracts.reason,
      })
      .from(maliciousContracts)
      .where(eq(maliciousContracts.chainId, ROBINHOOD_TESTNET_CHAIN_ID));
    return rows.map((r) => ({
      address: r.address as Address,
      source: r.source,
      reason: r.reason,
    }));
  }
}

export const maliciousContractProvider: MaliciousContractProvider =
  new DrizzleMaliciousContractProvider();
