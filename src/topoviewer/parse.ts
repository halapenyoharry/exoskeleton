// Parse a hypergraph.topothink.json into layout-ready structures

import type { Hypergraph, LayoutNode, LayoutLink, Layer } from "./types";

// Predicate color palette — distinct, readable on dark bg
const PREDICATE_COLORS: Record<string, string> = {
  contains: "#6dffaa",
  references: "#18ffff",
  follows: "#ff9800",
  next_turn: "#ff9800",
  contradicts: "#ff5252",
  authored_by: "#ce93d8",
  influences: "#80deea",
  is_a: "#a5d6a7",
  part_of: "#81d4fa",
  causes: "#ffcc80",
  opposes: "#ef9a9a",
  exemplifies: "#b39ddb",
  responds_to: "#90caf9",
};

const TYPE_COLORS: Record<string, string> = {
  Philosopher: "#F8C8DC",
  Writer: "#F8D8C8",
  Work: "#C8E0F8",
  Concept: "#F8F0C8",
  Pattern: "#F8C8C8",
  Turn: "#C8E0F8",
  Person: "#F8C8DC",
  Agent: "#F8C8DC",
  Document: "#E0E0E0",
  ReifiedEvent: "#DCC8F8",
  TrainingSubstrate: "#E0E0E0",
};

const FALLBACK_COLORS = [
  "#18ffff", "#ff9800", "#6dffaa", "#ce93d8", "#ff5252",
  "#80deea", "#ffcc80", "#a5d6a7", "#b39ddb", "#ef9a9a",
];

let colorIdx = 0;
function predicateColor(pred: string): string {
  if (PREDICATE_COLORS[pred]) return PREDICATE_COLORS[pred];
  const c = FALLBACK_COLORS[colorIdx % FALLBACK_COLORS.length];
  PREDICATE_COLORS[pred] = c;
  colorIdx++;
  return c;
}

function nodeColor(node: { attrs?: Record<string, unknown> }): string {
  const a = node.attrs || {};
  if (typeof a["instagraph:color"] === "string") return a["instagraph:color"];
  const t = (a["instagraph:type"] || a["kind"] || "") as string;
  if (TYPE_COLORS[t]) return TYPE_COLORS[t];
  return "#c5e8ee";
}

function nodeLabel(node: { id: string; attrs?: Record<string, unknown> }): string {
  const a = node.attrs || {};
  if (typeof a["label"] === "string") return a["label"];
  if (typeof a["schema:name"] === "string") return a["schema:name"] as string;
  if (typeof a["fs:name"] === "string") return a["fs:name"] as string;
  // Strip common prefixes from id for readability
  return node.id.replace(/^(fs:|edge:instagraph\/)/, "");
}

function nodeType(node: { attrs?: Record<string, unknown> }): string {
  const a = node.attrs || {};
  return (a["instagraph:type"] || a["kind"] || "node") as string;
}

export interface ParsedGraph {
  nodes: LayoutNode[];
  links: LayoutLink[];
  layers: Layer[];
  metadata: Hypergraph["metadata"];
}

export function parseHypergraph(hg: Hypergraph): ParsedGraph {
  // Build edge lookup
  const edgeMap = new Map<string, { directed: boolean; predicate: string; label: string; color: string }>();
  for (const e of hg.edges) {
    const pred = ((e.attrs?.["i2t:predicate"] || e.attrs?.["label"] || "related") as string).replace(/^\[|\]$/g, "");
    edgeMap.set(e.id, {
      directed: e.directed ?? false,
      predicate: pred,
      label: (e.attrs?.["label"] || pred) as string,
      color: predicateColor(pred),
    });
  }

  // Group incidences by edge to find source/target pairs
  const incByEdge = new Map<string, Array<{ node: string; role?: string }>>();
  for (const inc of hg.incidences) {
    const list = incByEdge.get(inc.edge) || [];
    list.push({ node: inc.node, role: inc.role });
    incByEdge.set(inc.edge, list);
  }

  // Build links from incidence pairs
  const links: LayoutLink[] = [];
  const nodeDegree = new Map<string, number>();
  const nodePredicates = new Map<string, Set<string>>();

  for (const [edgeId, members] of incByEdge) {
    const edgeInfo = edgeMap.get(edgeId);
    if (!edgeInfo) continue;

    if (members.length === 2) {
      // Dyadic edge — find source and target by role
      let src = members.find(m => m.role === "source")?.node;
      let tgt = members.find(m => m.role === "target")?.node;
      if (!src || !tgt) {
        src = members[0].node;
        tgt = members[1].node;
      }
      links.push({
        source: src,
        target: tgt,
        edgeId,
        predicate: edgeInfo.predicate,
        label: edgeInfo.label,
        directed: edgeInfo.directed,
        color: edgeInfo.color,
      });
      nodeDegree.set(src, (nodeDegree.get(src) || 0) + 1);
      nodeDegree.set(tgt, (nodeDegree.get(tgt) || 0) + 1);

      const sp = nodePredicates.get(src) || new Set();
      sp.add(edgeInfo.predicate);
      nodePredicates.set(src, sp);
      const tp = nodePredicates.get(tgt) || new Set();
      tp.add(edgeInfo.predicate);
      nodePredicates.set(tgt, tp);
    } else if (members.length > 2) {
      // Hyperedge — for now, connect all members to first member (star)
      // TODO: render as convex hull region instead
      const hub = members[0].node;
      for (let i = 1; i < members.length; i++) {
        const spoke = members[i].node;
        links.push({
          source: hub,
          target: spoke,
          edgeId,
          predicate: edgeInfo.predicate,
          label: edgeInfo.label,
          directed: false,
          color: edgeInfo.color,
        });
        nodeDegree.set(hub, (nodeDegree.get(hub) || 0) + 1);
        nodeDegree.set(spoke, (nodeDegree.get(spoke) || 0) + 1);
      }
    }
  }

  // Build layout nodes
  const nodes: LayoutNode[] = hg.nodes.map(n => ({
    id: n.id,
    label: nodeLabel(n),
    type: nodeType(n),
    color: nodeColor(n),
    attrs: n.attrs || {},
    x: Math.random() * 800 - 400,
    y: Math.random() * 600 - 300,
    degree: nodeDegree.get(n.id) || 0,
    predicates: nodePredicates.get(n.id) || new Set(),
  }));

  // Build layers
  const predCounts = new Map<string, number>();
  for (const l of links) {
    predCounts.set(l.predicate, (predCounts.get(l.predicate) || 0) + 1);
  }
  const layers: Layer[] = Array.from(predCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([pred, count]) => ({
      predicate: pred,
      count,
      color: predicateColor(pred),
      visible: true,
    }));

  return { nodes, links, layers, metadata: hg.metadata };
}
