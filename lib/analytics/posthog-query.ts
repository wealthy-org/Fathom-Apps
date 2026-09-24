import { z } from "zod";
import { THRESHOLDS } from "@/config/thresholds";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

/**
 * Server-side read-back of Fathom product events from PostHog
 * (display-only for the landing Live Reputation Events section).
 * Never imported from client code — the personal API key must stay
 * server-side. Events with no wallet address are excluded.
 */

const TRACKED_EVENTS = [
  ANALYTICS_EVENTS.walletSearched,
  ANALYTICS_EVENTS.attestationCreated,
  ANALYTICS_EVENTS.profileClaimed,
  ANALYTICS_EVENTS.ownWalletChecked,
] as const;

const TRACKED_EVENTS_SQL = TRACKED_EVENTS.map((name) => `'${name}'`).join(", ");

export interface ReputationEventRow {
  id: string;
  event: string;
  occurredAt: string;
  address: string | null;
}

export interface ReputationEventData {
  rows: ReputationEventRow[];
}

const { activity } = THRESHOLDS;

function posthogAppHost(): string {
  const raw = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  if (!raw) return "https://us.posthog.com";
  try {
    const url = new URL(raw);
    // Host env kadang berisi ingestion host (*.i.posthog.com); API butuh app host.
    const host = url.hostname.replace(
      /^(us|eu)\.i\.posthog\.com$/i,
      "$1.posthog.com",
    );
    return `${url.protocol}//${host}`;
  } catch {
    return "https://us.posthog.com";
  }
}

function requirePosthogConfig(): { apiKey: string; projectId: string; host: string } | null {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  if (!apiKey || !projectId) return null;
  return { apiKey, projectId, host: posthogAppHost() };
}

const queryResponseSchema = z.object({
  results: z.array(z.unknown()),
});

async function runPosthogQuery(
  config: { apiKey: string; projectId: string; host: string },
  hogql: string,
  name: string,
): Promise<unknown[] | null> {
  try {
    const res = await fetch(`${config.host}/api/projects/${config.projectId}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        query: { kind: "HogQLQuery", query: hogql },
        name,
      }),
      signal: AbortSignal.timeout(activity.eventsUpstreamTimeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const parsed = queryResponseSchema.safeParse(await res.json());
    return parsed.success ? parsed.data.results : null;
  } catch {
    return null;
  }
}

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;

function parseAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return ADDRESS_RE.test(normalized) ? normalized : null;
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseEventRow(raw: unknown): ReputationEventRow | null {
  // HogQL mengembalikan baris array; bentuk object diterima untuk defensif.
  if (Array.isArray(raw)) {
    const [id, timestamp, event, address] = raw;
    const occurredAt = parseTimestamp(timestamp);
    if (typeof id !== "string" || occurredAt === null || typeof event !== "string") {
      return null;
    }
    if (!(TRACKED_EVENTS as readonly string[]).includes(event)) return null;
    return {
      id,
      event,
      occurredAt,
      address: parseAddress(address),
    };
  }
  if (typeof raw === "object" && raw !== null) {
    const record = raw as Record<string, unknown>;
    const occurredAt = parseTimestamp(record.timestamp);
    const event = record.event;
    if (occurredAt === null || typeof event !== "string") return null;
    if (!(TRACKED_EVENTS as readonly string[]).includes(event)) return null;
    return {
      id: typeof record.uuid === "string" ? record.uuid : occurredAt,
      event,
      occurredAt,
      address: parseAddress(record.address),
    };
  }
  return null;
}

let cache: { at: number; data: ReputationEventData } | null = null;

/**
 * Event terbaru untuk section Live Reputation Events.
 * Returns null ketika env belum diset atau PostHog tidak bisa dijangkau.
 */
export async function getReputationEventData(): Promise<ReputationEventData | null> {
  const config = requirePosthogConfig();
  if (!config) return null;

  const now = Date.now();
  if (cache && now - cache.at < activity.eventsCacheSeconds * 1000) {
    return cache.data;
  }

  const windowClause = `timestamp >= now() - INTERVAL ${activity.eventsWindowHours} HOUR`;
  const rowResults = await runPosthogQuery(
    config,
    `SELECT uuid, timestamp, event, properties.address FROM events WHERE event IN (${TRACKED_EVENTS_SQL}) AND ${windowClause} ORDER BY timestamp DESC LIMIT ${activity.eventsLimit}`,
    "fathom live reputation events rows",
  );
  if (!rowResults) return null;

  const rows = rowResults
    .map(parseEventRow)
    .filter((row): row is ReputationEventRow => row !== null);

  const data: ReputationEventData = { rows };
  cache = { at: now, data };
  return data;
}
