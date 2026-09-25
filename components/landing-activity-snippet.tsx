"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FeedItem } from "@/lib/activity/feed";
import { ActivityFeedCard } from "@/components/activity-feed-card";

/**
 * Cuplikan aktivitas jaringan untuk landing (Spec 04 section 4.1).
 * Client fetch ke /api/activity karena landing adalah client component.
 * Read-only, tanpa posting, tanpa skor.
 */
export function LandingActivitySnippet() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/activity?limit=4&tab=latest")
      .then((res) => (res.ok ? res.json() : null))
      .then((page) => {
        if (!cancelled && page && Array.isArray(page.items)) {
          setItems(page.items.slice(0, 4));
        } else if (!cancelled) {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <div>
        <div className="panel-brutal p-6 text-sm text-slate400">
          Could not load network activity right now.
        </div>
        <div className="mt-5">
          <Link
            href="/activity"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition hover:text-ink"
          >
            Try the activity feed
          </Link>
        </div>
      </div>
    );
  }

  if (items?.length === 0) {
    return (
      <div>
        <div className="panel-brutal p-6 text-sm text-slate400">
          No activity recorded yet. Be the first to create activity. Check a
          wallet, attest, vouch, or open a dispute.
        </div>
        <div className="mt-5">
          <Link
            href="/activity"
            className="btn-brutal inline-block px-5 py-2.5 text-sm"
          >
            Check activity
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {items === null ? (
        <div className="panel-brutal p-6 text-sm text-slate400">
          Loading network activity…
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <ActivityFeedCard key={item.id} item={item} />
          ))}
        </ul>
      )}
      <div className="mt-5">
        <Link
          href="/activity"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition hover:text-ink"
        >
          View all activity
        </Link>
      </div>
    </div>
  );
}
