import { indexVouchRegistry } from "@/lib/chain/vouch-registry";
import { indexAttestationRegistry } from "@/lib/chain/attestation-registry";
import { indexDisputeRegistry } from "@/lib/chain/dispute-registry";

// ponytail: manual trigger untuk trial; admin route + cron menyusul kalau perlu.
async function main() {
  let failed = false;
  for (const [name, run] of [
    ["vouch", indexVouchRegistry],
    ["attestation", indexAttestationRegistry],
    ["dispute", indexDisputeRegistry],
  ] as const) {
    try {
      const s = await run();
      if (!s.ok) failed = true;
      console.log(
        `${name}: ${s.ok ? "ok" : `error: ${s.error}`} indexed=${s.indexed} duplicates=${s.duplicates} malformed=${s.malformed} range=${s.fromBlock}-${s.toBlock}`,
      );
    } catch (e) {
      failed = true;
      console.error(`${name}: FAILED — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  process.exitCode = failed ? 1 : 0;
}

main();
