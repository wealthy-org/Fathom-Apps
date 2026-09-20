import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAddress } from "@/lib/chain/address";
import { toJsonSafe } from "@/lib/api/json-safe";
import { getWalletProfile } from "@/lib/wallet/profile";

const paramsSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/wallets/{address}/trust-graph — Trust graph (Spec 04).
 * Publik. Membaca dari trustGraph.fetch via getWalletProfile — tidak
 * ada kalkulasi kedua (Spec 11 §Boundary). `complete` dikirim apa
 * adanya: cache truth value, bukan status di-inferensi.
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
    const g = profile.trustGraph;
    // ponytail: relationships membawa valueSent/valueReceived bigint dan
    // vouches membawa stakeAmount bigint (numeric(78,0) → bigint) — kirim
    // sebagai string desimal, bukan float, supaya presisi wei utuh.
    return NextResponse.json(
      toJsonSafe({
        uniqueCounterparties: g.uniqueCounterparties,
        repeatCounterparties: g.repeatCounterparties,
        longestRelationshipDays: g.longestRelationshipDays,
        complete: g.complete,
        fetchedAt: g.fetchedAt?.toISOString() ?? null,
        relationships: g.relationships,
        attestations: g.attesters,
        disputes: g.disputes,
        vouches: g.vouches,
      }),
    );
  } catch {
    return errorResponse("server_error", "Wallet data is temporarily unavailable.", 500);
  }
}
