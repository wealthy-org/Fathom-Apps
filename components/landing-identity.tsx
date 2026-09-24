import { LandingSectionHead } from "./landing-section-head";

/**
 * Section 06 — Trust. Economic identity, not real-world identity:
 * what is never required, what SIWE claiming proves (ownership only),
 * and the trust separation table across the pipeline layers.
 */

const NEVER_REQUIRED = [
  "Real name",
  "Profile photo",
  "Twitter",
  "Email",
  "Discord",
  "Phone",
  "Government ID",
];

const TRUST_SEPARATION: Array<{ layer: string; role: string }> = [
  {
    layer: "Blockchain",
    role: "Holds vouches, attestations, and disputes. Public, verifiable, permanent.",
  },
  {
    layer: "Indexer",
    role: "Walks and normalizes transaction history into reproducible proofs.",
  },
  {
    layer: "Reputation engine",
    role: "Applies deterministic weights from config — same input, same score.",
  },
  {
    layer: "Smart contracts",
    role: "Manage registry lifecycle on-chain. No admin can edit a score.",
  },
  {
    layer: "Your wallet",
    role: "You sign claims with your keys. Keys never leave your hands.",
  },
];

export function LandingIdentity() {
  return (
    <section id="identity" className="px-6 py-20 sm:py-24 lg:px-10 xl:px-12">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHead
          title="Economic identity, not real-world identity."
          sub="Fathom evaluates what a wallet did — never who owns it. A wallet address is the only required identity object."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="card panel-brutal bg-mist p-6 sm:p-8">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
              Never required
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {NEVER_REQUIRED.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full border border-black/10 bg-white px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400 line-through"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-8 border-t-2 border-black/10 pt-6">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                Claiming a profile proves ownership — nothing more
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate400">
                Claiming via Sign-In-With-Ethereum proves you control the
                address. It does not create, increase, or modify reputation —
                reputation comes from wallet evidence alone. A claimed profile
                with no history scores the same as an unclaimed one.
              </p>
            </div>
          </div>

          <div className="card panel-brutal overflow-hidden p-0">
            <div className="border-b border-black/10 px-6 py-4">
              <h3 className="font-display text-lg text-ink">
                Trust separation
              </h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  <th className="px-6 py-3 font-medium">Layer</th>
                  <th className="px-6 py-3 font-medium">Role in the pipeline</th>
                </tr>
              </thead>
              <tbody>
                {TRUST_SEPARATION.map((row) => (
                  <tr key={row.layer} className="border-b border-black/5">
                    <td className="px-6 py-4 align-top font-medium text-ink">
                      {row.layer}
                    </td>
                    <td className="px-6 py-4 leading-6 text-slate400">
                      {row.role}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-black/10 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
              No single layer can forge a score
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
