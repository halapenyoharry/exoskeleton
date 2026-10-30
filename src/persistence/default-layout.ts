import type {
  AddPanelOptions,
  AddPanelPositionOptions,
  DockviewApi,
  IDockviewPanel,
  SerializedDockview,
} from "dockview-react";

// The default panel arrangement — what Exoskeleton looks like on first launch,
// or after the user resets/clears their saved state.
//
// This is the SCHEMA's idea of "what panels exist and how they're arranged."
// State (the JSON saved between sessions) is a delta on top of this.

import {
   hostHasCapabilities,
  type CapabilityId,
} from "../panel-manifest.ts";
import {
  defaultPresetId,
  isWebRuntime,
  presets,
  resolvePresetPanelIds,
  resolvePresetPlacements,
  shouldSeedPresetDocument,
} from "./presets.ts";
import { CURRENT_VERSION } from "./storage.ts";
import {
  DOCUMENT_PANEL_ID,
  ensureDocumentEdge,
  ensureEdgeTabs,
  isPhoneWidth,
  migrateEdgeLayout,
  openDocument,
  precreateEdgeGroups,
  syncDocumentEdgeHeader,
} from "./document-edge.ts";

export const DEFAULT_WEBVIEW_URL = "https://dockview.dev";

/** A panel registry entry: addPanel options + the schema version that
 *  introduced this panel. `introducedAt` lets `migrateLayout` add new
 *  panels to old saved state without disrupting the user's customizations.
 *  `companions` names panel ids that should exist for this panel to be
 *  useful (e.g. the json viewers read from json-edit via the json-bus);
 *  every add path creates missing companions alongside. Mirrors
 *  PanelManifest.companions and PanelManifest.capabilities. */
