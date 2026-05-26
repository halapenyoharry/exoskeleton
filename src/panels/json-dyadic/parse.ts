import type {
  EdgeCategory,
  RenderableNode,
  TopoDocument,
  TopoLink,
  TopoNode,
} from "./types";

// Prefixes the dyadic projection uses when reifying an n-ary edge as a
// node so it can be addressed by id. The convention has evolved — `c:`
// was the original universal prefix; the current convention encodes the
// edge category in the prefix (`c:` containment, `sc:` state_change, `i:`
// interactivity, `r:` reference). The `kind: "hyperedge"` field on the
// node is the authoritative signal; this list is only a defensive
// fallback for files that omit `kind`.
const REIFICATION_ID_PREFIXES = ["c:", "sc:", "i:", "r:"] as const;

/**
 * A reification grouped with its spoke links — the unit a containment /
 * state_change / interactivity region is built from.
 *
 * `spokes` are links where source === relation.id (the dyadic-projection
 * convention). Each spoke's `target` is either a real node (looked up via
 * nodesById) or, occasionally, another reification.
 */
export interface ReifiedRelation {
  relation: TopoNode; // kind: "hyperedge"
  spokes: TopoLink[];
}

export interface LayerData {
  layer: string;
  primaryCategory: EdgeCategory;
  /** Reifications anchored to this layer (their spokes carry this layer). */
  reifications: ReifiedRelation[];
  /** Dyadic links in this layer where neither endpoint is a c: reification. */
  dyadicLinks: TopoLink[];
  /** Total spokes + dyadic links — what the picker shows. */
  linkCount: number;
}

export interface ParsedTopology {
  metadata?: Record<string, unknown>;
  /** Real entities. The ONLY source of node-shaped tiles. */
  nodesById: Map<string, RenderableNode>;
  /** Reifications, indexed for spoke-cluster lookup. Never rendered as tiles. */
  reificationsById: Map<string, TopoNode>;
  /** Per-layer data, keyed by layer name. */
  layers: Map<string, LayerData>;
  /** Layer names sorted for the picker. */
  layerOrder: string[];
  /** Issues encountered while parsing — surfaced in dev console. */
  warnings: string[];
}

const EMPTY_TOPOLOGY: ParsedTopology = {
  nodesById: new Map(),
  reificationsById: new Map(),
  layers: new Map(),
  layerOrder: [],
  warnings: [],
};

export function emptyTopology(): ParsedTopology {
  return EMPTY_TOPOLOGY;
}

function isReificationId(id: string): boolean {
  return REIFICATION_ID_PREFIXES.some((p) => id.startsWith(p));
}

/**
 * Validate that the input has the structural shape of a TopoDocument.
 * Returns either the cast value or a list of structural complaints.
 */
function validate(input: unknown): TopoDocument | string[] {
  if (!input || typeof input !== "object") {
    return ["root is not an object"];
  }
  const obj = input as Record<string, unknown>;
  const errors: string[] = [];
  if (!Array.isArray(obj.nodes)) errors.push("missing `nodes` array");
  if (!Array.isArray(obj.links)) errors.push("missing `links` array");
  if (errors.length > 0) return errors;
  return obj as unknown as TopoDocument;
}

/**
 * Walk the document once and build the indices the renderer needs. Splits
 * `nodes` into `nodesById` and `reificationsById` based on the `kind` field
 * (with id-prefix as a defensive secondary check). Groups links into
 * per-layer buckets with reification spokes separated from plain dyadic
 * links.
 */
