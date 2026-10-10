// The field: a weighted graph where mass is earned from connection and
// attention is a token that moves through it.
//
// This module is pure. No DOM, no physics engine, no React — so it runs
// under `node --test` and the rules it encodes can be checked without a
// renderer. physics.ts turns a Field into rigid bodies; the panel draws
// them. Everything the user would call "the model" lives here:
//
//   mass      = 1 + the summed weight of a node's edges. Degree, not a
//               label. A node with no edges weighs 1 and never pulls.
//   density   = clustering coefficient — how tightly a node's neighbors
//               are coupled to each other. Dense nodes hold together;
//               diffuse ones with the same mass come apart under pull.
//   traverse  = attention moving along an edge. Adds weight to the edge
//               it moved along, which raises the mass of both ends. This
//               is the only way a node gets heavier by being thought
//               about: along a path that already existed.
//   dwell     = attention resting on a node without moving. Adds a small
//               amount to every edge already touching that node, equally,
//               with no new paths and no traversal. The node becomes more
//               findable; nothing is invented.
//
// Nothing in here creates an edge. Reification is earned upstream, in the
// document; the field only redistributes weight along what the document
// already stated.

import type { DetectedGraph } from "../../data/json-utils/graphDetect";

export interface FieldNode {
  id: string;
  label: string;
  /** 1 + summed incident edge weight. Always recomputed from edges. */
  mass: number;
  /** Local clustering coefficient, 0..1. Fixed by topology. */
  density: number;
  /** How many times attention has arrived here by traversal. */
  visits: number;
  /** How many dwell ticks attention has spent here. */
  dwelled: number;
  /** True when the document marked this as a reified relation, not an
   *  entity. Rendered differently; physically it still has mass. */
  reified: boolean;
  /** Arbitrary document attrs, carried through for tooltips. */
  attrs?: Record<string, unknown>;
}

export interface FieldEdge {
  source: string;
  target: string;
  /** Starts at 1; grows with traversal and dwell. */
  weight: number;
  /** How many times attention moved along this edge. */
  traversals: number;
  label?: string;
  layer?: string;
}

export interface Field {
  nodes: FieldNode[];
  edges: FieldEdge[];
  byId: Map<string, FieldNode>;
  /** node id → indices into `edges` touching it. */
  incident: Map<string, number[]>;
}

export type WalkMode = "walk" | "dwell" | "paused";

export interface Walker {
  /** Node id attention is on, or null before the first move. */
  at: string | null;
  mode: WalkMode;
  /** Where attention came from — used to discourage immediate backtracking. */
  from: string | null;
}

export interface FieldRules {
  /** Weight added to an edge each time attention crosses it. */
  traverseGain: number;
  /** Weight added to each incident edge per dwell tick. */
  dwellGain: number;
  /** Exponent on target mass when choosing the next hop. 0 = unbiased
   *  random walk; 1 = proportional to mass; >1 = heavy nodes dominate. */
  gravityBias: number;
  /** Probability per step of leaving the current path for a mass-weighted
   *  jump anywhere. Models attention being captured from an unrelated
   *  starting point. */
  jumpRate: number;
  /** Multiplier on the probability of stepping straight back to `from`. */
  backtrackPenalty: number;
}

export const defaultRules: FieldRules = {
  traverseGain: 0.15,
  dwellGain: 0.02,
  gravityBias: 1,
  jumpRate: 0.05,
  backtrackPenalty: 0.25,
};

/** Deterministic PRNG so the walk is reproducible in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/**
 * Build a Field from a detected graph. Parallel edges between the same
 * pair are merged by summing their weight — two stated relations between
 * the same two nodes is a stronger connection, not two connections.
 * Self-loops and edges to unknown ids are dropped.
 */
export function buildField(graph: DetectedGraph): Field {
  const nodes: FieldNode[] = [];
  const byId = new Map<string, FieldNode>();
  for (const n of graph.nodes) {
    if (byId.has(n.id)) continue;
    const node: FieldNode = {
      id: n.id,
      label: n.label || n.id,
      mass: 1,
      density: 0,
      visits: 0,
      dwelled: 0,
      reified: n.kind === "hyperedge" || n.kind === "edge-as-node",
      attrs: n.attrs,
    };
    nodes.push(node);
    byId.set(n.id, node);
  }

  const edges: FieldEdge[] = [];
  const edgeIndexByKey = new Map<string, number>();
  for (const l of graph.links) {
    if (l.source === l.target) continue;
    if (!byId.has(l.source) || !byId.has(l.target)) continue;
    const key = edgeKey(l.source, l.target);
    const existing = edgeIndexByKey.get(key);
    if (existing !== undefined) {
      edges[existing].weight += 1;
      continue;
    }
    edgeIndexByKey.set(key, edges.length);
    edges.push({
      source: l.source,
      target: l.target,
      weight: 1,
      traversals: 0,
      label: l.label,
      layer: l.layer,
    });
  }

  const incident = new Map<string, number[]>();
  for (const n of nodes) incident.set(n.id, []);
  edges.forEach((e, i) => {
    incident.get(e.source)!.push(i);
    incident.get(e.target)!.push(i);
  });

  const field: Field = { nodes, edges, byId, incident };
  recomputeMass(field);
  computeDensity(field);
  return field;
}