export type RegistryEntry = AddPanelOptions & {
  introducedAt: number;
  companions?: string[];
  capabilities?: CapabilityId[];
  autoAdd?: boolean;
};

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
    capabilities: ["fs"],
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
    capabilities: ["pty"],
  },
  {
    id: "text-viewer",
    component: "text-viewer",
    title: "text-viewer",
    position: { referencePanel: "editor", direction: "within" },
    introducedAt: 8,
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
    position: { referencePanel: "tempo-clock", direction: "within" },
    introducedAt: 4,
  },
  {
    id: "scope",
    component: "scope",
    title: "scope",
    position: { referencePanel: "tempo-clock", direction: "within" },
    introducedAt: 4,
  },
  // v5 — JSON visualizer suite. The six viewer panels group into one tab
  // strip (direction: "within") so users get a switchable visualization area,
  // not six separate splits.
  // json-edit is the DOCUMENT: it is not a grid pane. It lives in the left
  // edge group ("document-edge", see document-edge.ts), which every layout
  // build/restore ensures. Its registry entry exists so pickers list it and
  // viewers can name it as a companion; addRegistryPanel/addOrFocusPanel route
  // it to the edge (the `position` below is never used for placement).
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
    position: { referencePanel: "tempo-clock", direction: "right" },
    introducedAt: 5,
    companions: ["json-edit"],
  },
  {
    id: "json-graph",
    component: "json-graph",
    title: "graph",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 5,
    companions: ["json-edit"],
  },
  {
    id: "json-cytoscape",
    component: "json-cytoscape",
    title: "cyto",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 5,
    companions: ["json-edit"],
  },
  {
    id: "json-graph3d",
    component: "json-graph3d",
    title: "3d",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 5,
    companions: ["json-edit"],
  },
  {
    id: "json-circles",
    component: "json-circles",
    title: "circles",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 5,
    companions: ["json-edit"],
  },
  {
    id: "json-mass",
    component: "json-mass",
    title: "mass",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 5,
    companions: ["json-edit"],
  },
  // v6 — json-dyadic: categorical viewer for TopoThink dyadic JSON.
  // First panel in the json-* group that respects the four-category edge
  // contract (containment / state_change / interactivity / reference);
  // the others all render edges as uniform lines.
  // (Originally landed in v6 as id "dyadicProjection"; renamed in v7 to
  // match the json-* family. See migrateSavedLayout below for the rewrite.)
  {
    id: "json-dyadic",
    component: "json-dyadic",
    title: "dyadic",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 6,
    companions: ["json-edit"],
  },
  // v11 — json-graph3d-inspect: reading-oriented sibling of json-graph3d.
  // Text-sprite nodes, inline edge roles, category colors, containment hulls.
  {
    id: "json-graph3d-inspect",
    component: "json-graph3d-inspect",
    title: "3D-Inspect",
    position: { referencePanel: "json-graph3d", direction: "within" },
    introducedAt: 11,
    companions: ["json-edit"],
  },
  // v9 — topology-extract: ingestion furnace for the info2topo pipeline.
  // Takes source text, runs AI extraction, and pushes normalized-dyadic
  // topology JSON to the json-bus where json-dyadic and other viewers
  // consume it. Appears in json-lab.
  {
    id: "topology-extract",
    component: "topology-extract",
    title: "topology-extract",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 9,
    companions: ["json-dyadic"],
  },
  // v10 — procedural-visuals: OSC-controlled generative canvases and 3D topological manifolds.
  {
    id: "procedural-visuals-control",
    component: "procedural-visuals-control",
    title: "proc-control",
    position: { referencePanel: "editor", direction: "below" },
    introducedAt: 10,
    capabilities: ["persistence"],
  },
  {
    id: "procedural-visuals-manifold",
    component: "procedural-visuals-manifold",
    title: "manifold",
    position: { referencePanel: "procedural-visuals-control", direction: "right" },
    introducedAt: 10,
    companions: ["procedural-visuals-control"],
    capabilities: ["persistence"],
  },
  {
    id: "procedural-visuals-balls",
    component: "procedural-visuals-balls",
    title: "balls",
    position: { referencePanel: "procedural-visuals-manifold", direction: "within" },
    introducedAt: 10,
    companions: ["procedural-visuals-control"],
    capabilities: ["persistence"],
  },
  {
    id: "procedural-visuals-fountain",
    component: "procedural-visuals-fountain",
    title: "fountain",
    position: { referencePanel: "procedural-visuals-manifold", direction: "within" },
    introducedAt: 10,
    companions: ["procedural-visuals-control"],
    capabilities: ["persistence"],
  },
  {
    id: "procedural-visuals-recursive",
    component: "procedural-visuals-recursive",
    title: "recursive",
    position: { referencePanel: "procedural-visuals-manifold", direction: "within" },
    introducedAt: 10,
    companions: ["procedural-visuals-control"],
    capabilities: ["persistence"],
  },
  // v8 — json-attention: a Rapier 2D rigid-body field where mass is earned
  // from connection and a token of attention walks the edges. The only
  // viewer that shows the document changing under attention rather than
  // the document as given. Not auto-added: reach it via the ⊞ menu or
  // the Everything preset.
  {
    id: "json-attention",
    component: "json-attention",
    title: "attention",
    position: { referencePanel: "json-tree", direction: "within" },
    introducedAt: 8,
    companions: ["json-edit"],
  },
];

/**
 * Rewrite a saved layout JSON for schema-version bumps that need to mutate
 * the persisted Dockview blob (panel id / component renames, etc.) BEFORE
 * fromJSON runs. Called from App.tsx between `load()` and `fromJSON()`.
 *
 * Safe because the rewrites only target literal strings that don't appear
 * elsewhere in the serialized layout. If that changes for a future rename,
 * switch to a proper traversal of `panels[id].component` instead.
 */
