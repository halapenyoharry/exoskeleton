// The document edge: the JSON document is not a pane, it is the thing plugged
// in. It lives in a Dockview edge group on the LEFT of the shell (the settings
// group is on the right), holding exactly one canonical `json-edit` panel.
//
// This file owns three things, kept together so the contract is in one place:
//   1. the ids/sizes that name the edge (constants);
//   2. a pure layout migration over SerializedDockview (node-testable): a
//      `json-edit` found in the grid/floating/popout moves to the document edge,
//      and the legacy left-edge settings group moves to the right edge;
//   3. small DockviewApi helpers (ensure / open / collapse / toggle).
//
// Only type imports from dockview: node tests load this file directly.

import type { DockviewApi, IDockviewPanel, SerializedDockview } from "dockview-react";
import { DECK_QUERY, leaves, pruneRoot, type GridNode, type LeafData } from "./deck.ts";
import { isWebRuntime } from "./presets.ts";

/** The canonical document panel. Clones are `json-edit-xxxx` (grid, allowed). */
export const DOCUMENT_PANEL_ID = "json-edit";
export const DOCUMENT_EDGE = "left" as const;
export const DOCUMENT_EDGE_ID = "document-edge";

/** The other tabs that live in the document edge beside `json-edit`:
 *  settings (Cmd+B) and the menu (add panel / workspaces). */
export const EDGE_TAB_IDS = ["settings", "menu"] as const;
export type EdgeTabId = (typeof EDGE_TAB_IDS)[number];
const EDGE_TAB_TITLES: Record<EdgeTabId, string> = { settings: "settings", menu: "menu" };

export const DOCUMENT_EDGE_SIZE = 360;
export const DOCUMENT_EDGE_MIN = 280;
export const DOCUMENT_COLLAPSED_SIZE = 40;
export const DOCUMENT_COLLAPSED_SIZE_PHONE = 44;

/** Phone: web runtime and a viewport at or below DECK_QUERY. */
export function isPhoneWidth(): boolean {
  return (
    isWebRuntime() &&
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(DECK_QUERY).matches
  );
}

// ---------------------------------------------------------------- migration

type EdgePosition = "top" | "bottom" | "left" | "right";
type EdgeGroupState = { id: string; views: string[]; activeView?: string; [k: string]: unknown };
type EdgeEntry = { size: number; visible: boolean; collapsed?: boolean; group?: EdgeGroupState };
type EdgeMap = Partial<Record<EdgePosition, EdgeEntry>>;

function gridHas(layout: SerializedDockview, id: string): boolean {
  const root = layout.grid?.root as unknown as GridNode | undefined;
  const all = root ? leaves(root) : [];
  return all.some((l: LeafData) => l.views.includes(id));
}

/** Remove panel `id` from the grid, floating and popout groups (never edges). */
function removeFromNonEdge(
  layout: SerializedDockview,
  id: string,
): { layout: SerializedDockview; found: boolean } {
  let found = false;
  let out: SerializedDockview = layout;

  if (gridHas(layout, id)) {
    found = true;
    out = { ...out, grid: pruneRoot(out, new Set([id])) };
  }
  // Dockview 8: a floating/popout entry carries either `data` (one group) or
  // `grid` (nested layout); only the `data` form can hold the document.
  const strip = <T extends { data?: { views: string[]; activeView?: string } }>(groups: T[] | undefined) =>
    groups
      ?.map((g) => {
        if (!g.data || !g.data.views.includes(id)) return g;
        found = true;
        const views = g.data.views.filter((v) => v !== id);
        const activeView = g.data.activeView && views.includes(g.data.activeView) ? g.data.activeView : views[0];
        return { ...g, data: { ...g.data, views, activeView } };
      })
      .filter((g) => !g.data || g.data.views.length > 0);
  if (layout.floatingGroups) out = { ...out, floatingGroups: strip(layout.floatingGroups) };
  if (layout.popoutGroups) out = { ...out, popoutGroups: strip(layout.popoutGroups) };

  if (found && out.activeGroup) {
    const gridIds = new Set(
      leaves(out.grid?.root as unknown as GridNode | undefined).map((l: LeafData) => l.id),
    );
    const otherIds = new Set<string>([
      ...(out.floatingGroups ?? []).map((g) => g.data?.id ?? ""),
      ...(out.popoutGroups ?? []).map((g) => g.data?.id ?? ""),
      ...Object.values((out.edgeGroups ?? {}) as EdgeMap).map((e) => e?.group?.id ?? ""),
    ]);
    if (!gridIds.has(out.activeGroup) && !otherIds.has(out.activeGroup)) {
      const first = [...gridIds][0];
      out = { ...out };
      if (first) out.activeGroup = first;
      else delete out.activeGroup;
    }
  }
  return { layout: out, found };
}

