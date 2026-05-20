/**
 * Detects whether parsed JSON represents a graph structure and extracts
 * nodes/links in a standard format. Used by json-graph, json-cytoscape,
 * and json-graph3d panels.
 *
 * Recognized patterns:
 *   { nodes: [...], edges: [...] }
 *   { nodes: [...], links: [...] }
 *   { vertices: [...], edges: [...] }
 *   [ { source: "a", target: "b" }, ... ]            (array of edges)
 *   { node: { id, edges: [{ target_id }] } }         (single rooted)
 *
 * Origin: ported from json-visual-viewer/src/graphDetect.ts on 2026-05-19.
 * Pure function — no external dependencies. Safe to call on every JSON
 * change; perf is O(N) over edges.
 */

export type GraphNodeKind = "node" | "hyperedge" | "edge-as-node";

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  size?: number;
  color?: string;
  kind?: GraphNodeKind;
  attrs?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface GraphLink {
  source: string;
  target: string;
  label?: string;
  directed?: boolean;
  role?: string;
  layer?: string;
  attrs?: Record<string, unknown>;
}

export interface DetectedGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

const NODE_KEYS = ["nodes", "vertices", "elements", "items"];
const EDGE_KEYS = ["edges", "links", "connections", "relationships", "arcs"];
const SOURCE_KEYS = ["source", "from", "src", "start", "origin"];
const TARGET_KEYS = ["target", "to", "dst", "dest", "end", "destination"];

function findKey(
  obj: Record<string, unknown>,
  candidates: string[],
): string | null {
  const keys = Object.keys(obj);
  for (const c of candidates) {
    const found = keys.find((k) => k.toLowerCase() === c.toLowerCase());
    if (found) return found;
  }
  return null;
}

function extractId(item: unknown, index: number): string {
  if (typeof item === "object" && item !== null) {
    const obj = item as Record<string, unknown>;
    if (typeof obj.id === "string") return obj.id;
    if (typeof obj.id === "number") return String(obj.id);
    if (typeof obj._id === "string") return obj._id;
    if (typeof obj.name === "string") return obj.name;
  }
  return `node-${index}`;
}

function extractLabel(item: unknown): string {
  if (typeof item === "object" && item !== null) {
    const obj = item as Record<string, unknown>;
    if (typeof obj.label === "string") return obj.label;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.title === "string") return obj.title;
    if (typeof obj.id === "string") return obj.id;
    if (typeof obj.id === "number") return String(obj.id);
  }
  return String(item);
}

function isEdgeLike(obj: Record<string, unknown>): boolean {
  const srcKey = findKey(obj, SOURCE_KEYS);
  const tgtKey = findKey(obj, TARGET_KEYS);
  return srcKey !== null && tgtKey !== null;
}

function extractEdgeLabel(edge: Record<string, unknown>): string | undefined {
  const topKey = Object.keys(edge).find(
    (k) =>
      k.toLowerCase() === "label" ||
      k.toLowerCase() === "relation" ||
      k.toLowerCase() === "type",
  );
  if (topKey && typeof edge[topKey] !== "object") return String(edge[topKey]);

  const attrs = edge.attrs;
  if (typeof attrs === "object" && attrs !== null) {
    const a = attrs as Record<string, unknown>;
    const candidates = [
      a["i2t:predicate"],
      a.predicate,
      a.relation,
      a.type,
      a.label,
    ];
    for (const c of candidates) {
      if (typeof c === "string" || typeof c === "number") return String(c);
    }
  }
  return undefined;
}

function extractKind(node: Record<string, unknown>): GraphNodeKind | undefined {
  const k = node.kind;
  if (k === "node" || k === "hyperedge" || k === "edge-as-node") return k;
  return undefined;
}

function extractAttrs(
  obj: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const a = obj.attrs;
  if (typeof a === "object" && a !== null && !Array.isArray(a)) {
    return a as Record<string, unknown>;
  }
  return undefined;
}

function extractDirected(edge: Record<string, unknown>): boolean | undefined {
  if (typeof edge.directed === "boolean") return edge.directed;
  return undefined;
}

function extractRole(edge: Record<string, unknown>): string | undefined {
  if (typeof edge.role === "string") return edge.role;
  return undefined;
}

function extractLayer(edge: Record<string, unknown>): string | undefined {
  if (typeof edge.layer === "string") return edge.layer;
  if (typeof edge.layer === "number") return String(edge.layer);
  const attrs = edge.attrs;
  if (typeof attrs === "object" && attrs !== null) {
    const a = attrs as Record<string, unknown>;
    if (typeof a.layer === "string") return a.layer;
  }
  return undefined;
}