export function migrateSavedLayout(
  layout: SerializedDockview,
  savedVersion: number,
  opts: { phone?: boolean } = {},
): SerializedDockview {
  let json = JSON.stringify(layout);
  if (savedVersion < 7) {
    // v6 → v7: rename "dyadicProjection" panel id + component name to "json-dyadic".
    json = json.replace(/"dyadicProjection"/g, '"json-dyadic"');
  }
  // Migrate legacy Monaco params to CodeMirror 6
  json = json
    .replace(/"wordWrap"\s*:\s*"on"/g, '"lineWrapping":true')
    .replace(/"wordWrap"\s*:\s*"off"/g, '"lineWrapping":false')
    .replace(/"minimap"\s*:\s*(true|false),?/g, "");
  // Document edge: json-edit in the grid moves to the left edge; the old
  // left-edge settings group moves to the right edge.
  return migrateEdgeLayout(JSON.parse(json) as SerializedDockview, opts);
}

/** Look up a registry entry by panel id (id === component for all entries). */
export function getRegistryEntry(id: string): RegistryEntry | undefined {
  return panelRegistry.find((e) => e.id === id);
}

/** True when the current host runtime provides the panel's required capabilities. */
export function isPanelSupported(
  idOrEntry: string | RegistryEntry,
  web: boolean = isWebRuntime(),
): boolean {
  const entry = typeof idOrEntry === "string" ? getRegistryEntry(idOrEntry) : idOrEntry;
  return hostHasCapabilities(entry?.capabilities, web);
}

/** Panels that legitimately live in an edge group. Anything else found in
 *  one is treated as misplaced by `repairLayout`. (status-bar → bottom,
 *  settings → the Cmd+B side-grid on the right, json-edit → the document edge
 *  on the left.) */
const EDGE_RESIDENTS = new Set(["status-bar", "settings", "menu", DOCUMENT_PANEL_ID]);

/** First panel living in the main grid — the anchor for position
 *  fallbacks when a registry reference panel doesn't exist. */
function mainGridAnchor(api: DockviewApi): IDockviewPanel | undefined {
  return api.panels.find((p) => p.api.location.type === "grid");
}

/**
 * Add one registry panel, safely and idempotently:
 * - no-op (returns the existing panel) if the id is already present;
 * - if the registry position's reference panel is missing — or the entry
 *   has no position — anchor to the main grid instead. NEVER fall back to
 *   "no position": Dockview then targets the ACTIVE group, which can be
 *   an edge group. That's exactly how every panel got absorbed into the
 *   118px status-bar strip in pre-repair saved states.
 * - per-panel try/catch so one failure can't abort a whole build/migrate.
 * `extraParams` (e.g. params rescued by repairLayout) override the
 * registry defaults.
 */
