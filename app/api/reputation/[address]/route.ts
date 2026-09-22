import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAddress } from "@/lib/chain/address";
import { toJsonSafe } from "@/lib/api/json-safe";
import { getWalletProfile } from "@/lib/wallet/profile";

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

type RiskLevel = "low" | "medium" | "high" | null;

const SEVERITY_RANK = { low: 1, medium: 2, high: 3 } as const;

/**
 * Turunan dari `riskSignals` yang sudah ada (bukan kalkulasi kedua):
 * severity tertinggi yang terdeteksi. null = sumber risk belum usable
 * (not_indexed/unavailable) — bukan "low" palsu. Tanpa deteksi pada sumber
 * yang usable = "low", selaras contoh respons Brief §23.
 */
function deriveRiskLevel(
  state: string,
  severities: Array<"low" | "medium" | "high">,
): RiskLevel {
  if (state !== "available" && state !== "empty") return null;
  let level: Exclude<RiskLevel, null> = "low";
  for (const severity of severities) {
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[level]) level = severity;
  }
  return level;
}

/**
 * GET /api/reputation/{address} — Reputation API (Spec 11), publik.
 *
 * Membaca dari lapisan evidence/reputation yang sama dengan produk
 * (`getWalletProfile`) — tidak ada kalkulasi reputasi kedua (Spec 11 §Boundary).
 *
 * Hanya field yang benar-benar didukung yang diekspos. `vouches` null saat
 * index state unknown (no-index) — array kosong berarti confirmed-zero, bukan
 * "belum di-index". Risk dilaporkan sebagai `riskSignals` (evidence, bukan label)
 * plus turunan `riskLevel` (Brief §23) — null saat sumber risk belum usable.
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
      toJsonSafe({
        address: profile.address,
        walletAgeDays: profile.walletAgeDays,
        uniqueCounterparties: profile.trustGraph.complete
          ? profile.trustGraph.uniqueCounterparties
          : null,
        repeatCounterparties: profile.trustGraph.complete
          ? profile.trustGraph.repeatCounterparties
          : null,
        attestations: profile.attestations.length,
        activeDisputes: profile.disputes.filter((d) => d.status === "open").length,
        riskSignals: profile.riskSignals,
        riskLevel: deriveRiskLevel(
          profile.reputation.availability.riskSignals.state,
          profile.riskSignals.map((s) => s.severity),
        ),
        proofs: profile.proofs,
        claim: profile.claim,
        vouches: profile.vouchIndex === null ? null : profile.vouches,
        vouchesCount: profile.vouchIndex === null ? null : profile.vouches.length,
        dimensions: profile.dimensions,
        score: profile.reputation.totalScore,
        tier: profile.reputation.tier,
        formulaVersion: profile.reputation.formulaVersion,
        completeness: profile.reputation.completeness,
      }),
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