export function detectGraph(json: unknown): DetectedGraph | null {
  if (typeof json !== "object" || json === null) return null;

  // Pattern 1: { nodes: [...], edges/links: [...] }
  if (!Array.isArray(json)) {
    const obj = json as Record<string, unknown>;
    const nodeKey = findKey(obj, NODE_KEYS);
    const edgeKey = findKey(obj, EDGE_KEYS);

    if (
      nodeKey &&
      edgeKey &&
      Array.isArray(obj[nodeKey]) &&
      Array.isArray(obj[edgeKey])
    ) {
      const rawNodes = obj[nodeKey] as unknown[];
      const rawEdges = obj[edgeKey] as unknown[];

      const nodes: GraphNode[] = rawNodes.map((n, i) => {
        const nObj =
          typeof n === "object" && n !== null
            ? (n as Record<string, unknown>)
            : null;
        return {
          id: extractId(n, i),
          label: extractLabel(n),
          kind: nObj ? extractKind(nObj) : undefined,
          attrs: nObj ? extractAttrs(nObj) : undefined,
          data: nObj ?? undefined,
        };
      });

      const nodeIds = new Set(nodes.map((n) => n.id));

      const links: GraphLink[] = rawEdges
        .filter((e) => typeof e === "object" && e !== null)
        .reduce<GraphLink[]>((acc, e) => {
          const edge = e as Record<string, unknown>;
          const srcKey = findKey(edge, SOURCE_KEYS);
          const tgtKey = findKey(edge, TARGET_KEYS);
          if (!srcKey || !tgtKey) return acc;
          const source = String(edge[srcKey]);
          const target = String(edge[tgtKey]);
          acc.push({
            source,
            target,
            label: extractEdgeLabel(edge),
            directed: extractDirected(edge),
            role: extractRole(edge),
            layer: extractLayer(edge),
            attrs: extractAttrs(edge),
          });
          return acc;
        }, []);

      for (const link of links) {
        if (!nodeIds.has(link.source)) {
          nodes.push({ id: link.source, label: link.source });
          nodeIds.add(link.source);
        }
        if (!nodeIds.has(link.target)) {
          nodes.push({ id: link.target, label: link.target });
          nodeIds.add(link.target);
        }
      }

      if (nodes.length > 0 && links.length > 0) {
        return { nodes, links };
      }
    }
  }

  // Pattern 2: Array of edge-like objects [{ source, target }, ...]
  if (Array.isArray(json) && json.length > 0) {
    const firstFew = json.slice(0, Math.min(5, json.length));
    const allEdgeLike = firstFew.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        isEdgeLike(item as Record<string, unknown>),
    );

    if (allEdgeLike) {
      const nodeIds = new Set<string>();
      const links: GraphLink[] = [];

      for (const item of json) {
        if (typeof item !== "object" || item === null) continue;
        const edge = item as Record<string, unknown>;
        const srcKey = findKey(edge, SOURCE_KEYS);
        const tgtKey = findKey(edge, TARGET_KEYS);
        if (!srcKey || !tgtKey) continue;

        const source = String(edge[srcKey]);
        const target = String(edge[tgtKey]);
        nodeIds.add(source);
        nodeIds.add(target);

        links.push({
          source,
          target,
          label: extractEdgeLabel(edge),
          directed: extractDirected(edge),
          role: extractRole(edge),
          layer: extractLayer(edge),
          attrs: extractAttrs(edge),
        });
      }

      const nodes: GraphNode[] = Array.from(nodeIds).map((id) => ({
        id,
        label: id,
      }));

      if (nodes.length > 0 && links.length > 0) {
        return { nodes, links };
      }
    }
  }

  // Pattern 3: Single rooted node with embedded edges
  // { "node": { id, ... edges: [{ target_id }] } }
  if (typeof json === "object" && json !== null && !Array.isArray(json)) {
    for (const val of Object.values(json as Record<string, unknown>)) {
      if (typeof val === "object" && val !== null) {
        const obj = val as Record<string, unknown>;
        const edgeKey = findKey(obj, EDGE_KEYS);

        if (edgeKey && Array.isArray(obj[edgeKey])) {
          const rootNodeId = extractId(obj, 0);
          const rawEdges = obj[edgeKey] as unknown[];
          const nodes: GraphNode[] = [];
          const links: GraphLink[] = [];

          nodes.push({
            id: rootNodeId,
            label: extractLabel(obj),
            data: obj,
          });
          const nodeIds = new Set([rootNodeId]);

          for (const e of rawEdges) {
            if (typeof e === "object" && e !== null) {
              const edge = e as Record<string, unknown>;
              const tgtKey = Object.keys(edge).find((k) =>
                k.toLowerCase().includes("target"),
              );
              if (tgtKey) {
                const target = String(edge[tgtKey]);
                const labelKey = Object.keys(edge).find(
                  (k) =>
                    k.toLowerCase() === "label" ||
                    k.toLowerCase().includes("relation") ||
                    k.toLowerCase() === "type",
                );

                links.push({
                  source: rootNodeId,
                  target,
                  label: labelKey ? String(edge[labelKey]) : undefined,
                });

                if (!nodeIds.has(target)) {
                  nodes.push({ id: target, label: target });
                  nodeIds.add(target);
                }
              }
            }
          }

          if (nodes.length > 0 && links.length > 0) {
            return { nodes, links };
          }
        }
      }
    }
  }

  return null;
}