/**
 * Bring a saved layout in line with the document-edge arrangement. Idempotent
 * and pure; returns the SAME object when nothing needs to change.
 *
 *  - the document edge (left) holds `json-edit`, `settings` and `menu`;
 *  - any other left edge group (the pre-change Cmd+B settings group,
 *    id "side-grid") and any right edge group fold into it: their views join
 *    the document edge and the group goes away;
 *  - `json-edit` / `settings` / `menu` found in the grid, a floating group or
 *    a popout move to the document edge (empty grid groups are pruned);
 *  - on a phone the document edge always starts collapsed (it opens as a sheet).
 *
 * The status bar entry, sizes and collapsed flags survive untouched.
 */
export function migrateEdgeLayout(
  layout: SerializedDockview,
  opts: { phone?: boolean } = {},
): SerializedDockview {
  const edges: EdgeMap = { ...((layout.edgeGroups ?? {}) as EdgeMap) };
  let changed = false;
  const joining: string[] = [];

  if (edges.left?.group && edges.left.group.id !== DOCUMENT_EDGE_ID) {
    joining.push(...edges.left.group.views);
    delete edges.left;
    changed = true;
  }
  if (edges.right?.group) {
    joining.push(...edges.right.group.views);
    delete edges.right;
    changed = true;
  }

  let stripped: SerializedDockview = layout;
  for (const id of [DOCUMENT_PANEL_ID, ...EDGE_TAB_IDS]) {
    const r = removeFromNonEdge(stripped, id);
    if (r.found) {
      stripped = r.layout;
      joining.push(id);
      changed = true;
    }
  }

  if (joining.length > 0) {
    const doc = edges.left?.group?.id === DOCUMENT_EDGE_ID ? edges.left : undefined;
    const have = new Set(doc?.group?.views ?? []);
    const views = [...(doc?.group?.views ?? [])];
    for (const id of joining) {
      if (!have.has(id) && (id === DOCUMENT_PANEL_ID || layout.panels?.[id])) {
        views.push(id);
        have.add(id);
      }
    }
    // Keep the document first so the strip reads document, settings, menu.
    views.sort((x, y) => (x === DOCUMENT_PANEL_ID ? -1 : y === DOCUMENT_PANEL_ID ? 1 : 0));
    const activeView = doc?.group?.activeView && have.has(doc.group.activeView) ? doc.group.activeView : views[0];
    edges.left = {
      size: doc?.size ?? DOCUMENT_EDGE_SIZE,
      visible: doc?.visible ?? true,
      ...(doc?.collapsed !== undefined ? { collapsed: doc.collapsed } : {}),
      group: { ...(doc?.group ?? {}), id: DOCUMENT_EDGE_ID, views, activeView },
    };
  }

  const doc = edges.left;
  if (doc?.group?.id === DOCUMENT_EDGE_ID) {
    if (!Number.isFinite(doc.size) || doc.size < 100) {
      edges.left = { ...doc, size: DOCUMENT_EDGE_SIZE };
      changed = true;
    }
    if (opts.phone && !edges.left!.collapsed) {
      edges.left = { ...edges.left!, collapsed: true };
      changed = true;
    }
  }

  if (!changed) return layout;
  const out: SerializedDockview = { ...stripped };
  if (Object.keys(edges).length > 0) out.edgeGroups = edges as SerializedDockview["edgeGroups"];
  else delete out.edgeGroups;
  return out;
}

// ---------------------------------------------------------------- live api

/** Edge options. Fixed at creation (Dockview reads them once), so the phone
 *  flavour is chosen from the viewport at that moment. */
export function documentEdgeOptions(opts: { phone: boolean; collapsed: boolean }) {
  const vw = typeof window !== "undefined" ? window.innerWidth : DOCUMENT_EDGE_SIZE;
  if (opts.phone) {
    return {
      id: DOCUMENT_EDGE_ID,
      initialSize: vw,
      minimumSize: 200,
      maximumSize: vw,
      collapsedSize: DOCUMENT_COLLAPSED_SIZE_PHONE,
      collapsed: opts.collapsed,
    };
  }
  return {
    id: DOCUMENT_EDGE_ID,
    initialSize: DOCUMENT_EDGE_SIZE,
    minimumSize: DOCUMENT_EDGE_MIN,
    collapsedSize: DOCUMENT_COLLAPSED_SIZE,
    collapsed: opts.collapsed,
  };
}

function addDocumentEdge(api: DockviewApi, opts: { phone: boolean; collapsed: boolean }) {
  const edge = api.addEdgeGroup(DOCUMENT_EDGE, documentEdgeOptions(opts));
  // Vertical tab strip on the left: Dockview's own shape for a left edge.
  // Dockview 8 sizes a collapsed edge group from its measured tab strip, so
  // the strip must have a fixed cross size — a top header's width follows
  // the group's and feeds back into it (the edge shrank to nothing).
  edge.setHeaderPosition("left");
  return edge;
}

/**
 * Create the groups a layout is about to be restored into, with the options
 * Dockview cannot read back from a serialized layout (it auto-creates edge
 * groups from JSON with only an id: no minimum size, no collapsed size).
 * Call before `api.fromJSON(layout)`. The document edge is created collapsed;
 * the layout's own edge state then overrides that.
 */
