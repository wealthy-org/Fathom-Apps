import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { ADDRESS_RE, normalizeAddress } from "@/lib/chain/address";
import { db } from "@/lib/db/client";
import { wallets, watches } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  target: z.string().regex(ADDRESS_RE),
});

const deleteSchema = z.object({
  target: z.string().regex(ADDRESS_RE),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function viewerOr401(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session.authenticated || !session.walletAddress) return null;
  return session.walletAddress;
}

/**
 * GET /api/watches — daftar target yang di-watch viewer (SIWE).
 * Murni display-order source untuk personalisasi feed.
 */
export async function GET() {
  const session = await getSession();
  const viewer = viewerOr401(session);
  if (!viewer) {
    return errorResponse("unauthenticated", "Connect your wallet first.", 401);
  }
  try {
    const rows = await db
      .select({ target: watches.targetAddress })
      .from(watches)
      .where(eq(watches.watcherAddress, viewer));
    return NextResponse.json({ targets: rows.map((row) => row.target) });
  } catch {
    return errorResponse("internal", "Could not load watches.", 500);
  }
}

/**
 * POST /api/watches {target} — watch wallet. Idempoten.
 */
export async function POST(request: Request) {
  const session = await getSession();
  const viewer = viewerOr401(session);
  if (!viewer) {
    return errorResponse("unauthenticated", "Connect your wallet first.", 401);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("bad_request", "Invalid JSON body.", 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("bad_request", "Invalid target address.", 400);
  }
  try {
    const target = normalizeAddress(parsed.data.target);
    if (target === viewer) {
      return errorResponse("bad_request", "Cannot watch yourself.", 400);
    }
    await db.insert(wallets).values({ address: viewer }).onConflictDoNothing();
    await db.insert(wallets).values({ address: target }).onConflictDoNothing();
    await db
      .insert(watches)
      .values({ watcherAddress: viewer, targetAddress: target })
      .onConflictDoNothing();
    return NextResponse.json({ ok: true, target });
  } catch {
    return errorResponse("internal", "Could not save watch.", 500);
  }
}

/**
 * DELETE /api/watches?target=0x… — unwatch. Idempoten.
 */
export async function DELETE(request: Request) {
  const session = await getSession();
  const viewer = viewerOr401(session);
  if (!viewer) {
    return errorResponse("unauthenticated", "Connect your wallet first.", 401);
  }
  const url = new URL(request.url);
  const parsed = deleteSchema.safeParse({
    target: url.searchParams.get("target") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse("bad_request", "Invalid target address.", 400);
  }
  try {
    const target = normalizeAddress(parsed.data.target);
    await db
      .delete(watches)
      .where(
        and(
          eq(watches.watcherAddress, viewer),
          eq(watches.targetAddress, target),
        ),
      );
    return NextResponse.json({ ok: true, target });
  } catch {
    return errorResponse("internal", "Could not remove watch.", 500);
  }
}
