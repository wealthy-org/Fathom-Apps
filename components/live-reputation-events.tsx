"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { THRESHOLDS } from "@/config/thresholds";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { LandingSectionHead } from "./landing-section-head";

const POLL_MS = THRESHOLDS.activity.eventsPollMs;
const WINDOW_HOURS = THRESHOLDS.activity.eventsWindowHours;

interface ReputationEventRow {
  id: string;
  event: string;
  occurredAt: string;
  address: string | null;
}

interface ReputationEventData {
  rows: ReputationEventRow[];
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Waktu relatif ringkas (jam/hari). Boundary presentasi. */
function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const EVENT_LABELS: Record<string, string> = {
  [ANALYTICS_EVENTS.walletSearched]: "Wallet checked",
  [ANALYTICS_EVENTS.attestationCreated]: "Attestation created",
  [ANALYTICS_EVENTS.profileClaimed]: "Profile claimed",
  [ANALYTICS_EVENTS.ownWalletChecked]: "Own wallet checked",
};

function eventLabel(event: string): string {
  return (
    EVENT_LABELS[event] ??
    event.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

function EventRow({ row }: { row: ReputationEventRow }) {
  return (
    <tr className="border-b border-black/5">
      <td className="px-6 py-3 text-sm text-ink">{eventLabel(row.event)}</td>
      <td className="px-6 py-3">
        {row.address ? (
          <Link
            href={`/wallets/${row.address}`}
            className="font-mono text-xs text-accent-ink hover:underline"
          >
            {shortAddress(row.address)}
          </Link>
        ) : (
          <span className="text-slate400">—</span>
        )}
      </td>
      <td
        className="px-6 py-3 text-right font-mono text-[11px] text-slate400"
        title={new Date(row.occurredAt).toLocaleString()}
      >
        {timeAgo(row.occurredAt)}
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      <td className="px-6 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-ink/10" />
      </td>
      <td className="px-6 py-3">
        <div className="h-4 w-24 animate-pulse rounded bg-ink/10" />
      </td>
      <td className="px-6 py-3">
        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-ink/10" />
      </td>
    </tr>
  );
}

/**
 * Section Live Reputation Events (landing): kartu statistik 24h + tabel
 * event produk terbaru dari PostHog via /api/analytics/events.
 * Display-only — analytics, bukan sinyal reputasi, bukan scoring.
 */
export function LiveReputationEvents() {
  const [data, setData] = useState<ReputationEventData | null>(null);
  const [failed, setFailed] = useState(false);
  const hasDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/analytics/events");
        if (!res.ok) throw new Error("bad status");
        const body = (await res.json()) as ReputationEventData;
        if (cancelled) return;
        if (!body || !Array.isArray(body.rows)) {
          throw new Error("bad shape");
        }
        hasDataRef.current = true;
        setData(body);
        setFailed(false);
      } catch {
        // Gagal total: sembunyikan section. Bila data lama ada, biarkan bertahan.
        if (!cancelled && !hasDataRef.current) setFailed(true);
      }
    }

    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (failed || data?.rows.length === 0) return null;

  return (
    <section
      aria-label="Live reputation events"
      className="px-6 py-20 sm:py-24 lg:px-10 xl:px-12"
    >
      <div className="mx-auto max-w-7xl">
        <LandingSectionHead
          title="Live reputation events"
          sub={`Real product activity from the last ${WINDOW_HOURS} hours — wallets checked, attestations created, profiles claimed.`}
        />

        <div className="card panel-brutal mt-12 overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-6 py-4">
            <h3 className="font-display text-lg text-ink">Latest events</h3>
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
              Live · last {WINDOW_HOURS}h
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-black/10 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  <th scope="col" className="px-6 py-3 font-medium">
                    Event
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Wallet
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {data === null
                  ? Array.from({ length: 4 }, (_, i) => (
                      <SkeletonRow key={i} />
                    ))
                  : data.rows.map((row) => (
                      <EventRow key={row.id} row={row} />
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
