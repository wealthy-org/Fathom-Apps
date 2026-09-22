import { NextResponse } from "next/server";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * POST /api/attestations — DEPRECATED (410 Gone).
 * Attestations sekarang murni on-chain via FathomAttestationRegistry;
 * form tidak lagi POST ke sini. Path SIWE off-chain yang yatim ini
 * dimatikan supaya baris legacy-nya tidak menelan event on-chain
 * (unique attester+subject+role). Lihat indexer
 * lib/chain/attestation-registry.ts sebagai satu-satunya write path.
 */
export async function POST() {
  return errorResponse(
    "gone",
    "Off-chain attestations are deprecated. Attest on-chain via the FathomAttestationRegistry contract.",
    410,
  );
}
