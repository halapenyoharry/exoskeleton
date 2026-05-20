// Layer extraction + stable per-layer color hashing. Used by json-graph,
// json-cytoscape, json-graph3d panels for the in-data layer-toggle UI.
//
// Origin: ported from json-visual-viewer/src/utils/layers.ts on 2026-05-19.
// Imports DetectedGraph from the sibling graphDetect — keep these two
// files together when installing.

import type { DetectedGraph } from "./graphDetect";

const PALETTE = [
  "#00e5ff",
  "#ff4d8d",
  "#ffd166",
  "#06d6a0",
  "#b388ff",
  "#ffe66d",
  "#ff6b6b",
  "#7ddff5",
  "#a3ff8c",
  "#ff9f1c",
  "#e0aaff",
  "#80ffdb",
];

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

export function colorForLayer(name: string | undefined): string {
  if (!name) return "#00e5ff";
  return PALETTE[hashStr(name) % PALETTE.length];
}

export interface LayerInfo {
  name: string;
  count: number;
  color: string;
}

export function extractLayers(graph: DetectedGraph | null): LayerInfo[] {
  if (!graph) return [];
  const counts = new Map<string, number>();
  for (const link of graph.links) {
    const layer = link.layer;
    if (!layer) continue;
    counts.set(layer, (counts.get(layer) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({
      name,
      count,
      color: colorForLayer(name),
    }));
}

export function buildLayerVisibility(
  graph: DetectedGraph | null,
  prev: Record<string, boolean>,
): Record<string, boolean> {
  if (!graph) return {};
  const next: Record<string, boolean> = {};
  for (const link of graph.links) {
    const layer = link.layer;
    if (!layer) continue;
    if (next[layer] === undefined) {
      next[layer] = prev[layer] !== false;
    }
  }
  return next;
}
