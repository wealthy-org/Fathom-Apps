import { NextResponse } from "next/server";
import { ADDRESS_RE } from "@/lib/chain/address";
import { getScoreTrend } from "@/lib/wallet/score-trend";

/**
 * GET /api/wallets/{address}/score-trend — riwayat skor terakhir dari
 * score_snapshots untuk sparkline history. Ringan: satu query indexed.
 * Tanpa snapshot = { score: null, points: [] } — bukan angka karangan.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: { code: "invalid_address", message: "Invalid wallet address." } },
      { status: 400 },
    );
  }
  try {
    const trend = await getScoreTrend(address.toLowerCase());
    return NextResponse.json(trend);
  } catch {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to load score trend." } },
      { status: 500 },
    );
  }
}
