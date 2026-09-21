"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { drag } from "d3-drag";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity } from "d3-zoom";
import type { ZoomBehavior } from "d3-zoom";
import type { TrustGraphSummary } from "@/lib/chain/trust-graph";
import type { Address } from "@/lib/score/types";

// ponytail: D3 owns SVG/sim/drag/zoom via refs; React owns props + legend
// filter + tooltip state. Visual cap only — underlying graph data untouched.
const MAX_NODES = 12;
const MAX_SOCIAL_NODES = 6;
const VB_W = 900;
const VB_H = 560;
const CX = VB_W / 2;
const CY = VB_H / 2;
// ponytail: BigInt(0) bukan literal 0n — target TS proyek masih ES2017.
const ZERO = BigInt(0);

type NodeKind =
  | "primary"
  | "counterparty"
  | "contract"
  | "protocol"
  | "attester"
  | "reporter"
  | "voucher"
  | "inviter";

interface GNode extends SimulationNodeDatum {
  id: string;
  kind: NodeKind;
  addr: Address;
  label: string;
  sublabel: string | null;
  radius: number;
  interactionCount: number | null;
  direction: string | null;
  protocolName: string | null;
  isContract: boolean;
  note: string | null;
}

interface GLink extends SimulationLinkDatum<GNode> {
  kind: NodeKind;
  width: number;
  dashed: string | null;
  label: string | null;
}

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

// ponytail: log scale + hard clamp so one whale counterparty can't wreck layout.
function counterpartyRadius(count: number, boost: number): number {
  const r = 10 + 8 * Math.log10(1 + Math.max(0, count)) + boost;
  return Math.min(20, Math.max(10, r));
}

function edgeWidth(count: number): number {
  return 1 + Math.min(2, Math.log10(1 + Math.max(0, count)));
}

const NODE_STYLE: Record<NodeKind, { fill: string; stroke: string; sw: number; dash: string | null }> = {
  primary: { fill: "#E34A32", stroke: "#232427", sw: 3, dash: null },
  counterparty: { fill: "#232427", stroke: "#55575C", sw: 1.5, dash: null },
  contract: { fill: "#9945FF", stroke: "#232427", sw: 2, dash: null },
  protocol: { fill: "#232427", stroke: "#E34A32", sw: 2.5, dash: null },
  attester: { fill: "#232427", stroke: "#E34A32", sw: 2, dash: null },
  reporter: { fill: "#232427", stroke: "#777980", sw: 1.5, dash: "4 3" },
  voucher: { fill: "#9945FF", stroke: "#E34A32", sw: 2, dash: null },
  inviter: { fill: "#232427", stroke: "#55575C", sw: 1.5, dash: "4 3" },
};

const EDGE_STYLE: Record<NodeKind, { stroke: string; dash: string | null }> = {
  primary: { stroke: "#E34A32", dash: null },
  counterparty: { stroke: "#55575C", dash: null },
  contract: { stroke: "#9945FF", dash: null },
  protocol: { stroke: "#E34A32", dash: null },
  attester: { stroke: "#E34A32", dash: null },
  reporter: { stroke: "#777980", dash: "5 4" },
  voucher: { stroke: "#9945FF", dash: null },
  inviter: { stroke: "#55575C", dash: "5 4" },
};

const LEGEND_META: { kind: NodeKind; label: string; desc: string }[] = [
  { kind: "primary", label: "Subject", desc: "Analyzed wallet" },
  { kind: "counterparty", label: "Counterparty", desc: "Wallet" },
  { kind: "contract", label: "Contract", desc: "Unmapped contract" },
  { kind: "protocol", label: "Protocol", desc: "Verified protocol" },
  { kind: "attester", label: "Attester", desc: "Attested a role" },
  { kind: "reporter", label: "Reporter", desc: "Report, not verdict" },
  { kind: "voucher", label: "Voucher", desc: "Vouch edge" },
  { kind: "inviter", label: "Inviter", desc: "Invited this wallet" },
];

