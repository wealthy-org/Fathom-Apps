import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { walletMetrics, walletTransactions, wallets } from "@/lib/db/schema";
import { normalizeAddress } from "@/lib/chain/address";
import { THRESHOLDS } from "@/config/thresholds";
import type { Address } from "@/lib/score/types";

const HOUR_MS = 3_600_000;
const SOURCE = "wallet_transactions";
// ponytail: BigInt(0) bukan literal 0n — target TS proyek masih ES2017.
const ZERO = BigInt(0);

/**
 * Agregat aktivitas turunan (PRD §25 `wallet_metrics`, sinyal §11.1–11.2).
 * Semua null = belum dihitung, bukan 0. bigint mengikuti konvensi
 * TrustGraphSummary (server-side, render pakai .toString()).
 */
export interface ComputedWalletMetrics {
  activeDays: number | null;
  activeMonths: number | null;
  totalSentWei: bigint | null;
  totalReceivedWei: bigint | null;
  avgValueWei: bigint | null;
  largestValueWei: bigint | null;
  // Kapan agregat ini dihitung — watermark. null = belum pernah dihitung.
  computedAt: Date | null;
}

export interface WalletMetricsProvider {
  refresh(
    address: Address,
    graphFetchedAt: Date | null,
  ): Promise<ComputedWalletMetrics>;
}

function isFresh(computedAt: Date): boolean {
  return (
    Date.now() - computedAt.getTime() < THRESHOLDS.metrics.cacheTtlHours * HOUR_MS
  );
}

const EMPTY: ComputedWalletMetrics = {
  activeDays: null,
  activeMonths: null,
  totalSentWei: null,
  totalReceivedWei: null,
  avgValueWei: null,
  largestValueWei: null,
  computedAt: null,
};

/**
 * Read-through cache: agregat dihitung dari `wallet_transactions` yang sudah
 * diindeks (ditulis oleh trust-graph fetch) — bukan sumber baru.
 * Dihitung ulang bila: belum ada baris, lewat TTL, atau graph punya data
 * lebih baru dari agregat. Tanpa baris tx: null dipertahankan, tidak dikarang.
 */
class DerivedWalletMetricsProvider implements WalletMetricsProvider {
  async refresh(
    address: Address,
    graphFetchedAt: Date | null,
  ): Promise<ComputedWalletMetrics> {
    const normalized = normalizeAddress(address);

    const [row] = await db
      .select({
        activeDays: walletMetrics.activeDays,
        activeMonths: walletMetrics.activeMonths,
        totalSentWei: walletMetrics.totalSentWei,
        totalReceivedWei: walletMetrics.totalReceivedWei,
        avgValueWei: walletMetrics.avgValueWei,
        largestValueWei: walletMetrics.largestValueWei,
        computedAt: walletMetrics.computedAt,
      })
      .from(walletMetrics)
      .where(eq(walletMetrics.address, normalized))
      .limit(1);

    if (
      row &&
      isFresh(row.computedAt) &&
      (graphFetchedAt === null ||
        row.computedAt.getTime() >= graphFetchedAt.getTime())
    ) {
      return { ...row };
    }

    const txRows = await db
      .select({
        timestamp: walletTransactions.timestamp,
        direction: walletTransactions.direction,
        valueWei: walletTransactions.valueWei,
      })
      .from(walletTransactions)
      .where(eq(walletTransactions.subjectAddress, normalized));

    if (txRows.length === 0) {
      // Belum ada transaksi terindeks — pertahankan baris lama apa adanya.
      return row ? { ...row } : { ...EMPTY };
    }

    const days = new Set<string>();
    const months = new Set<string>();
    let sent = ZERO;
    let received = ZERO;
    let largest = ZERO;
    for (const tx of txRows) {
      if (tx.direction === "sent") sent += tx.valueWei;
      else received += tx.valueWei;
      if (tx.valueWei > largest) largest = tx.valueWei;
      if (tx.timestamp) {
        days.add(tx.timestamp.toISOString().slice(0, 10));
        months.add(`${tx.timestamp.getUTCFullYear()}-${tx.timestamp.getUTCMonth()}`);
      }
    }

    const computedAt = new Date();
    const computed: ComputedWalletMetrics = {
      activeDays: days.size === 0 ? null : days.size,
      activeMonths: months.size === 0 ? null : months.size,
      totalSentWei: sent,
      totalReceivedWei: received,
      avgValueWei: (sent + received) / BigInt(txRows.length),
      largestValueWei: largest,
      computedAt,
    };

    await db.insert(wallets).values({ address: normalized }).onConflictDoNothing();

    await db
      .insert(walletMetrics)
      .values({
        address: normalized,
        activeDays: computed.activeDays,
        activeMonths: computed.activeMonths,
        totalSentWei: computed.totalSentWei,
        totalReceivedWei: computed.totalReceivedWei,
        avgValueWei: computed.avgValueWei,
        largestValueWei: computed.largestValueWei,
        source: SOURCE,
        computedAt,
      })
      .onConflictDoUpdate({
        target: walletMetrics.address,
        set: {
          activeDays: computed.activeDays,
          activeMonths: computed.activeMonths,
          totalSentWei: computed.totalSentWei,
          totalReceivedWei: computed.totalReceivedWei,
          avgValueWei: computed.avgValueWei,
          largestValueWei: computed.largestValueWei,
          source: SOURCE,
          computedAt,
        },
      });

    return computed;
  }
}

export const walletMetricsProvider: WalletMetricsProvider =
  new DerivedWalletMetricsProvider();

/**
 * Transaction frequency: direct transactions per active day, derived from the
 * existing aggregates (`onchainStats.txCount` ÷ `wallet_metrics.activeDays`).
 * Deterministic — same inputs always yield the same output. Returns null when
 * either input is missing or activeDays is not positive (never 0/NaN).
 * Neutral observation only: a higher frequency is not higher trust.
 */
export function txPerActiveDay(
  txCount: number | null,
  activeDays: number | null,
): number | null {
  if (txCount === null || activeDays === null || activeDays <= 0) return null;
  return txCount / activeDays;
}
