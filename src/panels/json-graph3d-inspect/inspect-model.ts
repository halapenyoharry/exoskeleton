// Pure data shaping for json-graph3d-inspect. No three.js, no React —
// everything here is unit-testable and shared between the renderer and
// the tests.
//
// The inspect view reads TopoThink dyadic documents (nodes + links where
// n-ary relations are reified as `kind: "hyperedge"` nodes with spoke
// links) but degrades to any graph detectGraph() recognises. Category
// resolution, containment grouping and degree all tolerate missing
// fields; they just produce less.

import type { DetectedGraph, GraphLink, GraphNode } from "../../data/json-utils/graphDetect";
import type { EdgeCategory } from "../json-dyadic/types";
// Explicit .ts extensions: node --experimental-strip-types runs the tests
// without a bundler, and it needs them for runtime (non-type) imports.
import { CATEGORY_TOKENS } from "../json-dyadic/categories.ts";
import { colorForLayer } from "../../data/json-utils/layers.ts";

const CATEGORIES: ReadonlySet<string> = new Set([
  "containment",
  "state_change",
  "interactivity",
  "reference",
]);

/** First `maxWords` whitespace-separated words of a label; "…" when cut. */
export function slug(label: string, maxWords: number): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ") + "…";
}

function categoryFromAttrs(
  attrs: Record<string, unknown> | undefined,
): EdgeCategory | undefined {
  const c = attrs?.["i2t:edge_category"] ?? attrs?.["i2t:category"];
  return typeof c === "string" && CATEGORIES.has(c)
    ? (c as EdgeCategory)
    : undefined;
}

/** Category of a link: its own attrs first, then the hyperedge node it is
 *  a spoke of (either endpoint — dyadic files put the reification at
 *  `source`, incidence-derived graphs put it at `target`). */
export function resolveLinkCategory(
  link: GraphLink,
  nodesById: Map<string, GraphNode>,
): EdgeCategory | undefined {
  const own = categoryFromAttrs(link.attrs);
  if (own) return own;
  for (const id of [link.source, link.target]) {
    const n = nodesById.get(id);
    if (n?.kind === "hyperedge") {
      const c = categoryFromAttrs(n.attrs);
      if (c) return c;
    }
  }
  return undefined;
}

/** The text drawn inline on a link. Spokes carry a `role` (incidence
 *  role — "member", "input", "medium"); plain dyadic links carry the
 *  predicate as `label`. Role wins because on a spoke the predicate is
 *  already printed on the hyperedge node it hangs off. */
export function linkInlineText(link: GraphLink): string {
  return link.role || link.label || "";
}

/** Degree per node id, counting every link endpoint (spokes included). */
export function degreeMap(graph: DetectedGraph): Map<string, number> {
  const m = new Map<string, number>();
  for (const n of graph.nodes) m.set(n.id, 0);
  for (const l of graph.links) {
    m.set(l.source, (m.get(l.source) ?? 0) + 1);
    m.set(l.target, (m.get(l.target) ?? 0) + 1);
  }
  return m;
}

export interface ContainmentGroup {
  /** The reified containment relation (kind: "hyperedge"). */
  relationId: string;
  /** Node ids of every participant: container and contained alike. */
  participantIds: string[];
  /** The participant whose role names it as the enclosing side, if any. */
  containerId?: string;
}

const CONTAINER_ROLES: ReadonlySet<string> = new Set([
  "container",
  "parent",
  "whole",
  "scope",
  "enclosing",
]);

/** One group per containment hyperedge. Members come from spokes on
 *  either side of the reification. */
export function containmentGroups(
  graph: DetectedGraph,
  nodesById: Map<string, GraphNode>,
): ContainmentGroup[] {
  const byRelation = new Map<string, ContainmentGroup>();
  for (const n of graph.nodes) {
    if (n.kind === "hyperedge" && categoryFromAttrs(n.attrs) === "containment") {
      byRelation.set(n.id, { relationId: n.id, participantIds: [] });
    }
  }
  if (byRelation.size === 0) return [];
  for (const l of graph.links) {
    const rel = byRelation.get(l.source) ?? byRelation.get(l.target);
    if (!rel) continue;
    const member = rel.relationId === l.source ? l.target : l.source;
    if (!nodesById.has(member) || nodesById.get(member)?.kind === "hyperedge") {
      continue;
    }
    if (!rel.participantIds.includes(member)) rel.participantIds.push(member);
    if (l.role && CONTAINER_ROLES.has(l.role) && !rel.containerId) {
      rel.containerId = member;
    }
  }
  return [...byRelation.values()].filter((g) => g.participantIds.length > 0);
}

export type EdgeColorBy = "category" | "layer" | "predicate";

/** Override keys, checked in order of specificity:
 *    node:<id>  kind:<i2t:kind>  predicate:<p>  layer:<l>  category:<c>
 *  Values are CSS colors. This is how "the OSC bus and everything on it
 *  is amber" gets expressed without a per-document code change. */
export type ColorOverrides = Record<string, string>;

export function nodeColor(
  node: GraphNode,
  overrides: ColorOverrides,
  fallback: string,
): string {
  const byId = overrides[`node:${node.id}`];
  if (byId) return byId;
  const kind = node.attrs?.["i2t:kind"];
  if (typeof kind === "string") {
    const byKind = overrides[`kind:${kind}`];
    if (byKind) return byKind;
  }
  if (typeof node.attrs?.color === "string") return node.attrs.color;
  if (node.kind === "hyperedge") {
    const c = categoryFromAttrs(node.attrs);
    if (c) return overrides[`category:${c}`] ?? CATEGORY_TOKENS[c].color;
    return "#7a7f99";
  }
  if (typeof kind === "string") return colorForLayer(kind);
  return fallback;
}

export function linkColor(
  link: GraphLink,
  category: EdgeCategory | undefined,
  by: EdgeColorBy,
  overrides: ColorOverrides,
): string {
  const predicate =
    (typeof link.attrs?.["i2t:predicate"] === "string"
      ? (link.attrs["i2t:predicate"] as string)
      : undefined) ?? link.label;
  if (predicate && overrides[`predicate:${predicate}`]) {
    return overrides[`predicate:${predicate}`];
  }
  if (link.layer && overrides[`layer:${link.layer}`]) {
    return overrides[`layer:${link.layer}`];
  }
  if (category && overrides[`category:${category}`]) {
    return overrides[`category:${category}`];
  }
  switch (by) {
    case "predicate":
      if (predicate) return colorForLayer(predicate);
      break;
    case "layer":
      if (link.layer) return colorForLayer(link.layer);
      break;
    case "category":
    default:
      break;
  }
  if (category) return CATEGORY_TOKENS[category].color;
  if (link.layer) return colorForLayer(link.layer);
  return "#00e5ff";
}

/** Relative line width per category: reference is deliberately thin
 *  (whitepaper: low visual weight), containment is drawn as a hull not a
 *  line so its lines, when shown at all, are hairlines. */
export const CATEGORY_WIDTH: Record<EdgeCategory, number> = {
  containment: 0.3,
  state_change: 1.4,
  interactivity: 1.0,
  reference: 0.4,
};
