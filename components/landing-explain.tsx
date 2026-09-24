import { LandingSectionHead } from "./landing-section-head";

/**
 * Section 03 — Explain. Four pipeline steps, each with a miniature UI
 * state: address input, extracted proof fragment, weighting bar, and a
 * decision chip. Static mockups — no inputs are wired.
 */

const STEPS = [
  {
    no: "Step 1",
    title: "Search",
    desc: "Paste any address. No account, no connection, no permission needed.",
    ui: (
      <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
          0x71c4e2…4a3f
        </span>
        <span className="rounded-full bg-coal px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white">
          Check
        </span>
      </div>
    ),
  },
  {
    no: "Step 2",
    title: "Extract proofs",
    desc: "The indexer walks the chain and normalizes raw history into proofs.",
    ui: (
      <pre className="overflow-x-auto rounded-2xl border border-black/10 bg-mist p-3 font-mono text-[10px] leading-5 text-ink">
        {`{
  "type": "wallet_age",
  "ageDays": 876,
  "source": "indexer"
}`}
      </pre>
    ),
  },
  {
    no: "Step 3",
    title: "Weigh & flag",
    desc: "Deterministic weights compress proofs into dimensions and flags.",
    ui: (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
          <span>Economic history</span>
          <span className="text-ink tabular-nums">82/100</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full border border-black/10 bg-white">
          <div className="h-full w-[82%] rounded-full bg-accent" />
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
          <span>Risk signals</span>
          <span className="text-purple">clear</span>
        </div>
      </div>
    ),
  },
  {
    no: "Step 4",
    title: "Decide",
    desc: "You get evidence and context. The trust decision stays yours.",
    ui: (
      <div className="flex flex-wrap gap-2">
        <span className="chip-mono text-accent-ink">Evidence complete</span>
        <span className="chip-mono text-slate400">Your call</span>
      </div>
    ),
  },
];

export function LandingExplain() {
  return (
    <section id="explain" className="px-6 py-20 sm:py-24 lg:px-10 xl:px-12">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHead
          title="From raw chain data to a decision you can defend."
          sub="Four deterministic steps. No black box in the middle — every stage is inspectable on the profile."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div
              key={step.no}
              className="card panel-brutal flex flex-col p-6"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">
                {step.no}
              </span>
              <h3 className="mt-2 font-display text-lg text-ink">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-slate400">
                {step.desc}
              </p>
              <div className="mt-auto pt-5">{step.ui}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