export function precreateEdgeGroups(api: DockviewApi, _layout: SerializedDockview, phone: boolean): void {
  if (!api.getEdgeGroup(DOCUMENT_EDGE)) addDocumentEdge(api, { phone, collapsed: true });
}

/**
 * The document edge also holds the settings and menu tabs. Idempotent; never
 * steals focus and never expands the edge.
 */
export function ensureEdgeTabs(api: DockviewApi): void {
  const edge = api.getEdgeGroup(DOCUMENT_EDGE);
  if (!edge) return;
  const prev = api.activePanel;
  for (const id of EDGE_TAB_IDS) {
    if (api.getPanel(id)) continue;
    try {
      api.addPanel({ id, component: id, title: EDGE_TAB_TITLES[id], position: { referenceGroup: edge.id } });
    } catch (e) {
      console.warn(`[exoskeleton] ensureEdgeTabs ${id} failed:`, e);
    }
  }
  if (prev && prev.id !== api.activePanel?.id) prev.api.setActive();
}

/** Expand the document edge and focus one of its tabs (settings / menu). */
export function openEdgeTab(api: DockviewApi, id: EdgeTabId, phone: boolean): void {
  ensureDocumentEdge(api, { phone });
  ensureEdgeTabs(api);
  const panel = api.getPanel(id);
  if (!panel) return;
  if (panel.api.location.type === "edge") api.getEdgeGroup(DOCUMENT_EDGE)?.expand();
  panel.api.setActive();
}

/** Cmd+B / ⊞: open the tab, or collapse the edge when it is already showing. */
export function toggleEdgeTab(api: DockviewApi, id: EdgeTabId, phone: boolean): void {
  const panel = api.getPanel(id);
  const edge = api.getEdgeGroup(DOCUMENT_EDGE);
  const showing = !!panel && !!edge && !edge.isCollapsed() && panel.api.location.type === "edge" && api.activePanel?.id === id;
  if (showing) edge!.collapse();
  else openEdgeTab(api, id, phone);
}

/**
 * The left edge always exists and always holds the canonical `json-edit`.
 * Idempotent: if the panel is already anywhere, nothing moves. When it has to
 * be (re)created, `open` picks expanded or collapsed (default collapsed);
 * the previously active panel keeps focus.
 */
export function ensureDocumentEdge(
  api: DockviewApi,
  opts: { phone: boolean; open?: boolean; params?: Record<string, unknown> },
): IDockviewPanel | undefined {
  const open = opts.open === true;
  const edge = api.getEdgeGroup(DOCUMENT_EDGE) ?? addDocumentEdge(api, { phone: opts.phone, collapsed: !open });
  const existing = api.getPanel(DOCUMENT_PANEL_ID);
  if (existing) return existing;
  const prev = api.activePanel;
  try {
    const panel = api.addPanel({
      id: DOCUMENT_PANEL_ID,
      component: "json-edit",
      title: "json-edit",
      ...(opts.params ? { params: opts.params } : {}),
      position: { referenceGroup: edge.id },
    });
    if (open) edge.expand();
    else edge.collapse();
    if (prev && prev.id !== DOCUMENT_PANEL_ID) prev.api.setActive();
    return panel;
  } catch (e) {
    console.warn("[exoskeleton] ensureDocumentEdge failed:", e);
    return undefined;
  }
}

/** True when the document edge exists and is expanded. */
export function isDocumentOpen(api: DockviewApi): boolean {
  const edge = api.getEdgeGroup(DOCUMENT_EDGE);
  return !!edge && !edge.isCollapsed();
}

export function setDocumentOpen(api: DockviewApi, open: boolean, phone: boolean): void {
  if (!api.getPanel(DOCUMENT_PANEL_ID) || !api.getEdgeGroup(DOCUMENT_EDGE)) {
    ensureDocumentEdge(api, { phone, open });
    return;
  }
  const edge = api.getEdgeGroup(DOCUMENT_EDGE)!;
  if (open) edge.expand();
  else edge.collapse();
}

/** Expand the document edge and focus the canonical `json-edit`. When the
 *  panel is not on the edge (dragged into the grid), just focus it there. */
export function openDocument(api: DockviewApi, phone: boolean): void {
  const panel = api.getPanel(DOCUMENT_PANEL_ID) ?? ensureDocumentEdge(api, { phone, open: true });
  if (!panel) return;
  if (panel.api.location.type === "edge") api.getEdgeGroup(DOCUMENT_EDGE)?.expand();
  panel.api.setActive();
}

export function toggleDocument(api: DockviewApi, phone: boolean): void {
  const panel = api.getPanel(DOCUMENT_PANEL_ID);
  if (!panel || panel.api.location.type !== "edge") {
    openDocument(api, phone);
    return;
  }
  setDocumentOpen(api, !isDocumentOpen(api), phone);
  if (isDocumentOpen(api)) panel.api.setActive();
}