export function addRegistryPanel(
  api: DockviewApi,
  entry: RegistryEntry,
  extraParams?: Record<string, unknown>,
  customPosition?: AddPanelPositionOptions,
  initialSize?: { width?: number; height?: number },
): IDockviewPanel | undefined {
  const existing = api.getPanel(entry.id);
  if (existing) return existing;

  // The document is not a grid pane: it goes to the left edge.
  if (entry.id === DOCUMENT_PANEL_ID) {
    return ensureDocumentEdge(api, { phone: isPhoneWidth(), params: extraParams });
  }

  // Registry entries never use `floating`; strip it (and the registry-only
  // fields) so the rebuilt options satisfy Dockview's position/floating
  // union cleanly.
  const {
    introducedAt: _i,
    companions: _c,
    capabilities: _cap,
    autoAdd: _auto,
    position: registryPosition,
    floating: _f,
    ...base
  } = entry as RegistryEntry & {
    position?: AddPanelPositionOptions;
    floating?: unknown;
  };

  let position = customPosition ?? registryPosition;
  // A reference panel that lives in an edge group (the document, settings)
  // counts as missing: Dockview would otherwise add the new panel INTO the edge.
  let referenceMissing =
    !!position &&
    "referencePanel" in position &&
    typeof position.referencePanel === "string" &&
    api.getPanel(position.referencePanel)?.api.location.type !== "grid" &&
    api.getPanel(position.referencePanel)?.api.location.type !== "floating";
  // When a panel wants to share a group (`within`) with a reference panel that
  // was skipped (e.g. `tempo-clock` referencing `terminal` on the web), inherit
  // that reference panel's own grid position so the group still forms in place.
  if (
    referenceMissing &&
    position &&
    "referencePanel" in position &&
    typeof position.referencePanel === "string" &&
    position.direction === "within"
  ) {
    const refPos = getRegistryEntry(position.referencePanel)?.position;
    if (
      refPos &&
      "referencePanel" in refPos &&
      typeof refPos.referencePanel === "string" &&
      (api.getPanel(refPos.referencePanel)?.api.location.type === "grid" ||
        api.getPanel(refPos.referencePanel)?.api.location.type === "floating")
    ) {
      position = refPos;
      referenceMissing = false;
    }
  }
  if (!position || referenceMissing) {
    const anchor = mainGridAnchor(api);
    position = anchor
      ? { referencePanel: anchor.id, direction: "within" }
      : { direction: "right" }; // absolute → targets the grid, not the active group
  }

  try {
    return api.addPanel({
      ...base,
      position,
      ...(initialSize?.width !== undefined ? { initialWidth: initialSize.width } : {}),
      ...(initialSize?.height !== undefined ? { initialHeight: initialSize.height } : {}),
      params: extraParams ? { ...base.params, ...extraParams } : base.params,
    });
  } catch (e) {
    console.warn(`[exoskeleton] addRegistryPanel ${entry.id} failed:`, e);
    return undefined;
  }
}

/** Add any missing companion panels declared by the registry entry for
 *  `id` (e.g. a json viewer pulls in json-edit, its json-bus producer). */
export function ensureCompanions(api: DockviewApi, id: string) {
  for (const cid of getRegistryEntry(id)?.companions ?? []) {
    const centry = getRegistryEntry(cid);
    if (centry && isPanelSupported(centry)) addRegistryPanel(api, centry);
  }
}

/** The one call sites should use to summon a panel by id: focuses it if
 *  it's already open, adds it (at its registry position) if not, and
 *  ensures its companions exist either way. */
export function addOrFocusPanel(api: DockviewApi, id: string) {
  if (id === DOCUMENT_PANEL_ID) {
    // The document edge opens and takes focus; no second canonical copy.
    openDocument(api, isPhoneWidth());
    return;
  }
  const existing = api.getPanel(id);
  if (existing) {
    existing.api.setActive();
  } else {
    const entry = getRegistryEntry(id);
    if (entry && isPanelSupported(entry)) addRegistryPanel(api, entry);
  }
  ensureCompanions(api, id);
}

/** Build a specific layout preset on the given Dockview grid.
 *  Picks the platform layout ("phone" vs "desktop") from presets.ts when
 *  present, or falls back to adding the preset's panelIds in registry order.
 *  Panels whose required capabilities the host lacks are skipped. */
export function buildPreset(api: DockviewApi, presetId: string) {
  const platform = isPhoneWidth() ? "phone" : "desktop";
  const supportedIds = panelRegistry.filter((e) => isPanelSupported(e)).map((e) => e.id);
  const placements = resolvePresetPlacements(presetId, platform, supportedIds);
  if (placements) {
    const sized: { panel: IDockviewPanel; size: number; horizontal: boolean }[] = [];
    for (const p of placements) {
      if (p.id === DOCUMENT_PANEL_ID || !isPanelSupported(p.id)) continue;
      const entry = getRegistryEntry(p.id);
      if (!entry) continue;
      const direction = p.direction ?? "right";
      const position: AddPanelPositionOptions = p.reference
        ? { referencePanel: p.reference, direction }
        : { direction: direction === "within" ? "right" : direction };
      const horizontal =
        direction === "left" ||
        (direction === "right" && Boolean(p.reference));
      const initialSize =
        p.size !== undefined
          ? horizontal
            ? { width: p.size }
            : { height: p.size }
          : undefined;
      const panel = addRegistryPanel(api, entry, undefined, position, initialSize);
      if (panel && p.size !== undefined) {
        sized.push({ panel, size: p.size, horizontal });
      }
    }
    for (const { panel, size, horizontal } of sized) {
      try {
        panel.group.api.setSize(horizontal ? { width: size } : { height: size });
      } catch {
        /* ignore if group cannot be resized */
      }
    }
    finishPreset(api, presetId);
    return;
  }

  const targetIds = new Set(resolvePresetPanelIds(presetId, supportedIds));
  for (const entry of panelRegistry) {
    // The document is not a grid pane (see finishPreset).
    if (targetIds.has(entry.id) && entry.id !== DOCUMENT_PANEL_ID && isPanelSupported(entry)) {
      addRegistryPanel(api, entry);
    }
  }
  finishPreset(api, presetId);
}

