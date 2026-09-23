"use client";

import { track } from "@vercel/analytics";
import type { AnalyticsEventName } from "@/lib/analytics/events";

type AnalyticsProperties = Record<string, string | number | boolean>;

/**
 * Phase 0 instrumentation only - custom event wrapper.
 * Never throws, never blocks UI. No-op on server.
 * Sends lowercase wallet address at most, never real-world identity.
 */
export function trackEvent(
  name: AnalyticsEventName,
  properties?: AnalyticsProperties,
): void {
  if (typeof window === "undefined") return;
  try {
    track(name, properties);
  } catch {
    // Analytics must never break product flow.
  }
}

