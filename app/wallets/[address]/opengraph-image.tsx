import { ImageResponse } from "next/og";
import { z } from "zod";
import { normalizeAddress } from "@/lib/chain/address";
import { getWalletProfile } from "@/lib/wallet/profile";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Fathom reputation card for a wallet";

// Profil dibaca dari DB/explorer — tidak boleh di-cache statis.
export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

// Warna dari app/globals.css (@theme). Route OG tidak bisa pakai kelas Tailwind.
const VOID = "#f6f8fa";
const ACCENT = "#0f9d63";
const PURPLE = "#9945ff";
const SLATE = "#64748b";
const BORDER = "rgba(15,23,42,0.12)";
const INK = "#0b0f17";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Null = tidak diketahui; tampilkan "—", jangan pernah 0 palsu. */
function metric(value: string | number | null): string {
  if (value === null) return "—";
  return String(value);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "20px 22px",
        borderRadius: 18,
        border: `1px solid ${BORDER}`,
        background: "rgba(15,23,42,0.03)",
      }}
    >
      <span
        style={{
          fontSize: 15,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: SLATE,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 34, color: INK }}>{value}</span>
    </div>
  );
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
  const profile = await getWalletProfile(address);

  const openDisputes = profile.disputes.filter(
    (dispute) => dispute.status === "open",
  ).length;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: `radial-gradient(circle at 15% 0%, rgba(153,69,255,0.10), transparent 45%), radial-gradient(circle at 85% 100%, rgba(20,241,149,0.10), transparent 45%), ${VOID}`,
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 30,
                letterSpacing: 10,
                textTransform: "uppercase",
                color: ACCENT,
              }}
            >
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
            {profile.alias && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 22,
                  padding: "8px 18px",
                  borderRadius: 999,
                  border: `1px solid ${BORDER}`,
                }}
              >
                {profile.alias}
                <span
                  style={{
                    fontSize: 14,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: SLATE,
                  }}
                >
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
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <Metric
              label="Wallet age"
              value={
                profile.walletAgeDays === null
                  ? "—"
                  : `${profile.walletAgeDays}d`
              }
            />
            <Metric label="Transactions" value={metric(profile.txCount)} />
            <Metric
              label="Counterparties"
              value={metric(profile.trustGraph.uniqueCounterparties)}
            />
            <Metric
              label="Repeat"
              value={metric(profile.trustGraph.repeatCounterparties)}
            />
            <Metric
              label="Attestations"
              value={metric(profile.attestations.length)}
            />
            <Metric label="Open disputes" value={metric(openDisputes)} />
          </div>
          <span style={{ fontSize: 18, color: SLATE }}>
            Evidence before score — inspect what this wallet actually did.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${BORDER}`,
            paddingTop: 24,
            fontSize: 20,
          }}
        >
          <span style={{ color: ACCENT, fontFamily: "monospace" }}>
            /wallets/{address}
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
