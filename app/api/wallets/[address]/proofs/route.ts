import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAddress } from "@/lib/chain/address";
import { getWalletProfile } from "@/lib/wallet/profile";

const paramsSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/wallets/{address}/proofs — Proof snapshot (Spec 02).
 * Publik. Membaca dari proof-store via getWalletProfile — tidak ada
 * kalkulasi kedua (Spec 11 §Boundary).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return errorResponse("invalid_address", "Address must be a valid EVM address.", 400);
  }

  try {
    const profile = await getWalletProfile(normalizeAddress(parsed.data.address));
    return NextResponse.json({ proofs: profile.proofs });
  } catch {
    return errorResponse("server_error", "Wallet data is temporarily unavailable.", 500);
  }
}
