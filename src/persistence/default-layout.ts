import type { AddPanelOptions, DockviewApi } from "dockview";

// The default panel arrangement — what Exoskeleton looks like on first launch,
// or after the user resets/clears their saved state.
//
// This is the SCHEMA's idea of "what panels exist and how they're arranged."
// State (the JSON saved between sessions) is a delta on top of this.

export const DEFAULT_WEBVIEW_URL = "https://dockview.dev";

/** A panel registry entry: addPanel options + the schema version that
 *  introduced this panel. `introducedAt` lets `migrateLayout` add new
 *  panels to old saved state without disrupting the user's customizations. */
type RegistryEntry = AddPanelOptions & { introducedAt: number };

/** The full set of panels Exoskeleton knows how to add. Order matters for
 *  `buildDefaultLayout` (the first entry fills the empty grid, subsequent
 *  entries position relative to existing ones). When adding a new panel,
 *  use the next schema version as its `introducedAt` and bump
 *  `CURRENT_VERSION` in storage.ts. */
export const panelRegistry: RegistryEntry[] = [
  {
    id: "editor",
    component: "editor",
    title: "editor",
    introducedAt: 1,
  },
  {
    id: "webview",
    component: "webview",
    title: "webview",
    params: { url: DEFAULT_WEBVIEW_URL },
    position: { referencePanel: "editor", direction: "right" },
    introducedAt: 1,
  },
  {
    id: "terminal",
    component: "terminal",
    title: "terminal",
    position: { referencePanel: "editor", direction: "below" },
    introducedAt: 1,
  },
  {
    id: "tempo-clock",
    component: "tempo-clock",
    title: "tempo",
    params: { bpm: 120, playing: false },
    position: { referencePanel: "terminal", direction: "within" },
    introducedAt: 2,
  },
  {
    id: "piano",
    component: "piano",
    title: "piano",
    position: { referencePanel: "terminal", direction: "within" },
    introducedAt: 4,
  },
  {
    id: "scope",
    component: "scope",
    title: "scope",
    position: { referencePanel: "terminal", direction: "within" },
    introducedAt: 4,
  },
  // v5 — JSON visualizer suite. The editor anchors the JSON workflow; the
  // six viewer panels group into one tab strip (direction: "within") so
  // users get a switchable visualization area, not six separate splits.
  {
    id: "json-edit",
    component: "json-edit",
    title: "json-edit",
    position: { referencePanel: "editor", direction: "below" },
    introducedAt: 5,
  },
  {
    id: "json-tree",
    component: "json-tree",
    title: "tree",
    position: { referencePanel: "json-edit", direction: "right" },
    introducedAt: 5,
  },
  {
    id: "json-graph",
    component: "json-graph",
    title: "graph",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 5,
  },
  {
    id: "json-cytoscape",
    component: "json-cytoscape",
    title: "cyto",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 5,
  },
  {
    id: "json-graph3d",
    component: "json-graph3d",
    title: "3d",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 5,
  },
  {
    id: "json-circles",
    component: "json-circles",
    title: "circles",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 5,
  },
  {
    id: "json-mass",
    component: "json-mass",
    title: "mass",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 5,
  },
  // v6 — dyadicProjection: categorical viewer for TopoThink dyadic JSON.
  // First panel in the json-* group that respects the four-category edge
  // contract (containment / state_change / interactivity / reference);
  // the others all render edges as uniform lines.
  {
    id: "dyadicProjection",
    component: "dyadicProjection",
    title: "dyadic",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 6,
  },
];

/** Build the default layout from scratch (called when no saved state exists). */
export function buildDefaultLayout(api: DockviewApi) {
  for (const entry of panelRegistry) {
    const { introducedAt: _, ...opts } = entry;
    api.addPanel(opts);
  }
}

/**
 * After `fromJSON(saved.layout)` has restored a user's customized layout,
 * add any panels they predate — i.e., panels whose `introducedAt` is
 * greater than the schema version that produced their saved state. The
 * user's existing arrangement is preserved; new panels are slotted in
 * via their registry position, or floated freely if the reference panel
 * isn't around anymore.
 */
export function migrateLayout(api: DockviewApi, savedVersion: number) {
  const existing = new Set<string>();
  api.panels.forEach((p) => existing.add(p.id));

  for (const entry of panelRegistry) {
    if (entry.introducedAt <= savedVersion) continue;
    if (existing.has(entry.id)) continue;

    const { introducedAt: _, ...opts } = entry;
    // If the reference panel was closed by the user, drop the position
    // so addPanel still succeeds (panel lands in a default location).
    // Dockview's position type is a union (RelativePanel | RelativeGroup
    // | absolute), so narrow to entries that reference a panel by id.
    const safeOpts =
      opts.position &&
      "referencePanel" in opts.position &&
      typeof opts.position.referencePanel === "string" &&
      !existing.has(opts.position.referencePanel)
        ? { ...opts, position: undefined }
        : opts;

    try {
      api.addPanel(safeOpts);
      existing.add(entry.id);
    } catch (e) {
      console.warn(`[exoskeleton] migrate: addPanel ${entry.id} failed:`, e);
    }
  }
}
