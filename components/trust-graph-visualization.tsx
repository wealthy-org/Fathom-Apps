"use client";

import type { TrustGraphSummary } from "@/lib/chain/trust-graph";
import type { Address } from "@/lib/score/types";

// ponytail: static radial SVG layout, no graph lib. Node cap keeps large
// graphs readable; full data stays in the stats grid below.
const MAX_NODES = 12;
const MAX_SOCIAL_NODES = 6;
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

type SocialKind = "attester" | "reporter" | "voucher" | "inviter";

interface SocialNode {
  key: string;
  addr: Address;
  kind: SocialKind;
  edgeLabel: string;
  title: string;
}

const SOCIAL_STYLE: Record<SocialKind, { fill: string; stroke: string; dash?: string }> = {
  attester: { fill: "#0B0F17", stroke: "#14F195" },
  reporter: { fill: "#0B0F17", stroke: "#94A3B8", dash: "4 3" },
  voucher: { fill: "#9945FF", stroke: "#14F195" },
  inviter: { fill: "#0B0F17", stroke: "#14F195", dash: "4 3" },
};

export function TrustGraphVisualization({
  graph,
  address,
}: {
  graph: TrustGraphSummary;
  address: Address;
}) {
  // Edge sosial (Fase 3): attester/dispute/vouch/invitation dari tabel Fathom.
  // Vouch dua arah — node adalah sisi lainnya dari subject.
  const social: SocialNode[] = [
    ...graph.attesters.map((a) => ({
      key: `attester:${a.attester}`,
      addr: a.attester,
      kind: "attester" as SocialKind,
      edgeLabel: `attested ${a.role}`,
      title: `${a.attester} attested ${a.role} (${a.relationship})`,
    })),
    ...graph.disputes.map((d) => ({
      key: `reporter:${d.reporter}`,
      addr: d.reporter,
      kind: "reporter" as SocialKind,
      edgeLabel: `disputed (${d.status})`,
      title: `${d.reporter} filed a dispute (${d.status}) — report, not verdict`,
    })),
    ...graph.vouches.map((v) => {
      const other = v.from === address ? v.to : v.from;
      return {
        key: `vouch:${v.from}:${v.to}`,
        addr: other,
        kind: "voucher" as SocialKind,
        edgeLabel: `vouched (${v.status})`,
        title: `Vouch ${v.from} → ${v.to} (${v.status})`,
      };
    }),
    ...(graph.invitedBy !== null
      ? [
          {
            key: `inviter:${graph.invitedBy}`,
            addr: graph.invitedBy,
            kind: "inviter" as SocialKind,
            edgeLabel: "invited by",
            title: `${graph.invitedBy} invited this wallet`,
          },
        ]
      : []),
  ].slice(0, MAX_SOCIAL_NODES);
  const hiddenSocial =
    graph.attesters.length +
    graph.disputes.length +
    graph.vouches.length +
    (graph.invitedBy !== null ? 1 : 0) -
    social.length;

  if (graph.relationships.length === 0 && social.length === 0) {
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
  // Node sosial berbagi ring — sudut disebar di atas total node terlihat.
  const total = shown.length + social.length;
  const nodes = shown.map((rel, i) => {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2;
    return {
      rel,
      x: CX + R * Math.cos(angle),
      y: CY + R * Math.sin(angle),
    };
  });
  const socialPlaced = social.map((s, i) => {
    const angle = (2 * Math.PI * (shown.length + i)) / total - Math.PI / 2;
    return {
      ...s,
      x: CX + R * Math.cos(angle),
      y: CY + R * Math.sin(angle),
    };
  });

  return (
    <div className="shine-border mt-4 rounded-2xl border border-ink/10 bg-ink/[0.03] p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Trust graph for ${address}: ${graph.relationships.length} counterparties, ${social.length} social edges`}
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
              {rel.protocolId !== null
                ? `${rel.protocolName ?? rel.protocolId} (${rel.counterparty}) — verified protocol`
                : rel.counterparty}
              {rel.protocolId === null && rel.isContract ? " (contract)" : ""}
            </title>
            <circle
              cx={x}
              cy={y}
              r={10}
              fill={rel.isContract ? "#9945FF" : "#0B0F17"}
              stroke={rel.protocolId !== null ? "#14F195" : rel.isContract ? "#9945FF" : "#14F195"}
              strokeWidth={rel.protocolId !== null ? 2.5 : 1.5}
            />
            <text
              x={x}
              y={y + 24}
              textAnchor="middle"
              fontSize={10}
              fill={rel.protocolId !== null ? "#14F195" : "#94A3B8"}
              fontFamily="monospace"
            >
              {rel.protocolName ?? shortAddress(rel.counterparty)}
            </text>
          </g>
        ))}
        {socialPlaced.map(({ key, addr, kind, edgeLabel, title, x, y }) => {
          const mx = (CX + x) / 2;
          const my = (CY + y) / 2;
          const style = SOCIAL_STYLE[kind];
          return (
            <g key={key}>
              <title>{title}</title>
              <line
                x1={CX}
                y1={CY}
                x2={x}
                y2={y}
                stroke={style.stroke}
                strokeWidth={1}
                strokeDasharray={style.dash}
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
                {edgeLabel}
              </text>
              <circle
                cx={x}
                cy={y}
                r={10}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={1.5}
                strokeDasharray={style.dash}
              />
              <text
                x={x}
                y={y + 24}
                textAnchor="middle"
                fontSize={10}
                fill={style.stroke}
                fontFamily="monospace"
              >
                {shortAddress(addr)}
              </text>
              <text
                x={x}
                y={y + 36}
                textAnchor="middle"
                fontSize={9}
                fill="#94A3B8"
                fontFamily="monospace"
              >
                {kind}
              </text>
            </g>
          );
        })}
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
      {hiddenSocial > 0 && (
        <p className="mt-1 text-center text-xs text-slate400">
          +{hiddenSocial} more social edges not shown.
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
