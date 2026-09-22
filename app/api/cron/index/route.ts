import { NextResponse } from "next/server";
import { indexVouchRegistry } from "@/lib/chain/vouch-registry";
import { indexAttestationRegistry } from "@/lib/chain/attestation-registry";
import { indexDisputeRegistry } from "@/lib/chain/dispute-registry";

/**
 * Cron terjadwal (Vercel Cron, GET tiap 10 menit): menjalankan ketiga registry
 * indexer inkremental (vouch + attestation + dispute). Auth via bearer
 * CRON_SECRET supaya endpoint publik tidak bisa dipicu sembarang pihak.
 *
 * Idempoten: watermark lastBlock + constraint unik membuat run ulang aman.
 * Run yang error tidak memajukan lastBlock — event tidak pernah ter-skip.
 * Refresh per-submit tetap lewat POST /api/index (tanpa auth, per-kind).
 */
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json(
    { error: { code: "unauthorized", message: "Invalid cron secret." } },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        error: {
          code: "cron_unconfigured",
          message: "CRON_SECRET is not set.",
        },
      },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorized();

  const [vouch, attestation, dispute] = await Promise.all([
    indexVouchRegistry().catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    })),
    indexAttestationRegistry().catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    })),
    indexDisputeRegistry().catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    })),
  ]);

  return NextResponse.json(
    JSON.parse(
      JSON.stringify(
        { ok: true, vouch, attestation, dispute },
        // ponytail: ringkasan indexer membawa bigint (fromBlock/toBlock) —
        // NextResponse.json melempar 500 tanpa replacer ini.
        (_, value) => (typeof value === "bigint" ? value.toString() : value),
      ),
    ),
  );
}
