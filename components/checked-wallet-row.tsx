"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WalletAvatar } from "@/components/wallet-avatar";

/**
 * Satu baris history di halaman wallet index: blockie, address, waktu
 * check terakhir, sparkline skor nyata dari score_snapshots (via
 * /api/wallets/{address}/score-trend), skor terbaru. Snapshot kosong =
 * "—" (unknown), bukan angka karangan. Cache modul + dedupe in-flight:
 * address sama di banyak baris hanya request sekali.
 */

interface ScoreTrend {
  score: number | null;
  points: number[];
}

const cache = new Map<string, Promise<ScoreTrend>>();

function fetchScoreTrend(address: string): Promise<ScoreTrend> {
  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = fetch(`/api/wallets/${key}/score-trend`).then((res) => {
    if (!res.ok) throw new Error("http");
    return res.json() as Promise<ScoreTrend>;
  });
  // Gagal = evict agar render berikutnya coba lagi; consumer wajib catch.
  pending.catch(() => {
    if (cache.get(key) === pending) cache.delete(key);
  });
  cache.set(key, pending);
  return pending;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const W = 72;
const H = 24;
const PAD = 2;

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  // Skor flat tetap tergambar sebagai garis lurus (span 0 → tengah).
  const span = max - min || 1;
  const stepX = (W - PAD * 2) / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = PAD + i * stepX;
      const y = H - PAD - ((p - min) / span) * (H - PAD * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      className="shrink-0 text-accent-ink"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckedWalletRow({
  address,
  checkedAgo,
}: {
  address: string;
  /** Keterangan waktu opsional, mis. "Checked 5 minutes ago". */
  checkedAgo?: string;
}) {
  const [trend, setTrend] = useState<ScoreTrend | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchScoreTrend(address)
      .then((data) => {
        if (!cancelled) setTrend(data);
      })
      .catch(() => {
        if (!cancelled) setTrend({ score: null, points: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const hasTrend = trend !== null && trend.points.length > 0;

  return (
    <Link
      href={`/wallets/${address}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-px"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <WalletAvatar address={address} size={24} />
        <span className="min-w-0">
          <span className="block truncate font-mono text-sm text-accent-ink">
            {shortAddress(address)}
          </span>
          <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-slate400">
            {hasTrend
              ? `Score history${checkedAgo ? ` · ${checkedAgo}` : ""}`
              : trend === null
                ? "Loading"
                : `${checkedAgo ? ` ${checkedAgo}` : ""}`}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-4">
        {hasTrend && <Sparkline points={trend.points} />}
        <span className="w-9 text-right font-display text-lg font-semibold tabular-nums text-ink">
          {trend?.score ?? "—"}
        </span>
        <span className="font-mono text-xs font-medium text-ink/70">Open</span>
      </span>
    </Link>
  );
}