/** Ensure the bottom edge group and status-bar panel exist with its group header hidden. */
export function ensureStatusBar(api: DockviewApi): IDockviewPanel | undefined {
  let bottom = api.getEdgeGroup("bottom");
  if (!bottom) {
    bottom = api.addEdgeGroup("bottom", {
      id: "status-bar-group",
      initialSize: 40,
      minimumSize: 40,
    });
  }
  let panel = api.getPanel("status-bar");
  if (!panel) {
    panel = api.addPanel({
      id: "status-bar",
      component: "status-bar-panel",
      position: { referenceGroup: bottom.id },
    });
  }
  if (panel) {
    panel.group.header.hidden = true;
  }
  bottom.expand();
  return panel;
}

/** Every preset ends the same way: the left edge holds the document +
 *  Settings + Exo-skeleton tabs (open when the preset is about JSON and we
 *  are not on a phone), the status bar is restored at the bottom, and
 *  JSON Lab / Everything seed chapter one of Elinor Jones. */
function finishPreset(api: DockviewApi, presetId: string) {
  const prev = api.activePanel;
  const phone = isPhoneWidth();
  const open = !phone && presets.find((p) => p.id === presetId)?.documentOpen === true;
  const doc = ensureDocumentEdge(api, { phone, open });
  ensureEdgeTabs(api);
  syncDocumentEdgeHeader(api);
  doc?.api.setActive();
  ensureStatusBar(api);
  if (prev && api.getPanel(prev.id)) {
    prev.api.setActive();
  }
  seedPresetDocument(presetId);
}

