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
 * GET /api/reputation/{address} — Reputation API (Spec 11), publik.
 *
 * Membaca dari lapisan evidence/reputation yang sama dengan produk
 * (`getWalletProfile`) — tidak ada kalkulasi reputasi kedua (Spec 11 §Boundary).
 *
 * Hanya field yang benar-benar didukung yang diekspos. `score`, `tier`, dan
 * `riskLevel` agregat sengaja TIDAK dikirim: rumusnya belum dikunci. `vouches`
 * juga di-omit karena vouch belum diimplementasikan — mengirim 0 akan mengklaim
 * "tidak ada". Risk dilaporkan sebagai `riskSignals` (evidence, bukan label).
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
        proofs: profile.proofs,
        claim: profile.claim,
        vouches: profile.vouches,
        dimensions: profile.dimensions,
        score: profile.reputation.totalScore,
        tier: profile.reputation.tier,
        formulaVersion: profile.reputation.formulaVersion,
        completeness: profile.reputation.completeness,
      }),
    );
  } catch {
    return errorResponse("server_error", "Wallet data is temporarily unavailable.", 500);
  }
}
