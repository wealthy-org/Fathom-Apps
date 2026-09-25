import { NextResponse } from "next/server";
import { z } from "zod";
import { FEED_KINDS, FEED_TABS, getActivityFeed } from "@/lib/activity/feed";
import { getSession } from "@/lib/auth/session";
import { ADDRESS_RE, normalizeAddress } from "@/lib/chain/address";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(64).optional(),
  tab: z.enum(FEED_TABS).default("signal"),
  kind: z.enum(FEED_KINDS).optional(),
  wallet: z.string().regex(ADDRESS_RE).optional(),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/activity — public activity feed, default signal ranking.
 * ?tab=signal|latest|established|disputed, cursor = rank|ISO atau ISO legacy.
 * Viewer SIWE (bila login) aktifkan personal boost; anonim = generik.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    tab: url.searchParams.get("tab") ?? undefined,
    kind: url.searchParams.get("kind") ?? undefined,
    wallet: url.searchParams.get("wallet") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse("bad_request", "Invalid limit, cursor, tab or wallet.", 400);
  }

  try {
    const session = await getSession().catch(() => null);
    const viewer =
      session && session.authenticated && session.walletAddress
        ? session.walletAddress
        : null;
    const page = await getActivityFeed({
      ...parsed.data,
      wallet: parsed.data.wallet
        ? normalizeAddress(parsed.data.wallet)
        : undefined,
      viewer,
    });
    return NextResponse.json(page);
  } catch {
    return errorResponse("internal", "Could not load activity.", 500);
  }
}
