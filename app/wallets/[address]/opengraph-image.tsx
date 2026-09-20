import { ImageResponse } from "next/og";
import { z } from "zod";
import { normalizeAddress } from "@/lib/chain/address";
import { getWalletProfile } from "@/lib/wallet/profile";
import { metric, truncateAlias } from "@/lib/wallet/card-utils";
import { profileUrl } from "@/lib/wallet/profile-url";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Fathom reputation card for a wallet";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

const VOID = "#f4f5f5";
const ACCENT = "#e34a32";
const PURPLE = "#9945ff";
const SLATE = "#55575c";
const BORDER = "rgba(35,36,39,0.1)";
const INK = "#232427";

function fallbackCard(address: string, reason: string): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
          padding: 64, background: VOID, color: INK, fontFamily: "sans-serif", textAlign: "center",
        }}
      >
        <span style={{ fontSize: 30, letterSpacing: 10, textTransform: "uppercase", color: ACCENT }}>
          Fathom
        </span>
        <span style={{ fontSize: 20, color: SLATE, marginTop: 14 }}>
          Reputation unavailable
        </span>
        <span style={{ fontSize: 24, marginTop: 6 }}>
          {shortAddress(address)}
        </span>
        <span style={{ fontSize: 16, color: SLATE, marginTop: 12, maxWidth: 560 }}>
          {reason}
        </span>
        <span style={{ fontSize: 18, color: SLATE, marginTop: 18 }}>
          Evidence before score — inspect what this wallet actually did.
        </span>
        <span style={{ fontFamily: "monospace", color: ACCENT, marginTop: 24 }}>
          {profileUrl(address as `0x${string}`)}
        </span>
      </div>
    ),
    size,
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  });
}

function riskStateLabel(state?: string): string {
  if (state === "clear") return "Risk clear";
  if (state === "detected") return "Risk signals detected";
  return "Risk not evaluable";
}

export default async function Image({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return new Response("Invalid wallet address", { status: 404 });
  }

  const address = normalizeAddress(parsed.data.address);

  let profile;
  try {
    profile = await getWalletProfile(address);
  } catch {
    return fallbackCard(address, "Wallet profile could not be loaded.");
  }

  const reputation = profile.reputation;
  if (!reputation || !reputation.breakdown) {
    return fallbackCard(address, "Reputation data is still being indexed.");
  }

  const { completeness, tier, totalScore, formulaVersion, availability } = reputation;
  const incomplete = completeness !== "complete";
  const openDisputes = profile.disputes.filter((d) => d.status === "open").length;
  const riskState = availability.riskSignals?.state;
  // Vouches: index state unknown = "—", never a fake zero.
  const vouches = profile.vouchIndex === null ? null : profile.vouches.length;
  // Incomplete walks yield lower bounds — mark them, don't imply exactness.
  const counterparties = profile.trustGraph.complete
    ? String(profile.trustGraph.uniqueCounterparties)
    : `≥${profile.trustGraph.uniqueCounterparties}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 64,
          background: `radial-gradient(circle at 15% 0%, rgba(153,69,255,0.10), transparent 45%), radial-gradient(circle at 85% 100%, rgba(227,74,50,0.10), transparent 45%), ${VOID}`,
          color: INK, fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 30, letterSpacing: 10, textTransform: "uppercase", color: ACCENT }}>
              Fathom
            </span>
            <span style={{ fontSize: 20, letterSpacing: 4, color: SLATE }}>
              PROOF OF REPUTATION
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span style={{ fontSize: 60, color: INK }}>
              {shortAddress(address)}
            </span>
            {truncateAlias(profile.alias) && (
              <span
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  fontSize: 20, padding: "8px 18px", borderRadius: 999,
                  border: `1px solid ${BORDER}`,
                }}
              >
                {truncateAlias(profile.alias)}
                <span style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase", color: SLATE }}>
                  unverified
                </span>
              </span>
            )}
          </div>

          <span style={{ fontSize: 20, color: SLATE }}>
            {(profile.claim?.claimedAt ?? profile.claimedAt)
              ? `Ownership proven · ${formatDate(profile.claim?.claimedAt ?? profile.claimedAt)}`
              : "Unclaimed — owner has not signed in yet."}
          </span>

          <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: SLATE }}>
                Score
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, fontSize: 52, fontWeight: 600, color: INK, fontFamily: "Space Grotesk, sans-serif" }}>
                {totalScore}
                <span style={{ fontSize: 22, color: SLATE }}>/1000</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: SLATE }}>
                Tier
              </div>
              <div style={{ fontSize: 32, color: ACCENT }}>
                {tier ? tier.label : incomplete ? "Incomplete" : "Unavailable"}
              </div>
              <div style={{ fontSize: 13, color: SLATE, marginTop: 4 }}>
                {incomplete
                  ? (completeness === "unavailable" ? "Evidence unavailable" : `${completeness} — evidence still being indexed`)
                  : "Complete"}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: SLATE }}>
                Formula
              </div>
              <div style={{ fontSize: 16, color: INK, fontFamily: "JetBrains Mono, monospace" }}>
                {formulaVersion}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 15, letterSpacing: 2, textTransform: "uppercase", color: SLATE }}>Wallet age</span>
              <span style={{ fontSize: 30, color: INK }}>{metric(profile.walletAgeDays === null ? null : `${profile.walletAgeDays}d`)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 15, letterSpacing: 2, textTransform: "uppercase", color: SLATE }}>Counterparties</span>
              <span style={{ fontSize: 30, color: INK }}>{metric(counterparties)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 15, letterSpacing: 2, textTransform: "uppercase", color: SLATE }}>Vouches</span>
              <span style={{ fontSize: 30, color: INK }}>{metric(vouches)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 15, letterSpacing: 2, textTransform: "uppercase", color: SLATE }}>Disputes</span>
              <span style={{ fontSize: 30, color: INK }}>{metric(openDisputes)}</span>
            </div>
          </div>

          <span style={{ fontSize: 16, color: SLATE }}>
            Risk: {riskStateLabel(riskState)} — score summarizes available evidence.
          </span>

          <span style={{ fontSize: 18, color: SLATE }}>
            Evidence before score — inspect what this wallet actually did.
          </span>
        </div>

        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderTop: `1px solid ${BORDER}`, paddingTop: 24, fontSize: 20,
          }}
        >
          <span style={{ color: ACCENT, fontFamily: "monospace" }}>
            {profileUrl(address as `0x${string}`)}
          </span>
          <span style={{ color: PURPLE, letterSpacing: 4 }}>
            EVIDENCE BEFORE SCORE
          </span>
        </div>
      </div>
    ),
    size,
  );
}
