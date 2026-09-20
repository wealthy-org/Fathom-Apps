import { ProfileLoadingHeader } from "@/components/profile-loading-header";
import { LoadingStages } from "@/components/loading-stages";

function Block({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`motion-safe:animate-pulse rounded-2xl bg-ink/10 ${className}`}
    />
  );
}

// ponytail: static skeleton shaped like the profile — address stays
// visible via useParams, no spinner, no fake percentages.
export default function WalletProfileLoading() {
  return (
      <div aria-busy="true" aria-label="Loading wallet profile">
      <ProfileLoadingHeader />
      <LoadingStages />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {["Wallet age", "Transactions", "First tx", "Last tx", "First seen"].map(
          (label) => (
            <div key={label} className="panel-brutal p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
                {label}
              </div>
              <Block className="mt-2 h-8 w-2/3" />
            </div>
          ),
        )}
      </div>

      <div className="panel-brutal mt-10 p-6">
        <Block className="h-5 w-40" />
        <Block className="mt-2 h-8 w-24" />
        <Block className="mt-2 h-3 w-64" />
      </div>

      <div className="mt-10 space-y-3">
        <Block className="h-5 w-52" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel-brutal p-5">
            <Block className="h-5 w-1/3" />
            <Block className="mt-2 h-3 w-full" />
          </div>
        ))}
      </div>

      <div className="panel-brutal mt-10 p-6">
        <Block className="h-5 w-48" />
        <Block className="mt-4 h-64 w-full" />
      </div>

      <div className="mt-10" aria-label="Loading risk signals">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate400">
          Risk signals
        </div>
        <div className="panel-brutal mt-3 p-6">
          <Block className="h-4 w-56" />
        </div>
        <div className="mt-3 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="panel-brutal p-5">
              <Block className="h-5 w-1/3" />
              <Block className="mt-2 h-3 w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 space-y-3">
        <Block className="h-5 w-40" />
        {[0, 1].map((i) => (
          <div key={i} className="panel-brutal p-5">
            <Block className="h-5 w-1/4" />
            <Block className="mt-2 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
