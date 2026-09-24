"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { THRESHOLDS } from "@/config/thresholds";
import type { FeedItem } from "@/lib/activity/feed";
import { formatNative, shortAddress } from "@/components/activity-feed-card";
import { RandomAvatar } from "@/components/random-avatar";

const LIMIT = THRESHOLDS.activity.landingMarqueeLimit;
const POLL_MS = THRESHOLDS.activity.landingPollMs;

type FeedPage = { items: FeedItem[] };

function itemKey(item: FeedItem): string {
  return `${item.kind}:${item.id}`;
}

/** Actor = wallet yang melakukan aksi (avatar + label card). */
function actorOf(item: FeedItem): string {
  switch (item.kind) {
    case "attestation":
      return item.attester;
    case "dispute":
      return item.reporter;
    case "vouch":
      return item.from;
    case "claim":
      return item.address;
  }
}

/** Waktu relatif ringkas untuk card (jam/hari). Boundary presentasi. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
function subjectOf(item: FeedItem): string {
  switch (item.kind) {
    case "attestation":
      return item.subject;
    case "dispute":
      return item.target;
    case "vouch":
      return item.to;
    case "claim":
      return item.address;
  }
}

/** Baris aksi di bawah nama actor, gaya contoh (vouched / attested / dispute). */
function ActionLine({ item }: { item: FeedItem }) {
  if (item.kind === "vouch") {
    return (
      <p className="text-sm text-slate400">
        <span className="font-semibold text-ink">{formatNative(item.stakeWei)}</span>{" "}
        vouched
      </p>
    );
  }
  if (item.kind === "attestation") {
    return (
      <p className="truncate text-sm text-slate400">
        attested as <span className="font-semibold text-ink">{item.role}</span>
      </p>
    );
  }
  if (item.kind === "dispute") {
    return <p className="text-sm font-medium text-accent-ink">opened dispute</p>;
  }
  return <p className="text-sm text-slate400">claimed wallet</p>;
}

function MarqueeCard({ item, isNew }: { item: FeedItem; isNew: boolean }) {
  const actor = actorOf(item);
  return (
    <Link
      href={`/wallets/${subjectOf(item)}`}
      className={`relative w-60 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-white p-5 transition hover:border-ink/25 sm:w-64 ${
        isNew ? "animate-marquee-new" : ""
      }`}
    >
      {/* <span className="pointer-events-none absolute -right-8 -top-8 opacity-20">
        <RandomAvatar size={140} />
      </span> */}
      <span className="relative flex items-center gap-2.5">
        <RandomAvatar size={36} />
        <span className="truncate font-mono text-sm font-medium text-ink">
          {shortAddress(actor)}
        </span>
      </span>
      <span className="relative mt-3 block">
        <ActionLine item={item} />
        <span
          className="mt-1 block font-mono text-[11px] text-faint"
          title={new Date(item.occurredAt).toLocaleString()}
        >
          {timeAgo(item.occurredAt)}
        </span>
      </span>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="w-60 shrink-0 animate-pulse rounded-2xl border border-ink/10 bg-transparent p-5 sm:w-64"
    >
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-full bg-ink/10" />
        <div className="h-4 w-24 rounded bg-ink/10" />
      </div>
      <div className="mt-3 h-4 w-32 rounded bg-ink/10" />
    </div>
  );
}

/**
 * Strip aktivitas live di bawah navbar landing — cuplikan /api/activity
 * sebagai slider horizontal jalan sendiri + polling untuk data baru.
 * Read-only, tanpa posting, tanpa skor.
 */
export function LandingActivityMarquee() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const seenKeys = useRef<Set<string>>(new Set());
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/activity?limit=${LIMIT}&tab=latest`);
        if (!res.ok) throw new Error("bad status");
        const page = (await res.json()) as FeedPage;
        if (cancelled || !Array.isArray(page.items)) return;
        const fresh = page.items.slice(0, LIMIT);
        const arrived = fresh
          .map(itemKey)
          .filter((key) => !seenKeys.current.has(key));
        // Poll pertama: semua item baseline, bukan "baru".
        if (seenKeys.current.size > 0 && arrived.length > 0) {
          setNewKeys(new Set(arrived));
        }
        for (const key of arrived) seenKeys.current.add(key);
        setItems(fresh);
      } catch {
        // Gagal total saat data kosong: sembunyikan strip.
        // Bila data awal pernah sukses, strip lama bertahan.
        if (!cancelled && seenKeys.current.size === 0) setFailed(true);
      }
    }

    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (failed || items?.length === 0) return null;

  const cards = items ?? null;
  // Duplikasi untuk loop CSS mulus; salinan kedua aria-hidden.
  const loop = cards ? [...cards, ...cards] : null;
  const half = cards?.length ?? 0;

  return (
    <section
      aria-label="Latest network activity"
      className="border-y border-ink/10 bg-transparent py-6 text-ink"
    >
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-end gap-4 px-5 lg:px-8">
        {/* <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
          Live activity
        </p> */}
        <Link
          href="/activity"
          className="text-sm font-medium text-ink/70 transition hover:text-ink"
        >
          View all
        </Link>
      </div>
      <div className="marquee-paused mt-4 overflow-hidden">
        <div className="animate-marquee flex w-max gap-4 px-5 motion-reduce:animate-none motion-reduce:overflow-x-auto lg:px-8">
          {loop === null ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            loop.map((item, index) => (
              <span
                key={`${itemKey(item)}-${index}`}
                aria-hidden={index >= half || undefined}
                className="contents"
              >
                <MarqueeCard
                  item={item}
                  isNew={index < half && newKeys.has(itemKey(item))}
                />
              </span>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
