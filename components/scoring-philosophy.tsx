/**
 * Scoring Philosophy section (static copy only — no data, no scoring logic).
 *
 * Explains how Fathom derives the provisional score: the evidence pipeline,
 * the primary/supporting/penalty hierarchy, and what the score is not
 * (wealth, popularity, final truth). Rendered in the Evidence tab beside
 * the breakdown so users asking "why?" meet the philosophy there.
 */

const PIPELINE = [
  "Onchain behavior",
  "Economic history",
  "Relationship graph",
  "Attestations",
  "Vouches",
  "Risk signals",
  "Reputation engine",
  "Fathom score",
];

const HIERARCHY: { level: string; items: string }[] = [
  { level: "Primary", items: "Onchain behavior · Economic relationships" },
  { level: "Supporting", items: "Attestations · Vouches" },
  { level: "Penalty / Context", items: "Risk signals" },
];

export function ScoringPhilosophy() {
  return (
    <section aria-label="Scoring Philosophy" className="mt-10">
      <h2 className="font-display text-lg">Scoring Philosophy</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate400">
        Fathom does not treat one number as absolute truth. The score is a
        provisional compression of multiple evidence categories.
      </p>

      <div className="panel-brutal mt-5 space-y-5 p-6">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
            How a score is derived
          </div>
          <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-ink">
            {PIPELINE.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true" className="text-slate400">→</span>}
                <span
                  className={
                    step === "Fathom score"
                      ? "font-bold text-accent-ink"
                      : step === "Risk signals"
                        ? "text-purple"
                        : undefined
                  }
                >
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="border-t-2 border-ink/10 pt-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
            Evidence weight hierarchy
          </div>
          <dl className="mt-2 space-y-1.5 text-sm">
            {HIERARCHY.map((row) => (
              <div key={row.level} className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[160px_1fr] sm:gap-3">
                <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
                  {row.level}
                </dt>
                <dd className="text-slate400">{row.items}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-slate400">
            An overview only — this section assigns no percentages.
            Inspect the evidence below to see what drives the score.
          </p>
        </div>

        <ul className="space-y-1 border-t-2 border-ink/10 pt-4 text-sm text-slate400">
          <li>Evidence before score. Behavior before opinion.</li>
          <li>Reputation ≠ wealth — activity evidences behavior, not credibility.</li>
          <li>
            Reputation ≠ popularity — relationships and vouches are read
            through quality, history, and concentration, not counts.
          </li>
        </ul>
      </div>
    </section>
  );
}
