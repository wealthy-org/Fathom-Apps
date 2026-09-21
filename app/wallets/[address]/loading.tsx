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

function Metric({ label }: { label: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
        {label}
      </div>
      <Block className="mt-1 h-8 w-1/2" />
    </div>
  );
}

function SectionTitle({ width = "w-40" }: { width?: string }) {
  return <Block className={`h-6 ${width}`} />;
}

// ponytail: static skeleton shaped like the 1-column profile — same section
// order and metric rows as Overview, no spinner, no fake percentages.
export default function WalletProfileLoading() {
  return (
    <div aria-busy="true" aria-label="Loading wallet profile">
      <ProfileLoadingHeader />
      <LoadingStages />

      <div className="mt-10">
        <SectionTitle width="w-44" />
        <div className="panel-brutal mt-5 grid gap-4 p-6">
          <Block className="h-10 w-40" />
          <Block className="h-3 w-64" />
        </div>
      </div>

      <div className="mt-10">
        <SectionTitle width="w-40" />
        <div className="panel-brutal mt-5 space-y-4 p-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i}>
              <Block className="h-3 w-32" />
              <Block className="mt-2 h-3 w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <SectionTitle width="w-44" />
        <div className="panel-brutal mt-5 grid gap-x-6 gap-y-5 p-6">
          {[
            "Wallet age",
            "Transaction count",
            "First transaction",
            "Last activity",
            "Active days",
            "Active months",
            "Transaction frequency",
          ].map((label) => (
            <Metric key={label} label={label} />
          ))}
        </div>
      </div>

      <div className="mt-10">
        <SectionTitle width="w-56" />
        <div className="panel-brutal mt-5 grid gap-4 p-6">
          {[
            "Counterparties",
            "Repeat",
            "Attesters",
            "Active vouches",
            "Open disputes",
            "Longest relationship",
          ].map((label) => (
            <Metric key={label} label={label} />
          ))}
        </div>
      </div>

      <div className="mt-10" aria-label="Loading risk signals">
        <SectionTitle width="w-36" />
        <div className="panel-brutal mt-5 p-6">
          <Block className="h-4 w-56" />
        </div>
      </div>

      <div className="mt-10">
        <SectionTitle width="w-40" />
        <div className="panel-brutal mt-5 grid gap-4 p-6">
          {["Vouches", "Role attestations", "Active disputes"].map((label) => (
            <Metric key={label} label={label} />
          ))}
        </div>
      </div>

      <div className="mt-10">
        <SectionTitle width="w-44" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="panel-brutal p-5">
              <Block className="h-5 w-1/3" />
              <Block className="mt-2 h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <SectionTitle width="w-44" />
        <div className="panel-brutal mt-5 p-6">
          <Block className="h-3 w-64" />
        </div>
      </div>
    </div>
  );
}
