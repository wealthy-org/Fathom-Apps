import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getMyActivity } from "@/lib/activity/mine";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().datetime().optional(),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/activity/me — feed milik wallet yang ter-autentikasi (SIWE).
 * Data pribadi sesi: tanpa address di query, gate server-side.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session.authenticated || !session.walletAddress) {
    return errorResponse("unauthenticated", "Connect your wallet first.", 401);
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse("bad_request", "Invalid limit or cursor.", 400);
  }

  try {
    const page = await getMyActivity({
      address: session.walletAddress,
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
    });
    return NextResponse.json(page);
  } catch {
    return errorResponse("internal", "Could not load your activity.", 500);
  }
}
