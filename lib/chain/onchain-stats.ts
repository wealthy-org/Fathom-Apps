import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { walletOnchainStats, wallets } from "@/lib/db/schema";
import { normalizeAddress } from "@/lib/chain/address";
import { fetchAddressTxSummary } from "@/lib/chain/blockscout";
import { THRESHOLDS } from "@/config/thresholds";
import type { Address } from "@/lib/score/types";

const HOUR_MS = 3_600_000;
const SOURCE = "blockscout";

export interface OnchainStats {
  firstTxAt: Date | null;
  lastTxAt: Date | null;
  // null = riwayat transaksi belum diketahui, bukan 0.
  txCount: number | null;
  // Kapan baris cache ini ditulis/diambil — watermark untuk snapshot Proof.
  // null hanya bila tidak ada baris cache dan fetch gagal.
  fetchedAt: Date | null;
}

export interface OnchainStatsProvider {
  fetch(address: Address): Promise<OnchainStats>;
}

function isFresh(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() < THRESHOLDS.explorer.cacheTtlHours * HOUR_MS;
}

/**
 * Read-through cache: pakai baris `wallet_onchain_stats` selama belum lewat TTL,
 * kalau lewat fetch dari explorer (lib/chain/blockscout.ts) lalu persist.
 *
 * Kegagalan fetch tidak menimpa data lama dengan null dan tidak mengarang angka —
 * hasil lama (jika ada) tetap dipakai, kalau tidak ada tetap null.
 *
 * `wallet_onchain_stats.address` FK ke `wallets`, jadi wallet yang belum pernah
 * dilihat dibuat dulu (firstSeenAt = sekarang). Idempoten via onConflictDoNothing.
 */
class ExplorerOnchainStatsProvider implements OnchainStatsProvider {
  async fetch(address: Address): Promise<OnchainStats> {
    const normalized = normalizeAddress(address);

    const [row] = await db
      .select({
        firstTxAt: walletOnchainStats.firstTxAt,
        lastTxAt: walletOnchainStats.lastTxAt,
        txCount: walletOnchainStats.txCount,
        fetchedAt: walletOnchainStats.fetchedAt,
      })
      .from(walletOnchainStats)
      .where(eq(walletOnchainStats.address, normalized))
      .limit(1);

    if (row && isFresh(row.fetchedAt)) {
      return {
        firstTxAt: row.firstTxAt,
        lastTxAt: row.lastTxAt,
        txCount: row.txCount,
        fetchedAt: row.fetchedAt,
      };
    }

    const summary = await fetchAddressTxSummary(normalized);
    if (!summary) {
      // Sumber tidak tersedia — pertahankan data lama apa adanya.
      return {
        firstTxAt: row?.firstTxAt ?? null,
        lastTxAt: row?.lastTxAt ?? null,
        txCount: row?.txCount ?? null,
        fetchedAt: row?.fetchedAt ?? null,
      };
    }

    await db.insert(wallets).values({ address: normalized }).onConflictDoNothing();

    // Satu timestamp untuk baris + marker — keduanya harus merujuk momen yang sama.
    const fetchedAt = new Date();

    await db
      .insert(walletOnchainStats)
      .values({
        address: normalized,
        firstTxAt: summary.firstTxAt,
        lastTxAt: summary.lastTxAt,
        txCount: summary.txCount,
        source: SOURCE,
        fetchedAt,
      })
      .onConflictDoUpdate({
        target: walletOnchainStats.address,
        set: {
          firstTxAt: summary.firstTxAt,
          lastTxAt: summary.lastTxAt,
          txCount: summary.txCount,
          source: SOURCE,
          fetchedAt,
        },
      });

    return { ...summary, fetchedAt };
  }
}

export const onchainStats: OnchainStatsProvider = new ExplorerOnchainStatsProvider();
