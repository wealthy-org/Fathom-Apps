import { upsertMapping } from "@/lib/chain/protocol-identity";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/wallet/chains";

/**
 * Seed mapping identitas protocol milik Fathom (Fase 2, PRD §15).
 *
 * Hanya memetakan kontrak registry Fathom sendiri — alamat dibaca dari env,
 * bukan dikarang. Interaksi wallet dengan kontrak registry Fathom adalah
 * riwayat protocol Fathom yang genuine, jadi layak jadi proof
 * `protocol_history` terverifikasi (source "curated", status "verified").
 *
 * Kontrak protocol eksternal (DEX/lending/dll) TIDAK di-seed di sini:
 * mapping ambigu = tidak dipakai (lihat pickVerified di protocol-identity.ts).
 * Tambahkan hanya bila ada sumber otoritatif (official/curated terverifikasi).
 *
 * Usage: pnpm db:seed:protocols
 */
async function main(): Promise<void> {
  const entries: Array<[string, string]> = [
    ["FathomVouchRegistry", process.env.FATHOM_VOUCH_REGISTRY_ADDRESS ?? ""],
    [
      "FathomAttestationRegistry",
      process.env.FATHOM_ATTESTATION_REGISTRY_ADDRESS ?? "",
    ],
    [
      "FathomDisputeRegistry",
      process.env.FATHOM_DISPUTE_REGISTRY_ADDRESS ?? "",
    ],
  ];

  let seeded = 0;
  for (const [contractName, address] of entries) {
    if (address.trim() === "") {
      console.log(`[seed:protocols] skip ${contractName} (env unset)`);
      continue;
    }
    await upsertMapping({
      chainId: ROBINHOOD_TESTNET_CHAIN_ID,
      contractAddress: address.trim(),
      protocolId: "fathom",
      protocolName: "Fathom",
      source: "curated",
      verificationStatus: "verified",
    });
    seeded += 1;
    console.log(`[seed:protocols] upserted ${contractName} → fathom`);
  }
  console.log(`[seed:protocols] done seeded=${seeded}`);
}

main().catch((e) => {
  console.error("[seed:protocols] failed", e);
  process.exitCode = 1;
});
