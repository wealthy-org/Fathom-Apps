"use client";

import type { TrustGraphSummary } from "@/lib/chain/trust-graph";
import type { Address } from "@/lib/score/types";

// ponytail: static radial SVG layout, no graph lib. Node cap keeps large
// graphs readable; full data stays in the stats grid below.
const MAX_NODES = 12;
const W = 600;
const H = 360;
const CX = W / 2;
const CY = H / 2;
const R = 130;
// ponytail: BigInt(0) bukan literal 0n — target TS proyek masih ES2017.
const ZERO = BigInt(0);

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function directionLabel(valueSent: bigint, valueReceived: bigint): string {
  const out = valueSent > ZERO;
  const back = valueReceived > ZERO;
  if (out && back) return "mutual";
  if (out) return "sent";
  return "received";
}

export function TrustGraphVisualization({
  graph,
  address,
}: {
  graph: TrustGraphSummary;
  address: Address;
}) {
  if (graph.relationships.length === 0) {
    return (
      <div className="shine-border mt-4 rounded-2xl border border-ink/10 bg-ink/[0.03] p-6 text-center text-sm text-slate400">
        <svg
          viewBox={`0 0 ${W} 120`}
          role="img"
          aria-label="Empty trust graph"
          className="mx-auto h-28 w-full max-w-md"
        >
          <circle
            cx={W / 2}
            cy={60}
            r={26}
            fill="none"
            stroke="#94A3B8"
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
          <circle cx={W / 2} cy={60} r={4} fill="#14F195" />
        </svg>
        <p className="mt-2">
          No counterparty relationships indexed for this wallet yet.
        </p>
      </div>
    );
  }

  const shown = graph.relationships.slice(0, MAX_NODES);
  const hidden = graph.relationships.length - shown.length;
  const nodes = shown.map((rel, i) => {
    const angle = (2 * Math.PI * i) / shown.length - Math.PI / 2;
    return {
      rel,
      x: CX + R * Math.cos(angle),
      y: CY + R * Math.sin(angle),
    };
  });

  return (
    <div className="shine-border mt-4 rounded-2xl border border-ink/10 bg-ink/[0.03] p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Trust graph for ${address}: ${graph.relationships.length} counterparties`}
        className="h-auto w-full"
      >
        {nodes.map(({ rel, x, y }) => {
          const mx = (CX + x) / 2;
          const my = (CY + y) / 2;
          return (
            <g key={rel.counterparty}>
              <line
                x1={CX}
                y1={CY}
                x2={x}
                y2={y}
                stroke="#9945FF"
                strokeWidth={1}
                opacity={0.55}
              />
              <text
                x={mx}
                y={my}
                textAnchor="middle"
                fontSize={10}
                fill="#94A3B8"
                fontFamily="monospace"
              >
                {rel.interactionCount}×{" "}
                {directionLabel(rel.valueSent, rel.valueReceived)}
              </text>
            </g>
          );
        })}
        {nodes.map(({ rel, x, y }) => (
          <g key={rel.counterparty}>
            <title>
              {rel.counterparty}
              {rel.isContract ? " (contract)" : ""}
            </title>
            <circle
              cx={x}
              cy={y}
              r={10}
              fill={rel.isContract ? "#9945FF" : "#0B0F17"}
              stroke={rel.isContract ? "#9945FF" : "#14F195"}
              strokeWidth={1.5}
            />
            <text
              x={x}
              y={y + 24}
              textAnchor="middle"
              fontSize={10}
              fill="#94A3B8"
              fontFamily="monospace"
            >
              {shortAddress(rel.counterparty)}
            </text>
          </g>
        ))}
        <title>{address}</title>
        <circle cx={CX} cy={CY} r={14} fill="#14F195" />
        <text
          x={CX}
          y={CY + 30}
          textAnchor="middle"
          fontSize={11}
          fill="#14F195"
          fontFamily="monospace"
        >
          {shortAddress(address)}
        </text>
      </svg>
      {hidden > 0 && (
        <p className="mt-1 text-center text-xs text-slate400">
          +{hidden} more counterparties not shown — see stats below.
        </p>
      )}
      {!graph.complete && (
        <p className="mt-1 text-center text-xs text-slate400">
          Transaction walk hit the indexed query limit, so this graph is a
          lower bound — not the full picture.
        </p>
      )}
    </div>
  );
}
