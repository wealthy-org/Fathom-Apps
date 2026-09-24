import { LandingSectionHead } from "./landing-section-head";

/**
 * Section 01 — Introduce. Explains score provenance with a sample
 * "Why 812?" walkthrough (input → evidence → weight → result), the tier
 * boundaries used by the engine, and the four evidence classes. Weights and
 * tier cuts mirror config/thresholds.ts (ScoreStrategyV1 / TierStrategyV1);
 * all figures are sample values consistent with the hero sample wallet
 * (812 / 1000).
 */

const WHY_ROWS: Array<{
  input: string;
  evidence: string;
  weight: string;
  result: string;
  risk?: boolean;
}> = [
  {
    input: "Economic history",
    evidence: "1,284 txs · 24.6 ETH sent · 31.2 received",
    weight: "max 250",
    result: "+228",
  },
  {
    input: "Counterparty history",
    evidence: "148 unique · 31 repeat · 512-day longest",
    weight: "max 200",
    result: "+162",
  },
  {
    input: "Contract history",
    evidence: "9 protocol contracts touched · 3 counted",
    weight: "max 150",
    result: "+128",
  },
  {
    input: "Community trust",
    evidence: "6 active vouches · 4 role attestations (3 counted)",
    weight: "max 300",
    result: "+300",
  },
  {
    input: "Risk signals",
    evidence: "Vouch concentration signal — clear",
    weight: "max −300",
    result: "−6",
    risk: true,
  },
];

/** Mirror of THRESHOLDS.tier.boundaries (TierStrategyV1) — display only. */
const TIER_SEGMENTS = [
  { label: "New", min: 0 },
  { label: "Emerging", min: 250 },
  { label: "Established", min: 500 },
  { label: "Exceptional", min: 750 },
] as const;

/** Sample score marker position inside the tier strip (812 / 1000). */
const SAMPLE_SCORE = 812;
const SAMPLE_LEFT_PCT = (SAMPLE_SCORE / 1000) * 100;

const EVIDENCE_CLASSES = [
  {
    title: "Wallet history",
    desc: "Age, lifespan, and activity patterns from the wallet's indexed past.",
    tag: "wallet proofs",
  },
  {
    title: "Economic history",
    desc: "Flows, volumes, and transaction patterns across the full walk.",
    tag: "economic proofs",
  },
  {
    title: "Relationships",
    desc: "Counterparty graph: unique wallets, repeat interactions, longevity.",
    tag: "counterparty proofs",
  },
  {
    title: "Attestations",
    desc: "Vouches, role attestations, and disputes signed by other wallets.",
    tag: "social proofs",
  },
];

function TierStrip() {
  return (
    <div className="card panel-brutal p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg text-ink">Score tiers</h3>
        <span className="chip-mono text-slate400">0 – 1000</span>
      </div>
      <div className="relative mt-6">
        <div
          role="img"
          aria-label={`Sample score ${SAMPLE_SCORE} falls in the Established tier (500–750)`}
          className="flex h-3 overflow-hidden rounded-full border border-black/10"
        >
          {TIER_SEGMENTS.map((segment, i) => (
            <div
              key={segment.label}
              className={`h-full ${["bg-ink/10", "bg-ink/25", "bg-ink/40", "bg-ink/55"][i]}`}
              style={{ width: "25%" }}
            />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-sm"
          style={{ left: `${SAMPLE_LEFT_PCT}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-4">
        {TIER_SEGMENTS.map((segment) => (
          <div key={segment.label}>
            <div className="font-mono text-[11px] font-semibold text-ink">
              {segment.label}
            </div>
            <div className="font-mono text-[11px] text-slate400 tabular-nums">
              {segment.min}+
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-black/10 pt-3 text-sm leading-6 text-slate400">
        Sample wallet sits at {SAMPLE_SCORE} — Established. Tier cuts and
        weights ship in{" "}
        <span className="font-mono text-xs text-ink">config/thresholds.ts</span>{" "}
        and apply to every wallet the same way.
      </p>
    </div>
  );
}

export function LandingWhyScore() {
  return (
    <section id="why" className="px-6 py-20 sm:py-24 lg:px-10 xl:px-12">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHead
          title="The score is not the product. The evidence is."
          sub="Every number Fathom shows compresses a set of on-chain proofs. Open any score and you get the walkthrough: what went in, what was measured, and what it contributed."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="card panel-brutal overflow-hidden p-0">
            <div className="border-b border-black/10 px-6 py-4">
              <h3 className="font-display text-lg text-ink">
                Why 812?
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                    <th className="px-6 py-3 font-medium">Input</th>
                    <th className="px-6 py-3 font-medium">Evidence</th>
                    <th className="px-6 py-3 text-right font-medium">Weight</th>
                    <th className="px-6 py-3 text-right font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {WHY_ROWS.map((row) => (
                    <tr key={row.input} className="border-b border-black/5">
                      <td className="px-6 py-3.5 font-medium text-ink">
                        {row.input}
                      </td>
                      <td className="px-6 py-3.5 text-slate400">
                        {row.evidence}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs text-slate400">
                        {row.weight}
                      </td>
                      <td
                        className={`px-6 py-3.5 text-right font-mono text-xs font-semibold tabular-nums ${
                          row.risk ? "text-purple" : "text-ink"
                        }`}
                      >
                        {row.result}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-mist">
                    <td
                      colSpan={2}
                      className="px-6 py-4 font-display text-base text-ink"
                    >
                      Fathom Score — compression, not a verdict
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate400">
                      / 1000
                    </td>
                    <td className="px-6 py-4 text-right font-display text-xl font-semibold text-ink tabular-nums">
                      812
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="grid gap-10 sm:grid-cols-2">
              {EVIDENCE_CLASSES.map((klass) => (
                <div key={klass.title} className="card panel-brutal p-5">
                  <h4 className="font-display text-base text-ink">
                    {klass.title}
                  </h4>
                  <p className="mt-1.5 text-sm leading-6 text-slate400">
                    {klass.desc}
                  </p>
                  <span className="chip-mono mt-3 text-slate400">
                    {klass.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
