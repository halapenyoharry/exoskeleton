export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  /** Registry panel ids to mount, applied in registry order. The document
   *  (`json-edit`) is never part of a grid: it always lives in the left edge,
   *  so it is filtered out of the resolved ids. */
  panelIds: string[];
  /** Start with the document edge expanded (desktop). Default: collapsed. */
  documentOpen?: boolean;
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
    id: "minimal",
    name: "Minimal",
    description: "Editor, terminal, and a webview. Everything else is one click away.",
    panelIds: ["editor", "terminal", "webview"],
  },
  {
    id: "json-lab",
    name: "JSON Lab",
    description: "The document (left edge) feeding the tree, graph, and 3D viewers.",
    panelIds: ["json-tree", "json-graph3d", "json-graph3d-inspect", "topology-extract"],
    documentOpen: true,
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
    documentOpen: true,
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
  if (!target) return availablePanelIds.filter(notDocument);
  if (target.panelIds.length === 0) return availablePanelIds.filter(notDocument);
  return target.panelIds.filter(notDocument);
}

/** The document lives in the left edge, never in a preset's grid. (Literal
 *  id, not imported: this module stays dependency-free.) */
const notDocument = (id: string) => id !== "json-edit";
