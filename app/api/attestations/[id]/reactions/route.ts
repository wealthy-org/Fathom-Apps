import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { normalizeAddress } from "@/lib/chain/address";
import { getSession } from "@/lib/auth/session";
import { authError } from "@/lib/auth/http";
import { db } from "@/lib/db/client";
import { attestationReactions, attestations, wallets } from "@/lib/db/schema";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const bodySchema = z.object({
  value: z.enum(["helpful", "not_helpful"]),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/attestations/{id}/reactions — counts publik + vote milik viewer.
 * Count boleh dibaca anonim; myVote null bila belum login / belum vote.
 * DISPLAY / SORTING ONLY dalam 1 wallet profile — field ini TIDAK PERNAH
 * dibaca oleh score-strategy.ts atau file scoring manapun. Bukan
 * upvote/downvote Ethos: tidak ada +1/-1 ke skor kredibilitas, tidak ada
 * tulis snapshot, tidak ada output score.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse("invalid_request", "Attestation id must be a positive integer.", 400);
  }
  const attestationId = parsedParams.data.id;

  try {
    const exists = await db
      .select({ id: attestations.id })
      .from(attestations)
      .where(eq(attestations.id, attestationId))
      .limit(1);
    if (exists.length === 0) {
      return errorResponse("not_found", "Attestation not found.", 404);
    }

    const rows = await db
      .select({
        value: attestationReactions.value,
        count: sql<number>`count(*)::int`,
      })
      .from(attestationReactions)
      .where(eq(attestationReactions.attestationId, attestationId))
      .groupBy(attestationReactions.value);

    let helpful = 0;
    let notHelpful = 0;
    for (const row of rows) {
      if (row.value === "not_helpful") notHelpful += row.count;
      else helpful += row.count;
    }

    let myVote: "helpful" | "not_helpful" | null = null;
    try {
      const session = await getSession();
      if (session.authenticated && session.walletAddress) {
        const voter = normalizeAddress(session.walletAddress);
        const mine = await db
          .select({ value: attestationReactions.value })
          .from(attestationReactions)
          .where(
            and(
              eq(attestationReactions.attestationId, attestationId),
              eq(attestationReactions.voterAddress, voter),
            ),
          )
          .limit(1);
        const raw = mine[0]?.value;
        myVote = raw === "helpful" || raw === "not_helpful" ? raw : null;
      }
    } catch {
      // Session rusak = perlakukan sebagai anonim; counts tetap publik.
    }

    return NextResponse.json({ helpful, notHelpful, myVote });
  } catch {
    return errorResponse("server_error", "Could not load reactions.", 500);
  }
}

/**
 * POST /api/attestations/{id}/reactions — "Helpful / Not helpful"
 * (Spec 04 section 3.3). SIWE-gated; voter = session wallet, bukan body.
 * Satu suara per wallet per attestation, upsert (ubah suara). Display
 * /sorting only — TIDAK PERNAH dibaca oleh file scoring manapun.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse("invalid_request", "Attestation id must be a positive integer.", 400);
  }
  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return errorResponse(
      "invalid_request",
      "Body must contain { value: \"helpful\" | \"not_helpful\" }.",
      400,
    );
  }

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
    const attestationId = parsedParams.data.id;
    const exists = await db
      .select({ id: attestations.id })
      .from(attestations)
      .where(eq(attestations.id, attestationId))
      .limit(1);
    if (exists.length === 0) {
      return errorResponse("not_found", "Attestation not found.", 404);
    }

    // FK satisfaction bila voter belum punya baris wallets.
    await db.insert(wallets).values({ address: voter }).onConflictDoNothing();

    await db
      .insert(attestationReactions)
      .values({
        attestationId,
        voterAddress: voter,
        value: parsedBody.data.value,
      })
      .onConflictDoUpdate({
        target: [attestationReactions.attestationId, attestationReactions.voterAddress],
        set: { value: parsedBody.data.value, updatedAt: new Date() },
      });

    return NextResponse.json({ value: parsedBody.data.value });
  } catch {
    return errorResponse("server_error", "Could not save reaction.", 500);
  }
}
