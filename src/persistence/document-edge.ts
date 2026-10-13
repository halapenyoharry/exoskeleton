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

import type { DockviewApi, IDockviewPanel, SerializedDockview } from "dockview";
import { DECK_QUERY, leaves, pruneRoot, type GridNode, type LeafData } from "./deck.ts";
import { isWebRuntime } from "./presets.ts";

/** The canonical document panel. Clones are `json-edit-xxxx` (grid, allowed). */
export const DOCUMENT_PANEL_ID = "json-edit";
export const DOCUMENT_EDGE = "left" as const;
export const DOCUMENT_EDGE_ID = "document-edge";

/** Cmd+B settings group (moved from the left edge to the right edge). */
export const SETTINGS_EDGE = "right" as const;
export const SETTINGS_EDGE_ID = "side-grid";
export const SETTINGS_EDGE_SIZE = 320;
export const SETTINGS_EDGE_MIN = 200;

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
  const strip = <T extends { data: { views: string[]; activeView?: string } }>(groups: T[] | undefined) =>
    groups
      ?.map((g) => {
        if (!g.data.views.includes(id)) return g;
        found = true;
        const views = g.data.views.filter((v) => v !== id);
        const activeView = g.data.activeView && views.includes(g.data.activeView) ? g.data.activeView : views[0];
        return { ...g, data: { ...g.data, views, activeView } };
      })
      .filter((g) => g.data.views.length > 0);
  if (layout.floatingGroups) out = { ...out, floatingGroups: strip(layout.floatingGroups) };
  if (layout.popoutGroups) out = { ...out, popoutGroups: strip(layout.popoutGroups) };

  if (found && out.activeGroup) {
    const gridIds = new Set(
      leaves(out.grid?.root as unknown as GridNode | undefined).map((l: LeafData) => l.id),
    );
    const otherIds = new Set<string>([
      ...(out.floatingGroups ?? []).map((g) => g.data.id),
      ...(out.popoutGroups ?? []).map((g) => g.data.id),
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
 *  - a left edge group that is not the document edge (the pre-change Cmd+B
 *    settings group, id "side-grid") moves to the right edge;
 *  - a panel with id exactly `json-edit` in the grid / a floating group / a
 *    popout moves to the document edge (empty grid groups are pruned);
 *  - on a phone the document edge always starts collapsed (it opens as a sheet).
 *
 * `edgeGroups` is otherwise left alone: the status bar and settings entries,
 * sizes and collapsed flags survive untouched.
 */
export function migrateEdgeLayout(
  layout: SerializedDockview,
  opts: { phone?: boolean } = {},
): SerializedDockview {
  const edges: EdgeMap = { ...((layout.edgeGroups ?? {}) as EdgeMap) };
  let changed = false;

  const left = edges.left;
  if (left?.group && left.group.id !== DOCUMENT_EDGE_ID && !edges.right) {
    edges.right = left;
    delete edges.left;
    changed = true;
  }

  const { layout: stripped, found } = removeFromNonEdge(layout, DOCUMENT_PANEL_ID);
  if (found) {
    changed = true;
    const doc = edges.left?.group;
    if (doc && doc.id === DOCUMENT_EDGE_ID) {
      if (!doc.views.includes(DOCUMENT_PANEL_ID)) {
        edges.left = {
          ...edges.left!,
          group: { ...doc, views: [...doc.views, DOCUMENT_PANEL_ID], activeView: doc.activeView ?? DOCUMENT_PANEL_ID },
        };
      }
    } else {
      edges.left = {
        size: DOCUMENT_EDGE_SIZE,
        visible: true,
        group: { id: DOCUMENT_EDGE_ID, views: [DOCUMENT_PANEL_ID], activeView: DOCUMENT_PANEL_ID },
      };
    }
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
  // Horizontal header: the pill overlays the content like every other pane.
  // (Dockview's default for a left edge is a vertical tab strip.)
  edge.setHeaderPosition("top");
  return edge;
}

/**
 * Create the groups a layout is about to be restored into, with the options
 * Dockview cannot read back from a serialized layout (it auto-creates edge
 * groups from JSON with only an id: no minimum size, no collapsed size).
 * Call before `api.fromJSON(layout)`. The document edge is created collapsed;
 * the layout's own edge state then overrides that.
 */
export function precreateEdgeGroups(api: DockviewApi, layout: SerializedDockview, phone: boolean): void {
  if (!api.getEdgeGroup(DOCUMENT_EDGE)) addDocumentEdge(api, { phone, collapsed: true });
  const right = (layout.edgeGroups as EdgeMap | undefined)?.right;
  if (right && !api.getEdgeGroup(SETTINGS_EDGE)) {
    api.addEdgeGroup(SETTINGS_EDGE, {
      id: right.group?.id ?? SETTINGS_EDGE_ID,
      initialSize: SETTINGS_EDGE_SIZE,
      minimumSize: SETTINGS_EDGE_MIN,
    });
  }
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