export function parseTopology(input: unknown): ParsedTopology {
  const validated = validate(input);
  if (Array.isArray(validated)) {
    return {
      ...EMPTY_TOPOLOGY,
      warnings: validated,
    };
  }
  const doc = validated;
  const warnings: string[] = [];

  const nodesById = new Map<string, RenderableNode>();
  const reificationsById = new Map<string, TopoNode>();

  for (const node of doc.nodes) {
    if (!node || typeof node.id !== "string") {
      warnings.push("skipped node without id");
      continue;
    }
    // `kind` is the authoritative signal. If the field is missing or
    // malformed (some draft files omit it), fall back to the id-prefix
    // hint. We don't warn on prefix/kind disagreement because the prefix
    // convention now encodes the *category* (c/sc/i/r), not just the
    // fact-of-reification, so a `sc:` id with `kind: "hyperedge"` is
    // perfectly legal and was previously flagged as suspicious noise.
    const kindIsReified =
      node.kind === "hyperedge" ||
      (typeof node.kind !== "string" && isReificationId(node.id));
    if (kindIsReified) {
      reificationsById.set(node.id, node);
    } else {
      // Narrow to RenderableNode — i.e., kind: "node".
      nodesById.set(node.id, node as RenderableNode);
    }
  }

  // Group links by layer; within each layer, split spokes-of-reifications
  // from plain dyadic links.
  const layerLinks = new Map<
    string,
    { spokesByReification: Map<string, TopoLink[]>; dyadic: TopoLink[] }
  >();

  for (const link of doc.links) {
    if (!link || typeof link.source !== "string" || typeof link.target !== "string") {
      warnings.push("skipped link with missing source/target");
      continue;
    }
    const layer = typeof link.layer === "string" ? link.layer : "(unlayered)";
    let bucket = layerLinks.get(layer);
    if (!bucket) {
      bucket = { spokesByReification: new Map(), dyadic: [] };
      layerLinks.set(layer, bucket);
    }
    if (reificationsById.has(link.source)) {
      const list = bucket.spokesByReification.get(link.source) ?? [];
      list.push(link);
      bucket.spokesByReification.set(link.source, list);
    } else {
      // Target may still be a reification (nested case). For v1 we route
      // these as plain dyadic — they're uncommon and a future enhancement.
      bucket.dyadic.push(link);
    }
  }

  // Build LayerData entries.
  const layers = new Map<string, LayerData>();
  for (const [layer, bucket] of layerLinks) {
    const reifications: ReifiedRelation[] = [];
    for (const [relationId, spokes] of bucket.spokesByReification) {
      const relation = reificationsById.get(relationId);
      if (!relation) {
        warnings.push(`spokes reference unknown reification ${relationId}`);
        continue;
      }
      reifications.push({ relation, spokes });
    }

    const primaryCategory = resolveLayerCategory(
      layer,
      reifications,
      bucket.dyadic,
      warnings,
    );
    const linkCount =
      reifications.reduce((sum, r) => sum + r.spokes.length, 0) +
      bucket.dyadic.length;

    layers.set(layer, {
      layer,
      primaryCategory,
      reifications,
      dyadicLinks: bucket.dyadic,
      linkCount,
    });
  }

  const layerOrder = [...layers.keys()].sort((a, b) => {
    const la = layers.get(a)!;
    const lb = layers.get(b)!;
    if (la.primaryCategory !== lb.primaryCategory) {
      // Category order: containment, state_change, interactivity, reference.
      const order: EdgeCategory[] = [
        "containment",
        "state_change",
        "interactivity",
        "reference",
      ];
      return (
        order.indexOf(la.primaryCategory) - order.indexOf(lb.primaryCategory)
      );
    }
    return lb.linkCount - la.linkCount;
  });

  return {
    metadata: typeof doc.metadata === "object" && doc.metadata
      ? (doc.metadata as Record<string, unknown>)
      : undefined,
    nodesById,
    reificationsById,
    layers,
    layerOrder,
    warnings,
  };
}

function resolveLayerCategory(
  layerName: string,
  reifications: ReifiedRelation[],
  dyadicLinks: TopoLink[],
  warnings: string[],
): EdgeCategory {
  // 1. If layer has reifications, use their i2t:edge_category.
  if (reifications.length > 0) {
    const categories = new Set<EdgeCategory>();
    for (const r of reifications) {
      const c = r.relation.attrs?.["i2t:edge_category"];
      if (c) categories.add(c);
    }
    if (categories.size === 1) {
      return [...categories][0];
    }
    if (categories.size > 1) {
      warnings.push(
        `layer "${layerName}" has reifications with mixed categories: ${[
          ...categories,
        ].join(", ")} — picking first`,
      );
      return [...categories][0];
    }
  }
  // 2. Mode of attrs.i2t:edge_category across dyadic links.
  const counts = new Map<EdgeCategory, number>();
  for (const link of dyadicLinks) {
    const c = link.attrs?.["i2t:edge_category"];
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  if (counts.size > 0) {
    let best: EdgeCategory = "reference";
    let bestN = -1;
    for (const [c, n] of counts) {
      if (n > bestN) {
        best = c;
        bestN = n;
      }
    }
    return best;
  }
  // 3. Fallback — lowest-weight idiom so an unclassified layer can't
  //    dominate the visual.
  warnings.push(
    `layer "${layerName}" has no edge_category info; defaulting to reference`,
  );
  return "reference";
}

/**
 * Resolve a spoke endpoint to a renderable node. Returns undefined when
 * the endpoint is a reification (nested case — v1 doesn't recurse) or
 * when the id isn't known.
 */
export function resolveEndpoint(
  topology: ParsedTopology,
  id: string,
): RenderableNode | undefined {
  return topology.nodesById.get(id);
}
