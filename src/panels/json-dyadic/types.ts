// Types for TopoThink dyadic JSON — the schema produced by projecting an
// upstream hypergraph down to a {nodes, links} pair.
//
// The format has a sharp edge: n-ary edges from the hypergraph are reified
// into c:-prefixed entries that appear in the `nodes` array as
// `kind: "hyperedge"`. They are NOT topology entities — they are relations
// the dyadic schema had to spell as nodes. The renderer must never feed
// them into the node-drawing code path. parse.ts enforces that split.

export type EdgeCategory =
  | "containment"
  | "state_change"
  | "interactivity"
  | "reference";

export interface TopoAttrs {
  label?: string;
  "i2t:kind"?: string;
  "i2t:predicate"?: string;
  "i2t:edge_category"?: EdgeCategory;
  "i2t:edge_category_secondary"?: EdgeCategory;
  [key: string]: unknown;
}

/**
 * A row from the `nodes` array. Two flavors:
 *
 *   - `kind: "node"` — a real entity in the topology. Has an i2t:kind in
 *     attrs identifying what kind of entity it is (engine, voice, model,
 *     artifact, concept, …). These flow into the node-drawing code path.
 *
 *   - `kind: "hyperedge"` — a relation the dyadic format had to reify so
 *     it could be addressed by id. `id` is c:-prefixed. `attrs.i2t:predicate`
 *     names the relation. `attrs.i2t:edge_category` drives visual idiom.
 *     These NEVER flow into the node-drawing code path; they become the
 *     region/field/flow that holds their participants.
 */
export interface TopoNode {
  id: string;
  kind: "node" | "hyperedge";
  label?: string;
  attrs?: TopoAttrs;
}

/**
 * A row from the `links` array. Two flavors mixed in the same list:
 *
 *   - Plain dyadic link — `source` and `target` both refer to real nodes
 *     (kind === "node"). The link itself carries `attrs.i2t:edge_category`
 *     and drives its own visual idiom.
 *
 *   - Spoke of a reification — `source` is a c:-prefixed hyperedge id; the
 *     link's `role` (or its source_role/target_role pair) names which
 *     incidence in the original n-ary edge this spoke represents. The
 *     spoke inherits its visual category from the hyperedge it's attached
 *     to, not from its own attrs (spokes typically don't carry attrs).
 */
export interface TopoLink {
  source: string;
  target: string;
  directed?: boolean;
  layer: string;
  role?: string;
  source_role?: string;
  target_role?: string;
  label?: string;
  attrs?: TopoAttrs;
}

export interface TopoDocument {
  metadata?: Record<string, unknown>;
  nodes: TopoNode[];
  links: TopoLink[];
}

// Narrow type used by the node-rendering function. The parser only ever
// passes nodes with kind:"node" through this gate, so a c: reification
// cannot be drawn as a tile even if a future caller forgets the rule.
export type RenderableNode = TopoNode & { kind: "node" };
