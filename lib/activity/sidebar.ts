import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  attestations,
  disputes,
  profileClaims,
} from "@/lib/db/schema";

/**
 * Sidebar data for the activity feed (Spec 04 section 3.2).
 * Three small read-only lists, display only — never scoring input.
 */

export const SIDEBAR_LIMIT = 5;

export interface SidebarClaim {
  address: string;
  claimedAt: string;
}

export interface SidebarDispute {
  id: number;
  reporter: string;
  target: string;
  openedAt: string;
}

export interface SidebarAttestation {
  id: number;
  attester: string;
  subject: string;
  role: string;
  createdAt: string;
}

export interface ActivitySidebarData {
  claims: SidebarClaim[];
  disputes: SidebarDispute[];
  attestations: SidebarAttestation[];
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function getActivitySidebar(): Promise<ActivitySidebarData> {
  const [claimRows, disputeRows, attestationRows] = await Promise.all([
    db
      .select({
        address: profileClaims.address,
        claimedAt: profileClaims.claimedAt,
      })
      .from(profileClaims)
      .orderBy(desc(profileClaims.claimedAt))
      .limit(SIDEBAR_LIMIT),
    db
      .select({
        id: disputes.id,
        reporter: disputes.reporterAddress,
        target: disputes.targetAddress,
        openedAt: disputes.openedAt,
      })
      .from(disputes)
      .where(eq(disputes.status, "open"))
      .orderBy(desc(disputes.openedAt))
      .limit(SIDEBAR_LIMIT),
    db
      .select({
        id: attestations.id,
        attester: attestations.attesterAddress,
        subject: attestations.subjectAddress,
        role: attestations.role,
        createdAt: attestations.createdAt,
      })
      .from(attestations)
      .orderBy(desc(attestations.createdAt))
      .limit(SIDEBAR_LIMIT),
  ]);

  return {
    claims: claimRows.map((row) => ({
      address: row.address,
      claimedAt: toIso(row.claimedAt),
    })),
    disputes: disputeRows.map((row) => ({
      id: row.id,
      reporter: row.reporter,
      target: row.target,
      openedAt: toIso(row.openedAt),
    })),
    attestations: attestationRows.map((row) => ({
      id: row.id,
      attester: row.attester,
      subject: row.subject,
      role: row.role,
      createdAt: toIso(row.createdAt),
    })),
  };
}
