import { db } from "@/lib/db/client";
import { flaggedAddresses, maliciousContracts } from "@/lib/db/schema";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/wallet/chains";
import { normalizeAddress } from "@/lib/chain/address";

// ponytail: address lewat CLI arg biar re-runnable tanpa edit file.
// Usage: npm run db:seed:risk -- <flaggedAddress> [maliciousContractAddress]
const [flaggedArg, maliciousArg] = process.argv.slice(2);

const SOURCE = "manual-review";
const REASON =
  "Test data untuk verifikasi risk detector — bukan flag asli.";

async function main() {
  if (flaggedArg) {
    const address = normalizeAddress(flaggedArg);
    await db
      .insert(flaggedAddresses)
      .values({ chainId: ROBINHOOD_TESTNET_CHAIN_ID, address, source: SOURCE, reason: REASON })
      .onConflictDoNothing();
    console.log(`Seeded flagged address ${address}`);
  }
  if (maliciousArg) {
    const address = normalizeAddress(maliciousArg);
    await db
      .insert(maliciousContracts)
      .values({ chainId: ROBINHOOD_TESTNET_CHAIN_ID, address, source: SOURCE, reason: REASON })
      .onConflictDoNothing();
    console.log(`Seeded malicious contract ${address}`);
  }
  if (!flaggedArg && !maliciousArg) {
    console.error(
      "Usage: npm run db:seed:risk -- <flaggedAddress> [maliciousContractAddress]",
    );
    process.exitCode = 1;
  }
}

main();
