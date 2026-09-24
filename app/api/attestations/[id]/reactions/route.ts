import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
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
