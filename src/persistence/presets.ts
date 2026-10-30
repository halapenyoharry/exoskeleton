export type PlacementDirection = "left" | "right" | "above" | "below" | "within";

export interface Placement {
  id: string;
  direction?: PlacementDirection;
  reference?: string;
  size?: number;
}

export type PresetPlatform = "phone" | "desktop";

/** A platform layout: explicit placements in order, or "tabs" = every panel
 *  of the preset as tabs in one group (registry order), so panels added to
 *  the registry later are included without editing the preset. */
export type PlatformLayout = Placement[] | "tabs";

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  /** Registry panel ids to mount, applied in registry order when no platform
   *  layout is declared. The document (`json-edit`) is never part of a grid:
   *  it always lives in the left edge, so it is filtered out of the resolved ids. */
  panelIds: string[];
  /** Preferred panel placements per platform. */
  layouts?: {
    phone?: PlatformLayout;
    desktop?: PlatformLayout;
  };
  /** Start with the document edge expanded (desktop). Default: collapsed. */
  documentOpen?: boolean;
}

export const DEFAULT_PRESET_ID = "blank";

/** Preset for first-run web visitors: an empty grid (the Watermark picker
 *  shows). Same as DEFAULT_PRESET_ID. */
export const WEB_DEFAULT_PRESET_ID = "blank";

/** True when running in a plain browser tab rather than the Tauri shell.
 *  Runtime check so one dist/ serves both. Kept dependency-free so node
 *  tests can import this module. */
export function isWebRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    !("__TAURI_INTERNALS__" in window) &&
    !("__TAURI__" in window)
  );
}

/** Build-time override for the web default preset. Set
 *  VITE_WEB_DEFAULT_PRESET=<preset id> when building (the outer-rim deploy
 *  script passes it from its config), so what exo-skeleton.org opens with is
 *  a deploy option, not a code change. Unknown ids fall back to "blank". */
function webDefaultPresetId(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const id = env?.VITE_WEB_DEFAULT_PRESET?.trim();
  return id && presets.some((p) => p.id === id) ? id : WEB_DEFAULT_PRESET_ID;
}

export function defaultPresetId(): string {
  return isWebRuntime() ? webDefaultPresetId() : DEFAULT_PRESET_ID;
}

export const presets: LayoutPreset[] = [
  {
    id: "blank",
    name: "Blank Canvas",
    description: "A clean, empty grid. Start fresh or summon panels on demand.",
    panelIds: [],
  },
  {
    id: "json-lab",
    name: "JSON Lab",
    description: "The document (left edge) feeding the tree, graph, and 3D viewers.",
    panelIds: ["json-tree", "json-graph3d", "json-graph3d-inspect", "topology-extract"],
    layouts: {
      desktop: [
        { id: "json-tree", direction: "right" },
        { id: "json-graph", reference: "json-tree", direction: "right" },
        { id: "json-graph3d", reference: "json-tree", direction: "below" },
        { id: "json-cytoscape", reference: "json-graph", direction: "below" },
      ],
      phone: [
        { id: "text-viewer", direction: "right" },
        { id: "json-graph3d-inspect", reference: "text-viewer", direction: "below" },
      ],
    },
    documentOpen: true,
  },
  {
    id: "av-lab",
    name: "AV Lab",
    description: "Tempo clock, piano, and oscilloscope over the OSC bus.",
    panelIds: ["tempo-clock", "piano", "scope"],
    layouts: {
      desktop: [
        { id: "piano", direction: "right" },
        { id: "scope", reference: "piano", direction: "right" },
        { id: "tempo-clock", reference: "scope", direction: "right" },
      ],
      phone: [
        { id: "tempo-clock", direction: "right", size: 140 },
        { id: "piano", reference: "tempo-clock", direction: "below" },
        { id: "scope", reference: "piano", direction: "below" },
      ],
    },
  },
  {
    id: "procedural-lab",
    name: "Procedural Lab",
    description: "Generative visualizers and 3D topological manifolds driven by central OSC controls.",
    panelIds: [
      "procedural-visuals-control",
      "procedural-visuals-manifold",
      "procedural-visuals-balls",
      "procedural-visuals-fountain",
      "procedural-visuals-recursive",
    ],
    layouts: {
      phone: [
        { id: "procedural-visuals-control", direction: "right" },
        { id: "procedural-visuals-manifold", reference: "procedural-visuals-control", direction: "below" },
        { id: "procedural-visuals-balls", reference: "procedural-visuals-manifold", direction: "within" },
        { id: "procedural-visuals-fountain", reference: "procedural-visuals-manifold", direction: "within" },
        { id: "procedural-visuals-recursive", reference: "procedural-visuals-manifold", direction: "within" },
      ],
    },
  },
  {
    id: "everything",
    name: "Everything",
    description: "The full omni-workshop — every panel in the registry.",
    panelIds: [], // empty means "all of them"; see resolvePresetPanelIds
    layouts: {
      // A phone has room for one panel at a time: all of them as tabs.
      phone: "tabs",
    },
    documentOpen: true,
  },
];

/**
 * Resolve the array of panel IDs for a preset ID.
 * If panelIds is empty on a non-blank preset (e.g. "everything"), returns all available panel IDs.
 * If the preset ID is unknown, falls back to the default preset ("blank").
 */
export function resolvePresetPanelIds(
  presetId: string,
  availablePanelIds: string[],
): string[] {
  const target = presets.find((p) => p.id === presetId) ?? presets.find((p) => p.id === DEFAULT_PRESET_ID);
  if (!target || target.id === "blank") return [];
  if (target.panelIds.length === 0) return availablePanelIds.filter(notDocument);
  return target.panelIds.filter(notDocument);
}

/** Resolve the platform placement list for a preset, if it declares one.
 *  `availablePanelIds` (registry order, already filtered to what this host
 *  supports) expands a "tabs" layout. */
export function resolvePresetPlacements(
  presetId: string,
  platform: PresetPlatform,
  availablePanelIds: string[] = [],
): Placement[] | undefined {
  const target = presets.find((p) => p.id === presetId) ?? presets.find((p) => p.id === DEFAULT_PRESET_ID);
  const layout = target?.layouts?.[platform];
  if (!layout) return undefined;
  if (layout === "tabs") {
    const ids = resolvePresetPanelIds(target!.id, availablePanelIds);
    return ids.map((id, i) => (i === 0 ? { id, direction: "right" } : { id, reference: ids[0], direction: "within" }));
  }
  return layout.filter((p) => notDocument(p.id));
}

/** True when applying `presetId` should seed Berry Thief into an empty document. */
export function shouldSeedPresetDocument(presetId: string): boolean {
  return presetId === "json-lab" || presetId === "everything";
}

/** The document lives in the left edge, never in a preset's grid. (Literal
 *  id, not imported: this module stays dependency-free.) */
const notDocument = (id: string) => id !== "json-edit";
