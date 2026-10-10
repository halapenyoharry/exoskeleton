export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  /** Registry panel ids to mount, applied in registry order. */
  panelIds: string[];
}

export const DEFAULT_PRESET_ID = "minimal";

/** Preset for first-run web visitors: an empty grid (the Watermark picker
 *  shows). Desktop keeps DEFAULT_PRESET_ID. */
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

export function defaultPresetId(): string {
  return isWebRuntime() ? WEB_DEFAULT_PRESET_ID : DEFAULT_PRESET_ID;
}

export const presets: LayoutPreset[] = [
  {
    id: "blank",
    name: "Blank Canvas",
    description: "A clean, empty grid. Start fresh or summon panels on demand.",
    panelIds: [],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Editor, terminal, and a webview. Everything else is one click away.",
    panelIds: ["editor", "terminal", "webview"],
  },
  {
    id: "json-lab",
    name: "JSON Lab",
    description: "JSON editor feeding the tree, graph, and 3D viewers.",
    panelIds: ["json-edit", "json-tree", "json-graph3d", "json-graph3d-inspect", "topology-extract"],
  },
  {
    id: "av-lab",
    name: "AV Lab",
    description: "Tempo clock, piano, and oscilloscope over the OSC bus.",
    panelIds: ["tempo-clock", "piano", "scope"],
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
  },
  {
    id: "everything",
    name: "Everything",
    description: "The full omni-workshop — every panel in the registry.",
    panelIds: [], // empty means "all of them"; see resolvePresetPanelIds
  },
];

/**
 * Resolve the array of panel IDs for a preset ID.
 * If panelIds is empty (e.g. "everything"), returns all available panel IDs.
 * If the preset ID is unknown, falls back to the default preset ("minimal").
 */
export function resolvePresetPanelIds(
  presetId: string,
  availablePanelIds: string[],
): string[] {
  if (presetId === "blank") return [];
  const target = presets.find((p) => p.id === presetId) ?? presets.find((p) => p.id === DEFAULT_PRESET_ID);
  if (!target) return availablePanelIds;
  if (target.panelIds.length === 0) return availablePanelIds;
  return target.panelIds;
}
