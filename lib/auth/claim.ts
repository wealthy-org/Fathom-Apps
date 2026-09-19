import { SiweMessage } from "siwe";
import { verifyMessage } from "viem";
import { eq, sql } from "drizzle-orm";
import { normalizeAddress } from "@/lib/chain/address";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { profileClaims, wallets } from "@/lib/db/schema";
import type { Address } from "@/lib/score/types";

/** Hasil klaim kepemilikan wallet via SIWE. */
export interface ClaimResult {
  status: "claimed" | "already_claimed";
  address: Address;
  claimedAt: Date;
}

export interface ClaimError {
  code: "missing_nonce" | "invalid_message" | "invalid_signature" | "wrong_signer" | "expired_nonce" | "session_error";
  message: string;
}

/**
 * Verifikasi SIWE dan catat kepemilikan wallet ke profileClaims.
 * Tidak percima body claims; verifikasi kriptografis.
 * Normalisasi address sebelum perbandingan.
 * Idempoten: signer yang sama = keberhasilan tanpa duplikat.
 * Reject: signer berbeda.
 * wallets.claimedAt hanya ditulis saat first claim (coalesce).
 * Satu-satunya canonical write path untuk claimedAt adalah fungsi ini.
 */
export async function verifyAndClaim(
  message: string,
  signature: string,
  domain: string,
): Promise<ClaimResult | ClaimError> {
  let session;
  try {
    session = await getSession();
  } catch {
    return { code: "session_error", message: "Session is not configured." };
  }
  if (!session.nonce) {
    return { code: "missing_nonce", message: "Fetch /api/auth/nonce before verifying." };
  }

  let siweMessage: SiweMessage;
  try {
    siweMessage = new SiweMessage(message);
  } catch {
    return { code: "invalid_message", message: "Message is not valid SIWE." };
  }

  if (siweMessage.nonce !== session.nonce) {
    return { code: "expired_nonce", message: "Nonce mismatch or already consumed." };
  }

  const result = await siweMessage.verify({
    signature: signature as `0x${string}`,
    domain,
    nonce: session.nonce,
    time: new Date().toISOString(),
  });
  if (!result.success) {
    return { code: "invalid_signature", message: `Signature verification failed: ${result.error?.type ?? "unknown"}.` };
  }

  const signer = normalizeAddress(siweMessage.address);

  // Session yang sudah terautentikasi sebagai address lain tidak boleh
  // dibajak oleh signature address berbeda — tolak eksplisit.
  if (
    session.authenticated === true &&
    typeof session.walletAddress === "string" &&
    session.walletAddress !== signer
  ) {
    return { code: "wrong_signer", message: "Session is authenticated as a different address." };
  }

  try {
    const valid = await verifyMessage({ address: signer, message, signature: signature as `0x${string}` });
    if (!valid) {
      return { code: "invalid_signature", message: "Independent signature verification failed." };
    }
  } catch {
    return { code: "invalid_signature", message: "Independent signature verification failed." };
  }

  session.nonce = undefined;
  session.walletAddress = signer;
  session.authenticated = true;
  await session.save();

  const [existing] = await db
    .select()
    .from(profileClaims)
    .where(eq(profileClaims.address, signer))
    .limit(1);

  if (existing) {
    await db
      .update(profileClaims)
      .set({ message, signature, status: "claimed" })
      .where(eq(profileClaims.address, signer));
    return { status: "already_claimed", address: signer, claimedAt: existing.claimedAt };
  }

  const claimedAt = new Date();
  await db.insert(profileClaims).values({ address: signer, status: "claimed", message, signature, claimedAt });
  await db
    .insert(wallets)
    .values({ address: signer, claimedAt })
    .onConflictDoUpdate({
      target: wallets.address,
      set: { claimedAt: sql`coalesce(${wallets.claimedAt}, now())` },
    });

  return { status: "claimed", address: signer, claimedAt };
}