/** True when a bus value is worth drawing (not absent, null, "", {} or []). */
function hasContent(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

/** JSON Lab and Everything open drawing something: if the active document is
 *  empty, load chapter one of The Epic of Elinor Jones ("Berry Thief"). Never
 *  overwrites an existing document. */
function seedPresetDocument(presetId: string) {
  if (!shouldSeedPresetDocument(presetId) || typeof window === "undefined") return;
  void (async () => {
    try {
      const [{ getJson }, { getActiveDocumentId }, { openLibraryDocument }] = await Promise.all([
        import("../data/json-bus.ts"),
        import("../osc/channels/index.ts"),
        import("../data/library.ts"),
      ]);
      if (hasContent(getJson(getActiveDocumentId()))) return;
      await openLibraryDocument("berry-thief");
    } catch (e) {
      console.warn("[exoskeleton] could not seed the preset document:", e);
    }
  })();
}

/** Build the default layout (called when no saved state exists). Default:
 *  "blank" (empty grid + preset picker). */
export function buildDefaultLayout(api: DockviewApi) {
  buildPreset(api, defaultPresetId());
}

/**
 * Safely applies a workspace layout to the live Dockview grid.
 * Clears existing panels and groups first to prevent orphan tabs,
 * migrates the layout JSON if needed, executes fromJSON(), and repairs layout.
 */
export function applyWorkspaceState(
  api: DockviewApi,
  layout: SerializedDockview,
  version: number = CURRENT_VERSION,
  phone: boolean = isPhoneWidth(),
) {
  api.clear();
  try {
    const migrated = migrateSavedLayout(layout, version, { phone });
    // Edge groups restored from JSON are created with only an id; make the
    // document/settings edges first so they keep their sizes and options.
    precreateEdgeGroups(api, migrated, phone);
    api.fromJSON(migrated);
    migrateLayout(api, version);
    ensureEdgeTabs(api);
  } catch (e) {
    console.warn(
      "[exoskeleton] applyWorkspaceState fromJSON failed, falling back to defaults:",
      e,
    );
    api.clear();
    buildDefaultLayout(api);
  }
  // A layout with no document (e.g. saved before it existed) still gets the
  // edge, collapsed: the document is always plugged in.
  ensureDocumentEdge(api, { phone });
  repairLayout(api);
}

/**
 * Pure decision helper: returns registry entries that should be automatically added
 * to a saved layout of `savedVersion`. Only returns entries introduced after `savedVersion`
 * that explicitly set `autoAdd === true`.
 */
export function panelsToAutoAdd(
  savedVersion: number,
  registry: RegistryEntry[] = panelRegistry,
): RegistryEntry[] {
  return registry.filter(
    (entry) => entry.introducedAt > savedVersion && entry.autoAdd === true,
  );
}

/**
 * After `fromJSON(saved.layout)` has restored a user's customized layout,
 * add any panels that explicitly opt into auto-addition (`autoAdd: true`).
 * The user's existing arrangement is preserved; new opt-in panels are slotted in
 * via their registry position, or anchored to the main grid if the
 * reference panel isn't around anymore.
 */
export function migrateLayout(api: DockviewApi, savedVersion: number) {
  for (const entry of panelsToAutoAdd(savedVersion)) {
    addRegistryPanel(api, entry);
  }
}

/**
 * Rescue pathological saved layouts. Observed failure mode (the pre-v7
 * saves): panels added without a position land in the ACTIVE group; when
 * that was the status-bar edge group, every panel got absorbed into the
 * bottom strip, the main grid serialized empty, and the watermark's
 * add-panel buttons all threw duplicate-id errors against panels the user
 * couldn't see.
 *
 * Detection: any panel living in an edge group that isn't a legitimate
 * edge resident (status-bar, settings). Repair: remove and re-add each
 * one into the main grid in registry order, preserving its params — no
 * state is wiped. Panels with no registry entry (spawned clones like
 * `json-tree-x3f9`) are re-added with their serialized component.
 *
 * Returns true if anything was repaired.
 */
export function repairLayout(api: DockviewApi): boolean {
  const misplaced = api.panels.filter(
    (p) => p.api.location.type === "edge" && !EDGE_RESIDENTS.has(p.id),
  );
  if (misplaced.length === 0) return false;

  console.warn(
    "[exoskeleton] repairLayout: rescuing panels from edge groups:",
    misplaced.map((p) => p.id),
  );

  const captured = misplaced.map((p) => ({
    id: p.id,
    component: p.view.contentComponent,
    title: p.title,
    params: p.params ? { ...p.params } : undefined,
  }));
  for (const p of misplaced) api.removePanel(p);

  const byId = new Map(captured.map((c) => [c.id, c]));
  for (const entry of panelRegistry) {
    const c = byId.get(entry.id);
    if (!c) continue;
    addRegistryPanel(api, entry, c.params);
    byId.delete(entry.id);
  }
  // Leftovers (ids the registry doesn't know): back into the main grid.
  for (const c of byId.values()) {
    const anchor = mainGridAnchor(api);
    try {
      api.addPanel({
        id: c.id,
        component: c.component,
        title: c.title,
        params: c.params,
        position: anchor
          ? { referencePanel: anchor.id, direction: "within" }
          : { direction: "right" },
      });
    } catch (e) {
      console.warn(`[exoskeleton] repairLayout: re-add ${c.id} failed:`, e);
    }
  }
  return true;
}
