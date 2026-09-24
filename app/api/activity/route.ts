import { NextResponse } from "next/server";
import { z } from "zod";
import { FEED_TABS, getActivityFeed } from "@/lib/activity/feed";
import { ADDRESS_RE, normalizeAddress } from "@/lib/chain/address";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().datetime().optional(),
  tab: z.enum(FEED_TABS).default("latest"),
  wallet: z.string().regex(ADDRESS_RE).optional(),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/activity — public activity feed (S1+S2).
 * ?tab=signal|latest|established|disputed, cursor = ISO timestamp
 * (exclusive upper bound). Tab semantics live in lib/activity/feed.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    tab: url.searchParams.get("tab") ?? undefined,
    wallet: url.searchParams.get("wallet") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse("bad_request", "Invalid limit, cursor, tab or wallet.", 400);
  }

  try {
    const page = await getActivityFeed({
      ...parsed.data,
      wallet: parsed.data.wallet
        ? normalizeAddress(parsed.data.wallet)
        : undefined,
    });
    return NextResponse.json(page);
  } catch {
    return errorResponse("internal", "Could not load activity.", 500);
  }
}
