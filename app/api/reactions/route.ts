import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAddress } from "@/lib/chain/address";
import { getSession } from "@/lib/auth/session";
import { authError } from "@/lib/auth/http";
import {
  getMyVote,
  getReactionCounts,
  isReactionKind,
  isValidTargetId,
  saveReaction,
} from "@/lib/reactions/service";
import { db } from "@/lib/db/client";
import { wallets } from "@/lib/db/schema";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const targetSchema = z.object({
  kind: z.string(),
  id: z.string().min(1),
});

/**
 * GET /api/reactions?kind=attestation|dispute|vouch|claim&id=…
 * Counts publik + vote milik viewer (null bila belum login).
 * DISPLAY-ONLY (Spec 04 3.3) — tidak pernah dibaca file scoring.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = targetSchema.safeParse({
    kind: url.searchParams.get("kind"),
    id: url.searchParams.get("id"),
  });
  if (
    !parsed.success ||
    !isReactionKind(parsed.data.kind) ||
    !isValidTargetId(parsed.data.kind, parsed.data.id)
  ) {
    return errorResponse(
      "invalid_request",
      "Query must contain kind=attestation|dispute|vouch|claim and a valid id.",
      400,
    );
  }
  const { kind, id } = parsed.data;

  try {
    const counts = await getReactionCounts(kind, id);
    let myVote = counts.myVote;
    try {
      const session = await getSession();
      if (session.authenticated && session.walletAddress) {
        myVote = await getMyVote(
          kind,
          id,
          normalizeAddress(session.walletAddress),
        );
      }
    } catch {
      // Session rusak = perlakukan sebagai anonim; counts tetap publik.
    }
    return NextResponse.json({
      helpful: counts.helpful,
      notHelpful: counts.notHelpful,
      myVote,
    });
  } catch {
    return errorResponse("server_error", "Could not load reactions.", 500);
  }
}

const voteSchema = targetSchema.extend({
  value: z.enum(["helpful", "not_helpful"]),
});

/**
 * POST /api/reactions — body {kind, id, value}. SIWE-gated; voter =
 * session wallet, bukan body. Satu suara per wallet per target, upsert.
 */
export async function POST(req: Request) {
  const parsedBody = voteSchema.safeParse(await req.json().catch(() => null));
  if (
    !parsedBody.success ||
    !isReactionKind(parsedBody.data.kind) ||
    !isValidTargetId(parsedBody.data.kind, parsedBody.data.id)
  ) {
    return errorResponse(
      "invalid_request",
      'Body must contain { kind, id, value: "helpful" | "not_helpful" }.',
      400,
    );
  }
  const { kind, id, value } = parsedBody.data;

  let session;
  try {
    session = await getSession();
  } catch {
    return authError("server_misconfigured", "Session is not configured.", 500);
  }
  if (!session.authenticated || !session.walletAddress) {
    return errorResponse(
      "unauthenticated",
      "Sign in with your wallet to react.",
      401,
    );
  }
  const voter = normalizeAddress(session.walletAddress);

  try {
    // FK satisfaction bila voter belum punya baris wallets.
    await db.insert(wallets).values({ address: voter }).onConflictDoNothing();
    await saveReaction(kind, id, voter, value);
    return NextResponse.json({ value });
  } catch {
    return errorResponse("server_error", "Could not save reaction.", 500);
  }
}
