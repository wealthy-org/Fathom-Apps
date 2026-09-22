import { NextResponse } from "next/server";

/**
 * POST /api/disputes — DEPRECATED (410 Gone).
 *
 * Legacy off-chain SIWE path removed: rows it wrote (registry_id NULL)
 * shared the reporter+target unique scope with on-chain registry rows and
 * silently swallowed real DisputeOpened events in the indexer.
 * Disputes are now on-chain only via FathomDisputeRegistry.openDispute;
 * the indexer is the sole writer of the disputes table.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "gone",
        message:
          "Off-chain disputes are deprecated. File disputes on-chain via the dispute registry.",
      },
    },
    { status: 410 },
  );
}
