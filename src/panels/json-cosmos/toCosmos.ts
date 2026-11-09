import type { DetectedGraph } from "../../data/json-utils/graphDetect.ts";
import { colorForLayer } from "../../data/json-utils/layers.ts";

export interface CosmosGraphData {
  ids: string[];
  indexById: Map<string, number>;
  positions: Float32Array;
  links: Float32Array;
  droppedLinks: number;
  pointColors: Float32Array;
  pointSizes: Float32Array;
  linkColors: Float32Array;
}

const DEFAULT_SPACE_SIZE = 4096;
const SPACE_CENTER = DEFAULT_SPACE_SIZE / 2;
const LINK_ALPHA = 0.35;

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) if (typeof v === "string" && v !== "") return v;
  return undefined;
}

function firstPositiveNumber(...values: unknown[]): number | undefined {
  for (const v of values) if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return undefined;
}

/** Small seeded PRNG (Mulberry32) so the same graph starts in the same layout. */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexDigit(code: number): number {
  if (code >= 48 && code <= 57) return code - 48; // 0-9
  if (code >= 65 && code <= 70) return code - 55; // A-F
  if (code >= 97 && code <= 102) return code - 87; // a-f
  return -1;
}

/**
 * Parses a #rgb or #rrggbb hex color into `out` at `offset` as RGB in 0..1.
 * Returns true if `value` was a valid 3- or 6-digit hex color.
 */
function writeHexRgb(
  value: string | undefined,
  out: Float32Array,
  offset: number,
): boolean {
  if (typeof value !== "string") return false;
  const len = value.length;
  if ((len !== 4 && len !== 7) || value.charCodeAt(0) !== 35) return false;

  if (len === 4) {
    const r = hexDigit(value.charCodeAt(1));
    const g = hexDigit(value.charCodeAt(2));
    const b = hexDigit(value.charCodeAt(3));
    if (r < 0 || g < 0 || b < 0) return false;
    out[offset] = (r * 17) / 255;
    out[offset + 1] = (g * 17) / 255;
    out[offset + 2] = (b * 17) / 255;
    return true;
  }

  const r1 = hexDigit(value.charCodeAt(1));
  const r2 = hexDigit(value.charCodeAt(2));
  const g1 = hexDigit(value.charCodeAt(3));
  const g2 = hexDigit(value.charCodeAt(4));
  const b1 = hexDigit(value.charCodeAt(5));
  const b2 = hexDigit(value.charCodeAt(6));
  if (r1 < 0 || r2 < 0 || g1 < 0 || g2 < 0 || b1 < 0 || b2 < 0) return false;
  out[offset] = ((r1 << 4) | r2) / 255;
  out[offset + 1] = ((g1 << 4) | g2) / 255;
  out[offset + 2] = ((b1 << 4) | b2) / 255;
  return true;
}

/**
 * Pure conversion from `DetectedGraph` to the typed buffers cosmos.gl consumes.
 * Positions are centered at `(2048, 2048)` inside cosmos.gl's default `4096`
 * space so negative coordinates are not clamped by the GPU simulation step.
 */
export function toCosmos(
  graph: DetectedGraph,
  seed = 0x9e3779b9,
): CosmosGraphData {
  const { nodes, links: rawLinks } = graph;
  const nodeCount = nodes.length;

  const ids = new Array<string>(nodeCount);
  const indexById = new Map<string, number>();
  const positions = new Float32Array(nodeCount * 2);
  const pointColors = new Float32Array(nodeCount * 4);
  const pointSizes = new Float32Array(nodeCount);

  const rand = createSeededRandom(seed);
  // Square side grows with sqrt(nodeCount), bounded to cosmos.gl's [0, 4096] space.
  const side = Math.min(DEFAULT_SPACE_SIZE, Math.sqrt(nodeCount) * 12);
  const layerColorCache = new Map<string, [number, number, number]>();
  const scratchRgb = new Float32Array(3);

  const getLayerRgb = (key: string): [number, number, number] => {
    const cached = layerColorCache.get(key);
    if (cached) return cached;
    writeHexRgb(colorForLayer(key || undefined), scratchRgb, 0);
    const tuple: [number, number, number] = [
      scratchRgb[0],
      scratchRgb[1],
      scratchRgb[2],
    ];
    layerColorCache.set(key, tuple);
    return tuple;
  };

  for (let i = 0; i < nodeCount; i++) {
    const node = nodes[i];
    ids[i] = node.id;
    if (!indexById.has(node.id)) {
      indexById.set(node.id, i);
    }

    positions[i * 2] = SPACE_CENTER + (rand() - 0.5) * side;
    positions[i * 2 + 1] = SPACE_CENTER + (rand() - 0.5) * side;

    // graphDetect fills only id/label/kind/attrs/data, so color, size and the
    // category are read from the node's attrs and raw object too. Order matches
    // 3D-Inspect's nodeColor: explicit color, then i2t:kind through the shared
    // layer palette.
    const attrs = node.attrs;
    const raw = node.data;
    const colorOffset = i * 4;
    if (!writeHexRgb(firstString(node.color, attrs?.color, raw?.color), pointColors, colorOffset)) {
      const rgb = getLayerRgb(
        firstString(attrs?.["i2t:kind"], node.type, raw?.type, raw?.group, attrs?.type, attrs?.group) ??
          node.kind ??
          "node",
      );
      pointColors[colorOffset] = rgb[0];
      pointColors[colorOffset + 1] = rgb[1];
      pointColors[colorOffset + 2] = rgb[2];
    }
    pointColors[colorOffset + 3] = 1;

    const explicitSize = firstPositiveNumber(node.size, raw?.size, attrs?.size);
    if (explicitSize !== undefined) {
      pointSizes[i] = explicitSize;
    } else if (node.kind === "hyperedge" || node.kind === "edge-as-node") {
      pointSizes[i] = 2;
    } else {
      pointSizes[i] = 4;
    }
  }

  const totalLinks = rawLinks.length;
  const linkPairs = new Float32Array(totalLinks * 2);
  const linkRgba = new Float32Array(totalLinks * 4);
  let keptLinks = 0;
  let droppedLinks = 0;

  for (let i = 0; i < totalLinks; i++) {
    const link = rawLinks[i];
    const sourceIndex = indexById.get(link.source);
    const targetIndex = indexById.get(link.target);
    if (sourceIndex === undefined || targetIndex === undefined) {
      droppedLinks++;
      continue;
    }

    const pairOffset = keptLinks * 2;
    linkPairs[pairOffset] = sourceIndex;
    linkPairs[pairOffset + 1] = targetIndex;

    const rgb = getLayerRgb(link.layer ?? "");
    const rgbaOffset = keptLinks * 4;
    linkRgba[rgbaOffset] = rgb[0];
    linkRgba[rgbaOffset + 1] = rgb[1];
    linkRgba[rgbaOffset + 2] = rgb[2];
    linkRgba[rgbaOffset + 3] = LINK_ALPHA;

    keptLinks++;
  }

  return {
    ids,
    indexById,
    positions,
    links: droppedLinks === 0 ? linkPairs : linkPairs.slice(0, keptLinks * 2),
    droppedLinks,
    pointColors,
    pointSizes,
    linkColors:
      droppedLinks === 0 ? linkRgba : linkRgba.slice(0, keptLinks * 4),
  };
}
