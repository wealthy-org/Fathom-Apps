import { TrustGraphVisualization } from "./trust-graph-visualization";
import type { TrustGraphSummary } from "@/lib/chain/trust-graph";
import type { Address } from "@/lib/score/types";
import { LandingSectionHead } from "./landing-section-head";

/**
 * Section 02 — Show. Reuses the exact TrustGraphVisualization from the
 * wallet profile page, fed with a sample TrustGraphSummary: subject node
 * + 6 counterparties (edge width = interaction count) + vouch edges
 * (purple) + one attester node. Drag, zoom, hover tooltip, and the legend
 * filter all behave like the real profile page. All data is sample data.
 */

/** Same sample wallet as the hero and /wallets demo profile. */
const SAMPLE_SUBJECT =
  "0xa6d9e296e6833d211278faf255c76ed193c9ac19" as Address;

// ponytail: BigInt("...") bukan literal — target TS proyek masih ES2017.
const WEI_PER_ETH = BigInt("1000000000000000000");

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatEth(value: bigint): string {
  return `${Number(value / WEI_PER_ETH).toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })} ETH`;
}

function rel(
  counterparty: Address,
  interactionCount: number,
  sentEth: string,
  receivedEth: string,
  durationDays: number,
) {
  return {
    counterparty,
    isContract: false,
    protocolId: null,
    protocolName: null,
    interactionCount,
    valueSent: BigInt(sentEth) * WEI_PER_ETH,
    valueReceived: BigInt(receivedEth) * WEI_PER_ETH,
    firstInteractionAt: new Date(Date.now() - durationDays * 86_400_000),
    lastInteractionAt: new Date(Date.now() - 3 * 86_400_000),
    durationDays,
    txHashes: [],
  };
}

const MOCK_RELATIONSHIPS = [
  rel("0x71c4b8e2a4d95f1c30aa827de6b54f90c21d4a3f", 214, "18", "9", 512),
  rel("0x9d3f52c718e4ab06d3fa9521c8e07b4443f9b2c1", 87, "6", "1", 388),
  rel("0x4e21a90d77c35b82ef6014d9a3c85716b8e0f7aa", 156, "12", "4", 461),
  rel("0xb8a24e6193d70fc25a1b88304ce59f7a10dd01de", 23, "1", "0", 142),
  rel("0xc07d31f5a2e8b4967d014cbb8e35a6729f4c6b55", 61, "4", "2", 275),
  rel("0x3f9e8a1247d5c06bf2913e8740acd52f61b3d408", 34, "2", "1", 203),
];

const MOCK_GRAPH: TrustGraphSummary = {
  uniqueCounterparties: 148,
  repeatCounterparties: 31,
  longestRelationshipDays: 512,
  relationships: MOCK_RELATIONSHIPS,
  attesters: [
    {
      attester: "0xc07d31f5a2e8b4967d014cbb8e35a6729f4c6b55",
      role: "otc_counterparty",
      relationship: "repeat settlement partner",
      attestationIds: [],
      createdAt: new Date(Date.now() - 30 * 86_400_000),
    },
  ],
  disputes: [],
  vouches: [
    {
      from: "0x4e21a90d77c35b82ef6014d9a3c85716b8e0f7aa",
      to: SAMPLE_SUBJECT,
      stakeAmount: BigInt("500000000000000000"),
      status: "active",
    },
    {
      from: "0x71c4b8e2a4d95f1c30aa827de6b54f90c21d4a3f",
      to: SAMPLE_SUBJECT,
      stakeAmount: BigInt("1200000000000000000"),
      status: "active",
    },
  ],
  invitedBy: null,
  firstTxHash: null,
  fetchedAt: new Date(),
  complete: true,
};

const TOP_COUNTERPARTIES = MOCK_RELATIONSHIPS.map((r) => ({
  wallet: shortAddress(r.counterparty),
  txns: r.interactionCount,
  volume: formatEth(r.valueSent + r.valueReceived),
  age: `${r.durationDays}d`,
})).sort((a, b) => b.txns - a.txns);

const RELATIONSHIP_METRICS = [
  { label: "Unique counterparties", value: "148" },
  { label: "Repeat (2+ interactions)", value: "31" },
  { label: "Longest relationship", value: "512 days" },
  { label: "Active vouches", value: "2" },
];

export function LandingTrustGraph() {
  return (
    <section id="graph" className="px-6 py-20 sm:py-24 lg:px-10 xl:px-12">
      <div className="mx-auto max-w-7xl">
        <LandingSectionHead
          title="Who economically interacts with this wallet?"
          sub="Relationships carry more signal than raw balances. The graph reads real transfers, vouches, and attestations — edge weight is interaction count, purple nodes are vouchers, accent rings are attesters. Drag nodes, zoom, and click legend entries to filter."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="card panel-brutal p-4 sm:p-6">
            <TrustGraphVisualization
              graph={MOCK_GRAPH}
              address={SAMPLE_SUBJECT}
            />
          </div>

          <div className="flex flex-col gap-6">
            <div className="card panel-brutal overflow-hidden p-0">
              <div className="border-b border-black/10 px-6 py-4">
                <h3 className="font-display text-lg text-ink">
                  Top counterparties
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10 font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                      <th className="px-6 py-3 font-medium">Wallet</th>
                      <th className="px-6 py-3 text-right font-medium">
                        Txns
                      </th>
                      <th className="px-6 py-3 text-right font-medium">
                        Volume
                      </th>
                      <th className="px-6 py-3 text-right font-medium">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOP_COUNTERPARTIES.map((row) => (
                      <tr key={row.wallet} className="border-b border-black/5">
                        <td className="px-6 py-3 font-mono text-xs text-ink">
                          {row.wallet}
                        </td>
                        <td className="px-6 py-3 text-right text-slate400 tabular-nums">
                          {row.txns}
                        </td>
                        <td className="px-6 py-3 text-right text-slate400">
                          {row.volume}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-xs text-slate400">
                          {row.age}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <dl className="card panel-brutal grid grid-cols-2 gap-x-6 gap-y-5 p-6">
              {RELATIONSHIP_METRICS.map((metric) => (
                <div key={metric.label}>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 font-display text-2xl text-ink tabular-nums">
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