/** mass = 1 + Σ incident weight. Called after any weight change. */
export function recomputeMass(field: Field, onlyIds?: Iterable<string>): void {
  const ids = onlyIds ?? field.byId.keys();
  for (const id of ids) {
    const node = field.byId.get(id);
    if (!node) continue;
    let sum = 0;
    for (const i of field.incident.get(id) ?? []) sum += field.edges[i].weight;
    node.mass = 1 + sum;
  }
}

/** Local clustering coefficient per node, unweighted. O(Σ deg²). */
export function computeDensity(field: Field): void {
  const neighbors = new Map<string, Set<string>>();
  for (const n of field.nodes) neighbors.set(n.id, new Set());
  for (const e of field.edges) {
    neighbors.get(e.source)!.add(e.target);
    neighbors.get(e.target)!.add(e.source);
  }
  for (const n of field.nodes) {
    const ns = [...neighbors.get(n.id)!];
    const k = ns.length;
    if (k < 2) {
      n.density = 0;
      continue;
    }
    let links = 0;
    for (let i = 0; i < k; i++) {
      const a = neighbors.get(ns[i])!;
      for (let j = i + 1; j < k; j++) if (a.has(ns[j])) links++;
    }
    n.density = (2 * links) / (k * (k - 1));
  }
}

export function otherEnd(edge: FieldEdge, id: string): string {
  return edge.source === id ? edge.target : edge.source;
}

/**
 * Choose where attention goes next from `fromId`.
 *
 * Candidates are the neighbors of `fromId`; each is weighted by
 * edgeWeight × targetMass^gravityBias, with a penalty for stepping straight
 * back. With probability `jumpRate`, or when there are no neighbors,
 * attention instead jumps anywhere, weighted by mass alone — which is the
 * geodesic effect: from an unrelated start, the heaviest node is the
 * likeliest landing.
 */
export function chooseNext(
  field: Field,
  walker: Walker,
  rules: FieldRules,
  rng: () => number,
): string | null {
  if (field.nodes.length === 0) return null;
  const fromId = walker.at;
  const inc = fromId ? field.incident.get(fromId) ?? [] : [];

  const jump = fromId === null || inc.length === 0 || rng() < rules.jumpRate;
  if (jump) {
    return pickWeighted(
      field.nodes.filter((n) => n.id !== fromId),
      (n) => Math.pow(n.mass, rules.gravityBias),
      rng,
    )?.id ?? null;
  }

  const candidates = inc.map((i) => {
    const e = field.edges[i];
    const to = otherEnd(e, fromId!);
    const target = field.byId.get(to)!;
    let w = e.weight * Math.pow(target.mass, rules.gravityBias);
    if (to === walker.from) w *= rules.backtrackPenalty;
    return { to, w };
  });
  return pickWeighted(candidates, (c) => c.w, rng)?.to ?? null;
}

function pickWeighted<T>(
  items: T[],
  weightOf: (t: T) => number,
  rng: () => number,
): T | undefined {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weightOf(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

/**
 * Move attention from walker.at to `toId`. If an edge joins them, it gains
 * `traverseGain` and both endpoints get heavier. A jump (no edge) moves
 * attention without adding weight: landing somewhere by gravity is not
 * the same as having walked there.
 */
export function traverse(
  field: Field,
  walker: Walker,
  toId: string,
  rules: FieldRules,
): void {
  const to = field.byId.get(toId);
  if (!to) return;
  const fromId = walker.at;
  if (fromId) {
    const idx = findEdge(field, fromId, toId);
    if (idx !== -1) {
      const e = field.edges[idx];
      e.weight += rules.traverseGain;
      e.traversals += 1;
      recomputeMass(field, [fromId, toId]);
    }
  }
  to.visits += 1;
  walker.from = fromId;
  walker.at = toId;
}

/**
 * One tick of resting on walker.at. Every existing incident edge gains
 * `dwellGain`. No traversal, no new edges, no outward movement.
 */
export function dwell(field: Field, walker: Walker, rules: FieldRules): void {
  if (!walker.at) return;
  const node = field.byId.get(walker.at);
  if (!node) return;
  node.dwelled += 1;
  const touched = new Set<string>([walker.at]);
  for (const i of field.incident.get(walker.at) ?? []) {
    const e = field.edges[i];
    e.weight += rules.dwellGain;
    touched.add(otherEnd(e, walker.at));
  }
  recomputeMass(field, touched);
}

export function findEdge(field: Field, a: string, b: string): number {
  for (const i of field.incident.get(a) ?? []) {
    const e = field.edges[i];
    if ((e.source === a && e.target === b) || (e.source === b && e.target === a)) {
      return i;
    }
  }
  return -1;
}

/** Forget everything attention did; keep the document's own structure. */
export function resetField(graph: DetectedGraph): Field {
  return buildField(graph);
}

/** Advance the walker by one tick under its current mode. Returns the
 *  node id attention is on afterwards. */
export function step(
  field: Field,
  walker: Walker,
  rules: FieldRules,
  rng: () => number,
): string | null {
  if (walker.mode === "paused") return walker.at;
  if (walker.mode === "dwell") {
    if (walker.at === null) {
      const next = chooseNext(field, walker, rules, rng);
      if (next) traverse(field, walker, next, rules);
    } else {
      dwell(field, walker, rules);
    }
    return walker.at;
  }
  const next = chooseNext(field, walker, rules, rng);
  if (next) traverse(field, walker, next, rules);
  return walker.at;
}

export function heaviest(field: Field): FieldNode | undefined {
  let best: FieldNode | undefined;
  for (const n of field.nodes) if (!best || n.mass > best.mass) best = n;
  return best;
}
