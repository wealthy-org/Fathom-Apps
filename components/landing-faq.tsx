import { LandingSectionHead } from "./landing-section-head";

/**
 * Landing FAQ — native <details> accordion (no JS needed) plus a compact
 * trust-information card. Questions address the strongest objections:
 * scores are not verdicts, vouches can be farmed, money is not trust,
 * and inspection requires no wallet connection.
 */

const FAQ_ITEMS: Array<[string, string]> = [
  [
    "Is the score proof that a wallet is honest?",
    "No. The score is a deterministic compression of available on-chain evidence — a starting point for inspection, not a verdict. Two wallets with the same score can have very different histories behind it. Always read the evidence before you decide.",
  ],
  [
    "Can vouches be farmed?",
    "Attempts exist, which is why vouches are stake-weighted, capped, and monitored for concentration. A vouch carries stake that can be slashed when a claim breaks, and clustered vouching shows up as a risk signal instead of silently inflating a score.",
  ],
  [
    "Isn't a large balance already proof of trustworthiness?",
    "No. Money is not trust. A wallet can be rich and freshly farmed, or modest and battle-tested across years of counterparties. Fathom scores behavior — age, repeat relationships, kept agreements — not wealth.",
  ],
  [
    "Do I need to connect my wallet to inspect someone?",
    "No. Public inspection requires nothing but an address — no connection, no account, no permission. Connecting is only needed to claim your own profile or to sign vouches and attestations.",
  ],
];

const TRUST_INFO: Array<[string, string]> = [
  ["Data", "Public"],
  ["Engine", "Deterministic"],
  ["Identity", "None"],
  ["Scores", "Explained"],
];

export function LandingFaq() {
  return (
    <section id="faq" className="px-6 py-20 sm:py-24 lg:px-10 xl:px-12">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHead
          title="Fair questions, straight answers."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            {FAQ_ITEMS.map(([question, answer]) => (
              <details
                key={question}
                className="card panel-brutal group px-6 py-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg text-ink [&::-webkit-details-marker]:hidden">
                  {question}
                  <span
                    aria-hidden="true"
                    className="font-mono text-accent-ink transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate400">
                  {answer}
                </p>
              </details>
            ))}
          </div>

          <div className="card panel-brutal flex h-fit flex-col bg-mist p-6 sm:p-8">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
              Trust information
            </h3>
            <dl className="mt-4 divide-y divide-black/5">
              {TRUST_INFO.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-3 py-3.5"
                >
                  <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                    {label}
                  </dt>
                  <dd className="font-display text-base text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-sm leading-6 text-slate400">
              Four properties, held everywhere on the page — not just here.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
