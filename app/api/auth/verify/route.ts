import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authError } from "@/lib/auth/http";
import { verifyAndClaim } from "@/lib/auth/claim";

const bodySchema = z.object({
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return authError("invalid_request", "Body must contain { message, signature }.", 400);
  }

  const domain = new URL(req.url).host;
  const result = await verifyAndClaim(parsed.data.message, parsed.data.signature, domain);

  if ("code" in result) {
    const map: Record<string, { code: string; message: string; status: number }> = {
      missing_nonce: { code: "missing_nonce", message: result.message, status: 400 },
      invalid_message: { code: "invalid_message", message: result.message, status: 400 },
      invalid_signature: { code: "invalid_signature", message: result.message, status: 401 },
      expired_nonce: { code: "expired_nonce", message: result.message, status: 400 },
      session_error: { code: "session_error", message: result.message, status: 500 },
      wrong_signer: { code: "wrong_signer", message: result.message, status: 403 },
    };
    const e = map[result.code] ?? { code: "claim_failed", message: result.message, status: 400 };
    return authError(e.code, e.message, e.status);
  }

  return NextResponse.json({
    address: result.address,
    authenticated: true,
    alreadyClaimed: result.status === "already_claimed",
  });
}
