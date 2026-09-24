import { WalletShell } from "@/components/wallet-shell";
import { DocsExperience } from "@/components/docs-experience";
import { toJsonSafe } from "@/lib/api/json-safe";
import { getWalletProfile } from "@/lib/wallet/profile";
import { buildReputationPayload } from "@/lib/wallet/reputation-response";

/** Wallet contoh publik — seed data nyata, sama dengan landing/footer. */
const EXAMPLE_WALLET = "0xa6d9e296e6833d211278faf255c76ed193c9ac19";

/**
 * Developer experience docs (Phase 11). Sample hero JSON = data sungguhan
 * EXAMPLE_WALLET via getWalletProfile — bukan mock. Jika DB gagal, fallback
 * statis ber-null (tetap jujur: null = unknown).
 */

const FALLBACK_SAMPLE = `{
  "address": "${EXAMPLE_WALLET}",
  "walletAgeDays": null,
  "uniqueCounterparties": null,
  "repeatCounterparties": null,
  "attestations": 0,
  "activeDisputes": 0,
  "riskSignals": [],
  "riskLevel": null,
  "proofs": [],
  "claim": null,
  "vouches": null,
  "vouchesCount": null,
  "dimensions": [],
  "score": null,
  "tier": null,
  "formulaVersion": "1.1.0-provisional",
  "completeness": "unavailable"
}`;

async function loadSample(): Promise<string> {
  try {
    const profile = await getWalletProfile(EXAMPLE_WALLET);
    const payload = buildReputationPayload(profile);
    // Array besar dipangkas untuk tampilan — nilai di dalamnya tetap nyata.
    const trimmed = {
      ...payload,
      proofs: payload.proofs.slice(0, 2),
      dimensions: payload.dimensions.slice(0, 5),
      vouches:
        payload.vouches === null ? null : payload.vouches.slice(0, 2),
      riskSignals: payload.riskSignals.slice(0, 2),
    };
    return JSON.stringify(toJsonSafe(trimmed), null, 2);
  } catch {
    return FALLBACK_SAMPLE;
  }
}

export default async function DocsPage() {
  const sample = await loadSample();
  return (
    <WalletShell>
      <DocsExperience sampleCode={sample} />
    </WalletShell>
  );
}
