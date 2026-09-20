import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAddress } from "@/lib/chain/address";
import { toJsonSafe } from "@/lib/api/json-safe";
import { getWalletProfile } from "@/lib/wallet/profile";
import { normalizeAlias, AliasError } from "@/lib/wallet/alias";
import { getSession } from "@/lib/auth/session";
import { authError } from "@/lib/auth/http";
import { db } from "@/lib/db/client";
import { wallets } from "@/lib/db/schema";

const paramsSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

const patchBodySchema = z.object({
  alias: z.string().max(200).nullable(),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/wallets/{address} — publik, tanpa sesi.
 * Basic profile saja (Spec 01). Data historis yang tidak tersedia = null, bukan 0 palsu.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return errorResponse(
      "invalid_address",
      "Address must be a valid EVM address.",
      400,
    );
  }

  try {
    const profile = await getWalletProfile(normalizeAddress(parsed.data.address));
    // ponytail: profile membawa bigint (trustGraph valueSent/valueReceived,
    // vouches stakeAmount, metrics wei) — kirim sebagai string desimal.
    return NextResponse.json(toJsonSafe(profile));
  } catch {
    return errorResponse(
      "server_error",
      "Wallet data is temporarily unavailable.",
      500,
    );
  }
}

/**
 * PATCH /api/wallets/{address} — atur alias (Spec 06). Butuh sesi SIWE.
 * Kepemilikan diambil dari sesi, bukan body; alamat di path harus cocok dengan sesi.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse("invalid_address", "Address must be a valid EVM address.", 400);
  }
  const parsedBody = patchBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return errorResponse("invalid_request", "Body must contain { alias: string | null }.", 400);
  }

  let session;
  try {
    session = await getSession();
  } catch {
    return authError("server_misconfigured", "Session is not configured.", 500);
  }

  const address = normalizeAddress(parsedParams.data.address);
  if (!session.authenticated || !session.walletAddress) {
    return authError("unauthenticated", "Sign in with the wallet you want to edit.", 401);
  }
  // Kepemilikan hanya dari sesi; alamat path harus sama.
  if (normalizeAddress(session.walletAddress) !== address) {
    return authError("forbidden", "You can only edit your own profile.", 403);
  }

  let alias: string | null;
  try {
    alias = normalizeAlias(parsedBody.data.alias);
  } catch (e) {
    if (e instanceof AliasError) return errorResponse(e.code, e.message, 400);
    throw e;
  }

  await db
    .insert(wallets)
    .values({ address, alias })
    .onConflictDoUpdate({
      target: wallets.address,
      set: { alias, updatedAt: new Date() },
    });

  return NextResponse.json({ address, alias });
}
