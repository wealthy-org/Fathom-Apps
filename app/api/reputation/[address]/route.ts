import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAddress } from "@/lib/chain/address";
import { toJsonSafe } from "@/lib/api/json-safe";
import { getWalletProfile } from "@/lib/wallet/profile";
import { buildReputationPayload } from "@/lib/wallet/reputation-response";

const paramsSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: CORS_HEADERS });
}

// ponytail: endpoint publik read-only tanpa kredensial — wildcard aman untuk
// integrator eksternal (browser app). Preflight di-cache 24 jam.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

/** Preflight untuk integrator browser eksternal. */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/reputation/{address} — Reputation API (Spec 11), publik.
 * Mapping respons ada di lib/wallet/reputation-response.ts (dibagi dengan
 * halaman docs supaya sample-nya selalu sinkron dengan API sungguhan).
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

    // ponytail: vouches membawa stakeAmount bigint — kirim sebagai string
    // desimal via toJsonSafe. Field lain (score/tier/completeness/dimensions/
    // proofs/riskSignals/claim) sudah JSON-safe (number/string/null).
    // riskLevel + vouchesCount = turunan aditif untuk format respons Brief §23
    // (backward compatible — tidak ada field lama yang diubah/dihapus).
    return NextResponse.json(
      toJsonSafe(buildReputationPayload(profile)),
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
          ...CORS_HEADERS,
        },
      },
    );
  } catch {
    return errorResponse("server_error", "Wallet data is temporarily unavailable.", 500);
  }
}
