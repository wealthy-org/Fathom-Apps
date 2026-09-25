import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { scoreSnapshots } from "@/lib/db/schema";

/**
 * Riwayat skor terakhir untuk sparkline history di halaman wallet index.
 * Sumber: score_snapshots (history/cache per address, Spec score-refresh).
 * Ascending = urutan waktu maju, siap digambar langsung. Tanpa snapshot =
 * array kosong (render "—"), bukan angka karangan.
 */

export const SCORE_TREND_POINTS = 12;

export interface ScoreTrend {
  /** Skor terbaru (snapshot paling akhir), null bila belum ada snapshot. */
  score: number | null;
  /** Urutan waktu maju, maksimum SCORE_TREND_POINTS titik terakhir. */
  points: number[];
}

export async function getScoreTrend(address: string): Promise<ScoreTrend> {
  const rows = await db
    .select({ totalScore: scoreSnapshots.totalScore })
    .from(scoreSnapshots)
    .where(eq(scoreSnapshots.address, address.toLowerCase()))
    .orderBy(asc(scoreSnapshots.createdAt));

  if (rows.length === 0) {
    return { score: null, points: [] };
  }

  const points = rows
    .slice(-SCORE_TREND_POINTS)
    .map((row) => row.totalScore);

  return { score: points[points.length - 1] ?? null, points };
}
