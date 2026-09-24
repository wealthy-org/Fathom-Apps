import { SearchWalletForm } from "@/components/search-wallet-form";

/**
 * Section 08 — Act. Dark full-width CTA with the demo search box
 * (fills the hero sample card, scrolls to top — no backend call) and
 * no-signup reassurance pills.
 */

export function LandingAct() {
  return (
    <section id="act" className="px-5 pb-24 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2.5rem] bg-coal px-6 py-16 sm:px-12 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-medium tracking-tight text-white sm:text-5xl">
            Would you paste an unknown wallet here first?
          </h2>
          <p className="mt-4 text-base leading-7 text-white/60">
            Check it before the transfer, the trade, or the collaboration. One
            address is all it takes.
          </p>
          <div className="mx-auto mt-9 max-w-xl [&_.btn-brutal:hover]:bg-accent-ink [&_.btn-brutal]:bg-accent">
            <SearchWalletForm />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["No signup"].map((pill) => (
              <span
                key={pill}
                className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
