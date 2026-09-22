import { db } from "@/lib/db/client";
import { flaggedAddresses, maliciousContracts } from "@/lib/db/schema";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/wallet/chains";
import { normalizeAddress } from "@/lib/chain/address";

// ponytail: kurasi berjejak — reason + evidence-ref wajib lewat CLI arg,
// tidak pernah hardcode di file. Baris bisa diaudit ulang dari evidence_ref.
// Usage:
//   pnpm db:seed:risk -- flagged 0xabc... --reason "..." --evidence-ref "https://..."
//   pnpm db:seed:risk -- malicious 0xdef... --reason "..." --evidence-ref "https://..."
const SOURCE = "manual-review";

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : null;
}

async function main() {
  const [kind, addressArg] = process.argv.slice(2);
  const reason = argValue("--reason");
  const evidenceRef = argValue("--evidence-ref");

  if (
    (kind !== "flagged" && kind !== "malicious") ||
    !addressArg ||
    !reason ||
    !evidenceRef
  ) {
    console.error(
      "Usage: pnpm db:seed:risk -- <flagged|malicious> <address> --reason \"...\" --evidence-ref \"https://...\"",
    );
    process.exitCode = 1;
    return;
  }

  let address: string;
  try {
    address = normalizeAddress(addressArg);
  } catch {
    console.error(`Invalid address: ${addressArg}`);
    process.exitCode = 1;
    return;
  }

  const table = kind === "flagged" ? flaggedAddresses : maliciousContracts;
  await db
    .insert(table)
    .values({
      chainId: ROBINHOOD_TESTNET_CHAIN_ID,
      address,
      source: SOURCE,
      reason,
      evidenceReference: evidenceRef,
    })
    .onConflictDoNothing();
  console.log(`Seeded ${kind} address ${address} (reason + evidence-ref recorded)`);
}

void main();
