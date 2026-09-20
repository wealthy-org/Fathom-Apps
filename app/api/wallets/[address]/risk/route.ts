import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { disputes, walletTransactions } from "@/lib/db/schema";
import { normalizeAddress } from "@/lib/chain/address";
import { toJsonSafe } from "@/lib/api/json-safe";
import { onchainStats } from "@/lib/chain/onchain-stats";
import { trustGraph } from "@/lib/chain/trust-graph";
import {
  flaggedAddressProvider,
} from "@/lib/score/flagged-address-provider";
import {
  maliciousContractProvider,
} from "@/lib/score/malicious-contract-provider";
import { assessRisk } from "@/lib/score/risk";
import { eq } from "drizzle-orm";

const paramsSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/wallets/{address}/risk — Risk signals (Spec 05).
 * Memanggil assessRisk langsung dengan input raw dari DB —
 * kalkulasi on-the-fly, bukan dari cache (Spec 11 §Boundary).
 * Sumber yang tidak tersedia → not_evaluable, bukan clear.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return errorResponse("invalid_address", "Address must be a valid EVM address.", 400);
  }

  const address = normalizeAddress(parsed.data.address);

  try {
    const stats = await onchainStats.fetch(address);
    const graph = await trustGraph.fetch(address);
    const [txRows, flaggedAddresses, maliciousContracts, disputeRows] =
      await Promise.all([
        db
          .select({
            timestamp: walletTransactions.timestamp,
            valueWei: walletTransactions.valueWei,
            toIsContract: walletTransactions.toIsContract,
          })
          .from(walletTransactions)
          .where(eq(walletTransactions.subjectAddress, address))
          .then(
            (rows) => rows,
            (): undefined => undefined,
          ),
        flaggedAddressProvider.list().then(
          (rows) => rows,
          (): undefined => undefined,
        ),
        maliciousContractProvider.list().then(
          (rows) => rows,
          (): undefined => undefined,
        ),
        db
          .select({
            reporter: disputes.reporterAddress,
            status: disputes.status,
            registryId: disputes.registryId,
            txHash: disputes.txHash,
          })
          .from(disputes)
          .where(eq(disputes.targetAddress, address)),
      ]);

    const riskInputs: Parameters<typeof assessRisk>[4] = {};
    if (txRows !== undefined) riskInputs.transactions = txRows;
    if (flaggedAddresses !== undefined) riskInputs.flaggedAddresses = flaggedAddresses;
    if (maliciousContracts !== undefined) riskInputs.maliciousContracts = maliciousContracts;
    riskInputs.disputes = disputeRows.map((row) => ({
      reporter: row.reporter as `0x${string}`,
      status: row.status,
      registryId: row.registryId,
      txHash: row.txHash,
    }));

    const { signals, states } = assessRisk(
      address,
      stats,
      graph,
      new Date(),
      riskInputs,
    );

    // ponytail: evidence detector saat ini number/string saja, tapi bungkus
    // toJsonSafe sebagai garansi — valueWei bigint tidak boleh bocor ke JSON.
    return NextResponse.json(toJsonSafe({ signals, states }));
  } catch {
    return errorResponse("server_error", "Wallet data is temporarily unavailable.", 500);
  }
}
