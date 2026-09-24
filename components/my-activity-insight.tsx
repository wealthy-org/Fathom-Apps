import Link from "next/link";
import type { MyActivityInsight } from "@/lib/activity/mine";
import { avatarHue, shortAddress } from "@/components/activity-utils";

const SPARK_W = 280;
const SPARK_H = 64;

function Sparkline({ daily }: { daily: number[] }) {
  const max = Math.max(...daily, 1);
  const step = daily.length > 1 ? SPARK_W / (daily.length - 1) : SPARK_W;
  const points = daily.map((value, index) => {
    const x = index * step;
    const y = 4 + (1 - value / max) * (SPARK_H - 12);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(" ");
  const area = `0,${SPARK_H} ${line} ${SPARK_W},${SPARK_H}`;

  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="h-16 w-full"
      role="img"
      aria-label={`Daily activity over the last ${daily.length} days`}
      preserveAspectRatio="none"
    >
      <polygon points={area} fill="rgba(227, 74, 50, 0.1)" />
      <polyline
        points={line}
        fill="none"
        stroke="#e34a32"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

const BREAKDOWN_EDGE: Record<keyof MyActivityInsight["breakdown"], string> = {
  attestation: "bg-slate400",
  vouch: "bg-ink",
  dispute: "bg-accent",
};

const BREAKDOWN_LABEL: Record<keyof MyActivityInsight["breakdown"], string> = {
  attestation: "Attestations",
  vouch: "Vouches",
  dispute: "Disputes",
};

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="panel-brutal p-5">
      <h3 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-slate400">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Insight panel kolom kanan: sparkline 30 hari, breakdown per tipe,
 * counterparty paling sering diinteraksikan, dan kartu "why this matters".
 * Semua angka dari baris nyata dalam window THRESHOLDS.activity.
 */
export function MyActivityInsightPanel({
  insight,
  address,
}: {
  insight: MyActivityInsight;
  address: string;
}) {
  const windowLabel = `Last ${insight.windowDays} days · ${insight.total} ${
    insight.total === 1 ? "event" : "events"
  }`;

  return (
    <div className="space-y-3">
      <Panel title="Activity rhythm">
        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
          {windowLabel}
        </p>
        {insight.total === 0 ? (
          <p className="mt-3 text-sm leading-6 text-slate400">
            No activity in this window yet. Attest, vouch or dispute from any
            wallet profile and the line starts to move.
          </p>
        ) : (
          <div className="mt-3">
            <Sparkline daily={insight.daily} />
          </div>
        )}
      </Panel>

      <Panel title="What you did">
        <ul className="mt-3 space-y-3" role="list">
          {(Object.keys(insight.breakdown) as Array<keyof typeof insight.breakdown>).map(
            (kind) => {
              const value = insight.breakdown[kind];
              const pct =
                insight.total === 0 ? 0 : Math.round((value / insight.total) * 100);
              return (
                <li key={kind}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-ink">
                      {BREAKDOWN_LABEL[kind]}
                    </span>
                    <span className="font-mono text-xs text-ink tabular-nums">
                      {value} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10">
                    <div
                      className={`h-full rounded-full ${BREAKDOWN_EDGE[kind]}`}
                      style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </li>
              );
            },
          )}
        </ul>
      </Panel>

      <Panel title="Most interacted with">
        {insight.topCounterparties.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-slate400">
            No counterparties in this window yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3" role="list">
            {insight.topCounterparties.map((party) => (
              <li key={party.address} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{
                    backgroundColor: `hsl(${avatarHue(party.address)} 45% 55%)`,
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm text-accent-ink">
                    {shortAddress(party.address)}
                  </span>
                  <span className="block font-mono text-[10.5px] uppercase tracking-[0.09em] text-slate400">
                    {party.count} {party.count === 1 ? "event" : "events"} in{" "}
                    {insight.windowDays} days
                  </span>
                </span>
                {party.address !== address && (
                  <Link
                    href={`/wallets/${party.address}`}
                    className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.09em] text-accent-ink hover:underline"
                  >
                    Explore →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <section
        aria-label="Why this matters"
        className="rounded-3xl border border-ink/10 bg-mist p-5"
      >
        <h3 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-slate400">
          Why this matters
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate400">
          Every vouch, attestation and dispute you sign is public. Together
          they form your own reputation trail — wallets you endorse shape how
          others read you, so sign with care.
        </p>
      </section>
    </div>
  );
}
