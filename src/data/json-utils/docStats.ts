// Shared per-document stats + detected-graph cache. One O(N) pass per
// document VERSION, shared by every consumer — instead of the status bar
// and each viewer independently re-walking a 30k-node document on every
// debounced keystroke.
//
// Cache strategy: WeakMap keyed by the document VALUE (the object json-edit
// publishes to the bus). A new edit publishes a new parsed object, so the
// cache self-invalidates by identity — no coupling to json-bus, no manual
// invalidation, and dropped documents get collected with their stats.
// Primitive documents (string/number/bool/null) bypass the cache; they're
// trivially cheap.

import { detectGraph, type DetectedGraph } from "./graphDetect";

export interface DocStats {
  /** Count of nodes `jsonToHierarchy` would produce in compact view: one
   *  per JSON value. Exploded view adds up to one child per primitive, so
   *  treat this as a lower bound within 2× — fine for perf gates, which
   *  are order-of-magnitude thresholds. */
  hierarchyNodeCount: number;
  /** detectGraph results (0 when the doc isn't graph-shaped). */
  graphNodeCount: number;
  graphLinkCount: number;
  isGraph: boolean;
}

const statsCache = new WeakMap<object, DocStats>();
const graphCache = new WeakMap<object, DetectedGraph | null>();

function countJsonNodes(json: unknown): number {
  if (json === null || typeof json !== "object") return 1;
  let count = 1;
  if (Array.isArray(json)) {
    for (const item of json) count += countJsonNodes(item);
  } else {
    for (const key of Object.keys(json as Record<string, unknown>)) {
      count += countJsonNodes((json as Record<string, unknown>)[key]);
    }
  }
  return count;
}

/** The detected graph for a document value, computed once per version.
 *  Graph viewers should use this instead of calling detectGraph directly
 *  so the 30k-element node/link arrays are built once, not once per
 *  viewer. */
export function getDetectedGraph(doc: unknown): DetectedGraph | null {
  if (doc === null || typeof doc !== "object") return null;
  const key = doc as object;
  if (graphCache.has(key)) return graphCache.get(key) ?? null;
  let graph: DetectedGraph | null = null;
  try {
    graph = detectGraph(doc);
  } catch (e) {
    console.warn("[docStats] detectGraph threw:", e);
  }
  graphCache.set(key, graph);
  return graph;
}

/** Cheap cached stats for a document value. Safe to call from render —
 *  after the first call per document version it's a WeakMap read. */
export function getDocStats(doc: unknown): DocStats {
  if (doc === null || typeof doc !== "object") {
    return {
      hierarchyNodeCount: 1,
      graphNodeCount: 0,
      graphLinkCount: 0,
      isGraph: false,
    };
  }
  const key = doc as object;
  const hit = statsCache.get(key);
  if (hit) return hit;

  const graph = getDetectedGraph(doc);
  const stats: DocStats = {
    hierarchyNodeCount: countJsonNodes(doc),
    graphNodeCount: graph?.nodes.length ?? 0,
    graphLinkCount: graph?.links.length ?? 0,
    isGraph: graph !== null,
  };
  statsCache.set(key, stats);
  return stats;
}
