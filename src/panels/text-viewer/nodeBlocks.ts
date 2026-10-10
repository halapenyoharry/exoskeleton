import { detectGraph } from "../../data/json-utils/graphDetect.ts";

export interface NodeBlock {
  id: string;
  title: string;
  content: string | null;
  allAttrs: Record<string, unknown>;
  color: string | null;
}

const TEXT_KEYS = ["text", "description", "content", "detail", "theme", "narrative_arc"];
const SKIP_KEYS = new Set(["id", "label", "name", "title", "attrs"]);

/** Extract per-node text blocks. Falls back to the raw node object
 *  (`data`) when a doc has no `attrs`, so plain `{id, group}` nodes
 *  still render with their fields as pills. */
export function buildNodeBlocks(doc: unknown): NodeBlock[] {
  const graph = doc && typeof doc === "object" ? detectGraph(doc) : null;
  if (!graph) return [];
  return graph.nodes.map((node) => {
    const src: Record<string, unknown> = { ...(node.data ?? {}), ...(node.attrs ?? {}) };
    const allAttrs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      if (SKIP_KEYS.has(k)) continue;
      allAttrs[k] = v;
    }
    let text: unknown;
    for (const k of TEXT_KEYS) {
      if (src[k]) { text = src[k]; break; }
    }
    const color = (src["instagraph:color"] ?? src.color ?? null) as string | null;
    return {
      id: node.id,
      title: String(node.label || node.id),
      content: text ? (typeof text === "string" ? text : JSON.stringify(text)) : null,
      allAttrs,
      color: typeof color === "string" ? color : null,
    };
  });
}
