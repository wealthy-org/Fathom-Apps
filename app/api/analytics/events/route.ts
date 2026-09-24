import { NextResponse } from "next/server";
import { getReputationEventData } from "@/lib/analytics/posthog-query";

export const dynamic = "force-dynamic";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/analytics/events — live product events + 24h stats dari PostHog
 * untuk section Live Reputation Events (display-only). Server-side read;
 * kredensial PostHog tidak pernah sampai client.
 */
export async function GET() {
  try {
    const data = await getReputationEventData();
    if (!data) {
      return errorResponse(
        "unavailable",
        "Analytics is not configured or unreachable.",
        503,
      );
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" },
    });
  } catch {
    return errorResponse("internal", "Could not load analytics events.", 500);
  }
}
