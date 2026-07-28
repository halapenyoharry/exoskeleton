export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  /** Registry panel ids to mount, applied in registry order. */
  panelIds: string[];
}

export const DEFAULT_PRESET_ID = "minimal";

export const presets: LayoutPreset[] = [
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
    panelIds: ["json-edit", "json-tree", "json-graph3d"],
  },
  {
    id: "av-lab",
    name: "AV Lab",
    description: "Tempo clock, piano, and oscilloscope over the OSC bus.",
    panelIds: ["tempo-clock", "piano", "scope"],
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
  const target = presets.find((p) => p.id === presetId) ?? presets.find((p) => p.id === DEFAULT_PRESET_ID);
  if (!target) return availablePanelIds;
  if (target.panelIds.length === 0) return availablePanelIds;
  return target.panelIds;
}