export function TrustGraphVisualization({
  graph,
  address,
}: {
  graph: TrustGraphSummary;
  address: Address;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hidden, setHidden] = useState<Set<NodeKind>>(new Set());
  const [tip, setTip] = useState<{ x: number; y: number; node: GNode } | null>(null);

  const built = useMemo(() => {
    const shownRels = graph.relationships.slice(0, MAX_NODES);
    const socialRaw: {
      key: string;
      addr: Address;
      kind: NodeKind;
      edgeLabel: string;
      note: string | null;
      sub: string;
    }[] = [
      ...graph.attesters.map((a) => ({
        key: `attester:${a.attester}`,
        addr: a.attester as Address,
        kind: "attester" as NodeKind,
        edgeLabel: `attested ${a.role}`,
        note: `${a.relationship} · ${a.attestationIds.length > 0 ? "on-chain" : "off-chain"}`,
        sub: "attester",
      })),
      ...graph.disputes.map((d) => ({
        key: `reporter:${d.reporter}`,
        addr: d.reporter as Address,
        kind: "reporter" as NodeKind,
        edgeLabel: `disputed (${d.status})`,
        note: "Report, not verdict",
        sub: `dispute · ${d.status}`,
      })),
      ...graph.vouches.map((v) => ({
        key: `vouch:${v.from}:${v.to}`,
        addr: (v.from === address ? v.to : v.from) as Address,
        kind: "voucher" as NodeKind,
        edgeLabel: `vouched (${v.status})`,
        note: `${v.from === address ? "outgoing" : "incoming"} · ${v.status}`,
        sub: "voucher",
      })),
      ...(graph.invitedBy !== null
        ? [
            {
              key: `inviter:${graph.invitedBy}`,
              addr: graph.invitedBy as Address,
              kind: "inviter" as NodeKind,
              edgeLabel: "invited by",
              note: "Invitation edge",
              sub: "inviter",
            },
          ]
        : []),
    ];
    const social = socialRaw.slice(0, MAX_SOCIAL_NODES);

    const primary: GNode = {
      id: `primary:${address}`,
      kind: "primary",
      addr: address,
      label: shortAddress(address),
      sublabel: "subject",
      radius: 26,
      interactionCount: null,
      direction: null,
      protocolName: null,
      isContract: false,
      note: "Wallet being analyzed",
      x: CX,
      y: CY,
      fx: CX,
      fy: CY,
    };

    const total = shownRels.length + social.length;
    const spread = (i: number) => (total <= 1 ? -Math.PI / 2 : (2 * Math.PI * i) / total - Math.PI / 2);

    const relNodes: GNode[] = shownRels.map((rel, i) => {
      const kind: NodeKind =
        rel.protocolId !== null ? "protocol" : rel.isContract ? "contract" : "counterparty";
      const dir = directionLabel(rel.valueSent, rel.valueReceived);
      const angle = spread(i);
      return {
        id: `rel:${rel.counterparty}`,
        kind,
        addr: rel.counterparty,
        label: rel.protocolName ?? shortAddress(rel.counterparty),
        sublabel: rel.protocolName ? shortAddress(rel.counterparty) : dir,
        radius: counterpartyRadius(rel.interactionCount, rel.protocolId !== null ? 2 : 0),
        interactionCount: rel.interactionCount,
        direction: dir,
        protocolName: rel.protocolName,
        isContract: rel.isContract,
        note: rel.protocolId !== null ? "Verified protocol" : rel.isContract ? "Contract" : null,
        x: CX + 210 * Math.cos(angle) + (i % 2 === 0 ? 18 : -18),
        y: CY + 190 * Math.sin(angle) + (i % 3 === 0 ? 14 : -14),
      };
    });

    const socialNodes: GNode[] = social.map((s, i) => {
      const angle = spread(shownRels.length + i);
      return {
        id: s.key,
        kind: s.kind,
        addr: s.addr,
        label: shortAddress(s.addr),
        sublabel: s.sub,
        radius: s.kind === "voucher" ? 11 : 10,
        interactionCount: null,
        direction: null,
        protocolName: null,
        isContract: false,
        note: s.note,
        x: CX + 210 * Math.cos(angle) + 12,
        y: CY + 190 * Math.sin(angle) - 12,
      };
    });

    const nodes: GNode[] = [primary, ...relNodes, ...socialNodes];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: GLink[] = [...relNodes, ...socialNodes].map((n) => {
      const rel = shownRels.find((r) => `rel:${r.counterparty}` === n.id);
      const width =
        n.kind === "protocol"
          ? edgeWidth(rel?.interactionCount ?? 0) + 0.75
          : n.interactionCount !== null
            ? edgeWidth(n.interactionCount)
            : 1.25;
      // ponytail: label only meaningful edges — avoids clutter.
      const label =
        rel && rel.interactionCount >= 3
          ? `${rel.interactionCount}× ${directionLabel(rel.valueSent, rel.valueReceived)}`
          : n.kind === "attester" || n.kind === "voucher" || n.kind === "reporter" || n.kind === "inviter"
            ? n.sublabel
            : null;
      return {
        source: primary,
        target: byId.get(n.id) as GNode,
        kind: n.kind,
        width,
        dashed: EDGE_STYLE[n.kind].dash,
        label,
      };
    });

    const hiddenRel = graph.relationships.length - shownRels.length;
    const hiddenSocial =
      graph.attesters.length + graph.disputes.length + graph.vouches.length + (graph.invitedBy !== null ? 1 : 0) - social.length;
    const kindsPresent = new Set<NodeKind>(["primary", ...nodes.slice(1).map((n) => n.kind)]);
    return { nodes, links, primary, hiddenRel, hiddenSocial, kindsPresent, empty: nodes.length <= 1 };
  }, [graph, address]);

  // Main D3 render — rebuild only when graph data changes.
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || built.empty) return;
    const svg = select(svgEl);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    (Object.keys(EDGE_STYLE) as NodeKind[]).forEach((k) => {
      defs
        .append("marker")
        .attr("id", `arrow-${k}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 7)
        .attr("markerHeight", 7)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", EDGE_STYLE[k].stroke)
        .attr("opacity", 0.9);
    });

    const zoomBehavior = zoom<SVGSVGElement, unknown>().scaleExtent([0.15, 5]).on("zoom", (e) => {
      g.attr("transform", e.transform.toString());
    });
    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);
    // ponytail: default viewport already framed; no initial transform needed.

    const g = svg.append("g");

    const linkSel = g
      .append("g")
      .selectAll("line")
      .data(built.links)
      .join("line")
      .attr("data-kind", (d) => d.kind)
      .attr("stroke", (d) => EDGE_STYLE[d.kind].stroke)
      .attr("stroke-width", (d) => d.width)
      .attr("stroke-dasharray", (d) => d.dashed ?? null)
      .attr("opacity", 0.75)
      .attr("marker-end", (d) => `url(#arrow-${d.kind})`);

    const edgeLabelSel = g
      .append("g")
      .selectAll("text")
      .data(built.links.filter((l) => l.label !== null))
      .join("text")
      .attr("data-kind", (d) => d.kind)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("font-family", "monospace")
      .attr("fill", "#777980")
      .attr("pointer-events", "none")
      .text((d) => d.label as string);

    const nodeSel = g
      .append("g")
      .selectAll<SVGGElement, GNode>("g")
      .data(built.nodes)
      .join("g")
      .attr("data-kind", (d) => d.kind)
      .style("cursor", "grab");

    nodeSel
      .filter((d) => d.kind === "primary")
      .append("circle")
      .attr("r", (d) => d.radius + 8)
      .attr("fill", "none")
      .attr("stroke", "#E34A32")
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", 2);

    nodeSel
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => NODE_STYLE[d.kind].fill)
      .attr("stroke", (d) => NODE_STYLE[d.kind].stroke)
      .attr("stroke-width", (d) => NODE_STYLE[d.kind].sw)
      .attr("stroke-dasharray", (d) => NODE_STYLE[d.kind].dash ?? null);

    nodeSel
      .filter((d) => d.kind === "primary")
      .append("circle")
      .attr("r", 5)
      .attr("fill", "#232427");

    nodeSel
      .append("text")
      .attr("y", (d) => d.radius + 15)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => (d.kind === "primary" ? 12 : 10))
      .attr("font-weight", (d) => (d.kind === "primary" ? 700 : 400))
      .attr("font-family", "monospace")
      .attr("fill", (d) => (d.kind === "protocol" || d.kind === "primary" ? "#B93A26" : "#232427"))
      .attr("pointer-events", "none")
      .text((d) => d.label);

    nodeSel
      .filter((d) => d.sublabel !== null)
      .append("text")
      .attr("y", (d) => d.radius + 27)
      .attr("text-anchor", "middle")
      .attr("font-size", 9)
      .attr("font-family", "monospace")
      .attr("fill", "#55575C")
      .attr("pointer-events", "none")
      .text((d) => d.sublabel as string);

    const sim = forceSimulation<GNode>(built.nodes)
      .force(
        "link",
        forceLink<GNode, GLink>(built.links)
          .id((d) => d.id)
          .distance((l) => (l.kind === "protocol" ? 150 : 115))
          .strength(0.55),
      )
      .force("charge", forceManyBody().strength(-260))
      .force("center", forceCenter(CX, CY))
      .force(
        "collide",
        forceCollide<GNode>().radius((d) => d.radius + 18).strength(0.9),
      )
      .alphaDecay(0.05);

    sim.on("tick", () => {
      linkSel
        .attr("x1", (d) => shorten(d, "source"))
        .attr("y1", (d) => shorten(d, "source", true))
        .attr("x2", (d) => shorten(d, "target"))
        .attr("y2", (d) => shorten(d, "target", true));
      edgeLabelSel
        .attr("x", (d) => mid(d, "x"))
        .attr("y", (d) => mid(d, "y"));
      nodeSel.attr("transform", (d) => `translate(${d.x ?? CX},${d.y ?? CY})`);
    });

    function point(d: GLink, end: "source" | "target"): GNode {
      return d[end] as GNode;
    }
    // ponytail: stop edges at node boundary so arrows never pierce the node.
    function shorten(d: GLink, end: "source" | "target", y = false): number {
      const s = point(d, "source");
      const t = point(d, "target");
      const sx = s.x ?? CX;
      const sy = s.y ?? CY;
      const tx = t.x ?? CX;
      const ty = t.y ?? CY;
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const pad = end === "source" ? s.radius + 2 : t.radius + 8;
      const px = end === "source" ? sx + (dx / dist) * pad : tx - (dx / dist) * pad;
      const py = end === "source" ? sy + (dy / dist) * pad : ty - (dy / dist) * pad;
      return y ? py : px;
    }
    function mid(d: GLink, axis: "x" | "y"): number {
      const s = point(d, "source");
      const t = point(d, "target");
      const sx = s.x ?? CX;
      const sy = s.y ?? CY;
      const tx = t.x ?? CX;
      const ty = t.y ?? CY;
      return axis === "x" ? (sx + tx) / 2 : (sy + ty) / 2 - 4;
    }

    const dragBehavior = drag<SVGGElement, GNode>()
      .on("start", (e, d) => {
        if (!e.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (e, d) => {
        d.fx = e.x;
        d.fy = e.y;
      })
      .on("end", (e, d) => {
        if (!e.active) sim.alphaTarget(0);
        if (d.kind === "primary") {
          d.fx = CX;
          d.fy = CY;
        } else {
          d.fx = null;
          d.fy = null;
        }
      });
    nodeSel.call(dragBehavior);

    nodeSel
      .on("mouseenter", (e: MouseEvent, d) => {
        const el = e.currentTarget as SVGGElement | null;
        if (el) select(el).selectAll("circle").attr("stroke-width", NODE_STYLE[d.kind].sw + 1.5);
        setTip({ x: e.clientX, y: e.clientY, node: { ...d } });
      })
      .on("mousemove", (e: MouseEvent, d) => {
        setTip({ x: e.clientX, y: e.clientY, node: { ...d } });
      })
      .on("mouseleave", (e: MouseEvent, d) => {
        const el = e.currentTarget as SVGGElement | null;
        if (el) select(el).selectAll("circle").attr("stroke-width", NODE_STYLE[d.kind].sw);
        setTip(null);
      });

    return () => {
      sim.stop();
      svg.on(".zoom", null);
      svg.selectAll("*").remove();
    };
  }, [built]);

  // Legend visual filter — opacity only, data intact.
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = select(svgEl);
    svg.selectAll<SVGGElement, GNode>("g[data-kind]").each(function (d) {
      if (!d) return;
      const isHidden = hidden.has(d.kind);
      const el = select(this);
      if (this.tagName.toLowerCase() === "line" || this.tagName.toLowerCase() === "text") {
        el.attr("opacity", isHidden ? 0.06 : null);
        const tag = this.tagName.toLowerCase();
        if (tag === "line") el.attr("opacity", isHidden ? 0.06 : 0.75);
        if (tag === "text") el.style("display", isHidden ? "none" : "inline");
      } else {
        el.attr("opacity", isHidden ? 0.08 : 1).style("pointer-events", isHidden ? "none" : "auto");
      }
    });
  }, [hidden, built]);

  function toggleKind(kind: NodeKind): void {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function zoomBy(factor: number): void {
    const svgEl = svgRef.current;
    const zoomBehavior = zoomRef.current;
    if (!svgEl || !zoomBehavior) return;
    select(svgEl).transition().duration(200).call(zoomBehavior.scaleBy, factor);
  }

  function resetZoom(): void {
    const svgEl = svgRef.current;
    const zoomBehavior = zoomRef.current;
    if (!svgEl || !zoomBehavior) return;
    select(svgEl).transition().duration(300).call(zoomBehavior.transform, zoomIdentity);
  }

  if (built.empty) {
    return (
      <div className="panel-brutal mt-4 p-6 text-center text-sm text-slate400">
        <svg viewBox={`0 0 ${VB_W} 120`} role="img" aria-label="Empty trust graph" className="mx-auto h-28 w-full max-w-md">
          <circle cx={VB_W / 2} cy={60} r={26} fill="none" stroke="#777980" strokeWidth={1.5} strokeDasharray="5 5" />
          <circle cx={VB_W / 2} cy={60} r={4} fill="#E34A32" />
        </svg>
        <p className="mt-2">No counterparty relationships indexed for this wallet yet.</p>
      </div>
    );
  }

  const tipLeft = tip ? (tip.x + 16 > window.innerWidth - 280 ? tip.x - 264 : tip.x + 16) : 0;
  const tipTop = tip ? (tip.y + 16 > window.innerHeight - 220 ? tip.y - 200 : tip.y + 16) : 0;

  return (
    <div className="mt-4 flex flex-col gap-4 lg:flex-row">
      <aside className="panel-brutal w-full shrink-0 p-3 lg:w-60">
        <p className="font-mono text-[11px] font-bold tracking-widest text-ink uppercase">Legend</p>
        <p className="mt-0.5 font-mono text-[11px] text-slate400">Click to hide / show</p>
        <ul className="mt-2 space-y-1">
          {LEGEND_META.filter((m) => built.kindsPresent.has(m.kind)).map((m) => {
            const off = hidden.has(m.kind);
            return (
              <li key={m.kind}>
                <button
                  type="button"
                  aria-pressed={!off}
                  onClick={() => toggleKind(m.kind)}
                  className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-opacity ${
                    off ? "border-ink/10 opacity-40" : "border-ink/15"
                  }`}
                >
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full border"
                    style={{ backgroundColor: NODE_STYLE[m.kind].fill, borderColor: NODE_STYLE[m.kind].stroke }}
                  />
                  <span className="min-w-0">
                    <span className="block font-mono text-[11px] font-bold text-ink">{m.label}</span>
                    <span className="block truncate font-mono text-[11px] text-slate400">{m.desc}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="panel-brutal min-w-0 flex-1">
        <div className="relative h-[420px] overflow-hidden lg:h-[560px]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            role="img"
            aria-label={`Trust graph for ${address}: ${graph.relationships.length} counterparties`}
            className="h-full w-full"
          />
          <div className="absolute top-3 right-3 flex gap-1.5">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomBy(1.4)}
              className="min-touch flex items-center justify-center rounded-full border border-black/10 bg-white font-mono text-lg font-bold shadow-sm"
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomBy(1 / 1.4)}
              className="min-touch flex items-center justify-center rounded-full border border-black/10 bg-white font-mono text-lg font-bold shadow-sm"
            >
              −
            </button>
            <button
              type="button"
              aria-label="Reset zoom"
              onClick={resetZoom}
              className="min-touch flex items-center justify-center rounded-full border border-black/10 bg-white px-3 font-mono text-[11px] font-bold shadow-sm"
            >
              1:1
            </button>
          </div>
          {tip && (
            <div
              className="pointer-events-none fixed z-50 w-[240px] rounded-3xl border border-black/10 bg-white p-4 shadow-xl"
              style={{ left: tipLeft, top: tipTop }}
            >
              <p className="font-mono text-[11px] font-bold text-ink">{tip.node.label}</p>
              <p className="truncate font-mono text-[11px] text-slate400">{tip.node.addr}</p>
              <dl className="mt-1.5 space-y-0.5 font-mono text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate400">type</dt>
                  <dd className="text-ink">{tip.node.kind}</dd>
                </div>
                {tip.node.protocolName && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate400">protocol</dt>
                    <dd className="truncate text-ink">{tip.node.protocolName}</dd>
                  </div>
                )}
                {tip.node.interactionCount !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate400">interactions</dt>
                    <dd className="text-ink">
                      {tip.node.interactionCount}×{tip.node.direction ? ` ${tip.node.direction}` : ""}
                    </dd>
                  </div>
                )}
                {tip.node.isContract && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate400">contract</dt>
                    <dd className="text-ink">yes</dd>
                  </div>
                )}
                {tip.node.note && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate400">note</dt>
                    <dd className="truncate text-ink">{tip.node.note}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
        {built.hiddenRel > 0 && (
          <p className="px-4 pb-1 text-center font-mono text-[11px] text-slate400">
            +{built.hiddenRel} more counterparties not shown — see stats below.
          </p>
        )}
        {built.hiddenSocial > 0 && (
          <p className="px-4 pb-1 text-center font-mono text-[11px] text-slate400">
            +{built.hiddenSocial} more social edges not shown.
          </p>
        )}
        {!graph.complete && (
          <p className="px-4 pb-3 text-center font-mono text-[11px] text-slate400">
            Transaction walk hit the indexed query limit, so this graph is a lower bound — not the full picture.
          </p>
        )}
      </div>
    </div>
  );
}
