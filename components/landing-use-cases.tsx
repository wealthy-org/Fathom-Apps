import { LandingSectionHead } from "./landing-section-head";

/**
 * Section 05 — Expand. Four use-case cards, each backed by the concrete
 * Fathom evidence that makes the case work (pill list = proof tags).
 */

const USE_CASES = [
  {
    title: "Anonymous OTC",
    desc: "Two pseudonymous wallets settle a large trade with more than blind trust — repeat history and stake do the talking.",
    tags: ["Repeat counterparties", "Vouch stake", "Dispute history"],
  },
  {
    title: "DAO & community",
    desc: "Weigh proposals and grants by demonstrated contribution, not by who holds the most tokens.",
    tags: ["Role attestations", "Contribution history", "Sybil checks"],
  },
  {
    title: "Collaboration",
    desc: "Before shipping together, see the counterparties your partner has actually kept — and for how long.",
    tags: ["Longest relationship", "Mutual vouches", "Protocol history"],
  },
  {
    title: "Marketplaces",
    desc: "Screen buyers and sellers against age, patterns, and live risk signals before an escrow opens.",
    tags: ["Wallet age", "Transaction pattern", "Risk signals"],
  },
];

export function LandingUseCases() {
  return (
    <section id="use-cases" className="px-6 py-20 sm:py-24 lg:px-10 xl:px-12">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHead
          title="Trust that travels across contexts."
          sub="The same evidence primitive backs different decisions — each use case is served by the proofs it can actually show."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((useCase) => (
            <div key={useCase.title} className="card panel-brutal p-6">
              <h3 className="font-display text-lg text-ink">
                {useCase.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate400">
                {useCase.desc}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-black/10 pt-4">
                {useCase.tags.map((tag) => (
                  <span key={tag} className="chip-mono text-slate400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
