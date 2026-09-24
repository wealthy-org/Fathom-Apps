import { LandingSectionHead } from "./landing-section-head";

/**
 * Section 04 — Prove. Three evidence-detail cards: a detected risk signal,
 * an open dispute state, and a structured attestation. Shows that risk and
 * disputes are first-class evidence, not hidden. Sample data.
 */

export function LandingProve() {
  return (
    <section id="prove" className="px-6 py-20 sm:py-24 lg:px-10 xl:px-12">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHead
          title="Risk is evidence too."
          sub="Fathom does not hide uncomfortable signals. Risk flags, disputes, and attestations are shown as structured, inspectable objects."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <div className="card panel-brutal p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                Risk signal
              </span>
              <span className="chip-mono bg-purple/10 text-purple">
                detected
              </span>
            </div>
            <h3 className="mt-3 font-display text-lg text-ink">
              High vouch concentration
            </h3>
            <div className="mt-4 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
              <span>Vouch weight from 3 linked wallets</span>
              <span className="text-purple tabular-nums">78%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-black/10 bg-white">
              <div className="h-full w-[78%] rounded-full bg-purple" />
            </div>
            <p className="mt-4 border-t border-black/10 pt-4 text-sm leading-6 text-slate400">
              A flag is the start of an inspection, not a verdict. Open the
              signal to see which wallets cluster and why.
            </p>
          </div>

          <div className="card panel-brutal p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                Dispute state
              </span>
              <span className="chip-mono text-accent-ink">open</span>
            </div>
            <h3 className="mt-3 font-display text-lg text-ink">
              Unfulfilled OTC trade
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  Evidence
                </dt>
                <dd className="text-right text-ink">
                  Settlement never arrived on-chain
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  Reporter
                </dt>
                <dd className="font-mono text-xs text-ink">0x9d3f…b2c1</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  Filed
                </dt>
                <dd className="text-ink">18 days ago</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-black/10 pt-4 text-sm leading-6 text-slate400">
              A dispute is a signed claim by another wallet — weigh it against
              the full evidence, not as proof of wrongdoing.
            </p>
          </div>

          <div className="card panel-brutal p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                Attestation
              </span>
              <span className="chip-mono text-accent-ink">signed</span>
            </div>
            <h3 className="mt-3 font-display text-lg text-ink">
              OTC counterparty
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  Relationship
                </dt>
                <dd className="text-right text-ink">
                  13 trades · 11 months
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  Attested by
                </dt>
                <dd className="font-mono text-xs text-ink">0x71c4…4a3f</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                  Weight
                </dt>
                <dd className="text-ink">Stake-weighted · capped</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-black/10 pt-4 text-sm leading-6 text-slate400">
              Attestations are signed on-chain with skin in the game — vouch
              stake is slashed when a claim breaks.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
