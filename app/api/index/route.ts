import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { indexVouchRegistry } from "@/lib/chain/vouch-registry";
import { indexAttestationRegistry } from "@/lib/chain/attestation-registry";
import { indexDisputeRegistry } from "@/lib/chain/dispute-registry";

const bodySchema = z.object({
  kind: z.enum(["vouch", "attestation", "dispute"]),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * POST /api/index — trigger inkremental indexer registry on-chain.
 * Dipanggil form setelah tx konfirmasi supaya event langsung masuk DB tanpa
 * tunggu cron/manual. Idempoten (constraint unik + watermark lastBlock).
 * Tanpa auth: hanya membaca event publik dan menulis evidence apa adanya —
 * indexer tidak menilai. Incremental = murah setelah run pertama.
 */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      "invalid_request",
      'Body must contain kind: "vouch" | "attestation" | "dispute".',
      400,
    );
  }

  try {
    const summary =
      parsed.data.kind === "vouch"
        ? await indexVouchRegistry()
        : parsed.data.kind === "attestation"
          ? await indexAttestationRegistry()
          : await indexDisputeRegistry();
    return NextResponse.json({
      ok: summary.ok,
      kind: parsed.data.kind,
      indexed: summary.indexed,
      fromBlock: summary.fromBlock.toString(),
      toBlock: summary.toBlock.toString(),
      error: summary.error,
    });
  } catch (e) {
    // ponytail: registry belum dikonfigurasi = indexer melempar (menolak menebak).
    // Sampaikan sebagai 503, bukan 500 — bukan bug, tapi belum di-setup.
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse("indexer_unavailable", msg, 503);
  }
}
