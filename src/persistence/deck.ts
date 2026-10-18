// Mobile "deck": one group holding every panel as a tab (pill), one pane
// full-screen at a time. Pure layout transforms over SerializedDockview, so
// the desktop grid is never flattened: a workspace keeps BOTH layouts
// (`layout` = grid, `mobileLayout` = deck) and swaps by viewport width.
// No runtime imports (node tests load this file directly).

import type { SerializedDockview } from "dockview-react";

/** Deck mode applies at or below this width (web runtime only). */
export const DECK_QUERY = "(max-width: 600px)";

/** Panels that live in edge groups / transient UI; never part of the deck's tab set. */
const NON_DECK_IDS = new Set(["status-bar", "settings", "menu"]);

export type GridNode = { type: "leaf" | "branch"; data: unknown; size?: number; visible?: boolean };
export type LeafData = { views: string[]; activeView?: string; id: string; [k: string]: unknown };

/** Panel ids living in edge groups (status bar, settings, the document):
 *  structural chrome, never tabs of the deck and never folded into the grid. */
export function edgeViewIds(layout: SerializedDockview): string[] {
  const out: string[] = [];
  const eg = (layout.edgeGroups ?? {}) as Record<string, { group?: { views?: unknown } } | undefined>;
  for (const pos of ["top", "bottom", "left", "right"]) {
    const views = eg[pos]?.group?.views;
    if (Array.isArray(views)) for (const v of views) if (typeof v === "string") out.push(v);
  }
  return out;
}

export function leaves(node: GridNode | undefined, out: LeafData[] = []): LeafData[] {
  if (!node) return out;
  if (node.type === "leaf") out.push(node.data as LeafData);
  else for (const c of node.data as GridNode[]) leaves(c, out);
  return out;
}

const root = (l: SerializedDockview) => l.grid?.root as unknown as GridNode | undefined;

/** Non-edge panel ids in visual order: grid leaves, then floating groups. */
export function layoutPanelOrder(layout: SerializedDockview): string[] {
  const ids: string[] = [];
  const edge = new Set(edgeViewIds(layout));
  const push = (id: string) => {
    if (!NON_DECK_IDS.has(id) && !edge.has(id) && layout.panels?.[id] && !ids.includes(id)) ids.push(id);
  };
  for (const lf of leaves(root(layout))) lf.views.forEach(push);
  for (const g of layout.floatingGroups ?? []) g.data?.views.forEach(push);
  for (const g of layout.popoutGroups ?? []) g.data?.views.forEach(push);
  return ids;
}

/** The active panel: active group's activeView, else the first leaf's. */
export function layoutActivePanel(layout: SerializedDockview): string | undefined {
  const all = leaves(root(layout));
  const grp = all.find((l) => l.id === layout.activeGroup) ?? all[0];
  const a = grp?.activeView;
  return a && !NON_DECK_IDS.has(a) && !edgeViewIds(layout).includes(a) ? a : layoutPanelOrder(layout)[0];
}

function singleGroup(base: SerializedDockview, views: string[], active: string | undefined, groupId: string): SerializedDockview {
  const panels: SerializedDockview["panels"] = {};
  for (const id of views) panels[id] = base.panels[id];
  for (const id of NON_DECK_IDS) if (base.panels?.[id]) panels[id] = base.panels[id];
  for (const id of edgeViewIds(base)) if (base.panels?.[id]) panels[id] = base.panels[id];
  const out: SerializedDockview = {
    ...base,
    grid: {
      ...base.grid,
      root: {
        type: "branch",
        size: base.grid?.height ?? 600,
        data: [
          {
            type: "leaf",
            size: base.grid?.width ?? 400,
            data: { views, activeView: active && views.includes(active) ? active : views[0], id: groupId },
          },
        ],
      } as unknown as SerializedDockview["grid"]["root"],
    },
    panels,
    activeGroup: groupId,
  };
  delete out.floatingGroups;
  delete out.popoutGroups;
  return stripMaximized(out);
}

/** A maximized group's location is meaningless once the arrangement changes. */
function stripMaximized(l: SerializedDockview): SerializedDockview {
  const g = l.grid as unknown as { maximizedNode?: unknown };
  if (!g || g.maximizedNode === undefined) return l;
  const { maximizedNode: _m, ...rest } = g;
  return { ...l, grid: rest as unknown as SerializedDockview["grid"] };
}

/** Grid -> deck: every panel into one group; params/ids preserved; active kept. */
export function buildDeckLayout(grid: SerializedDockview): SerializedDockview {
  const ids = layoutPanelOrder(grid);
  const groupId = leaves(root(grid))[0]?.id ?? "deck";
  return singleGroup(grid, ids, layoutActivePanel(grid), groupId);
}

/** Drop `removed` views; returns the nodes that replace `node` in its parent
 *  (a lone survivor is folded so no one-child branch is ever emitted). */
function prune(node: GridNode, removed: Set<string>): GridNode[] {
  if (node.type === "leaf") {
    const d = node.data as LeafData;
    const views = d.views.filter((v) => !removed.has(v));
    if (views.length === 0) return [];
    const activeView = d.activeView && views.includes(d.activeView) ? d.activeView : views[0];
    return [{ ...node, data: { ...d, views, activeView } }];
  }
  const kids = (node.data as GridNode[]).flatMap((c) => prune(c, removed));
  if (kids.length === 0) return [];
  if (kids.length === 1) {
    const only = kids[0];
    if (only.type === "leaf") return [{ ...only, size: node.size }];
    // Dissolve the lone sub-branch into this node's slot (same axis as the parent).
    const gk = only.data as GridNode[];
    const sum = gk.reduce((t, k) => t + (k.size ?? 1), 0) || 1;
    return gk.map((k) => ({
      ...k,
      size: node.size === undefined ? k.size : ((k.size ?? 1) / sum) * node.size,
    }));
  }
  return [{ ...node, data: kids }];
}

export function pruneRoot(grid: SerializedDockview, removed: Set<string>): SerializedDockview["grid"] {
  let rootNode = grid.grid.root as unknown as GridNode;
  let orientation = grid.grid.orientation;
  let kids = (rootNode.data as GridNode[]).flatMap((c) => prune(c, removed));
  // Lone branch child: it becomes the root and the axis flips.
  while (kids.length === 1 && kids[0].type === "branch") {
    kids = kids[0].data as GridNode[];
    orientation = (orientation === "HORIZONTAL" ? "VERTICAL" : "HORIZONTAL") as typeof orientation;
  }
  rootNode = { ...rootNode, data: kids };
  return { ...grid.grid, orientation, root: rootNode as unknown as SerializedDockview["grid"]["root"] };
}

/**
 * Bring `target` (the layout of a mode we are re-entering) in line with
 * `source` (the layout of the mode we just left): panels only in `target`
 * disappear, panels only in `source` are added (deck: appended to its single
 * group; grid: appended to the active group), and panels in both take
 * `source`'s state (params/title) since that is the most recent edit.
 * Arrangement of `target` is otherwise kept.
 */
export function reconcileLayouts(
  target: SerializedDockview,
  source: SerializedDockview,
): SerializedDockview {
  const srcIds = layoutPanelOrder(source);
  const tgtIds = layoutPanelOrder(target);
  const removed = new Set(tgtIds.filter((id) => !srcIds.includes(id)));
  const added = srcIds.filter((id) => !tgtIds.includes(id));

  const tRoot = root(target);
  if (srcIds.length === 0) {
    const panels: SerializedDockview["panels"] = {};
    for (const id of NON_DECK_IDS) if (target.panels?.[id]) panels[id] = target.panels[id];
    for (const id of edgeViewIds(target)) if (target.panels?.[id]) panels[id] = target.panels[id];
    const out: SerializedDockview = {
      ...target,
      panels,
      grid: { ...target.grid, root: { ...(tRoot ?? { type: "branch" }), data: [] } as unknown as SerializedDockview["grid"]["root"] },
    };
    delete out.activeGroup;
    delete out.floatingGroups;
    delete out.popoutGroups;
    return stripMaximized(out);
  }
  if (!tRoot || leaves(tRoot).length === 0 || leaves(tRoot).every((l) => l.views.every((v) => removed.has(v)) )) {
    // Nothing to keep in target: arrange all of source's panels in one group.
    const keepActive = layoutActivePanel(source);
    return singleGroup({ ...target, panels: { ...target.panels, ...source.panels } }, srcIds, keepActive, leaves(tRoot)[0]?.id ?? "deck");
  }

  const nextGrid = pruneRoot(target, removed);
  const all = leaves(nextGrid.root as unknown as GridNode);
  const host = all.find((l) => l.id === target.activeGroup) ?? all[0];
  if (host) {
    host.views = [...host.views, ...added];
  }

  const panels: SerializedDockview["panels"] = {};
  for (const [id, st] of Object.entries(target.panels ?? {})) {
    if (!removed.has(id)) panels[id] = st;
  }
  for (const id of srcIds) if (source.panels[id]) panels[id] = source.panels[id];

  const keptGroupIds = new Set(all.map((l) => l.id));
  const out: SerializedDockview = {
    ...target,
    grid: nextGrid,
    panels,
    activeGroup: target.activeGroup && keptGroupIds.has(target.activeGroup) ? target.activeGroup : host?.id,
  };
  if (target.floatingGroups) {
    const fg = target.floatingGroups
      .map((g) => (g.data ? { ...g, data: { ...g.data, views: g.data.views.filter((v) => !removed.has(v)) } } : g))
      .filter((g) => !g.data || g.data.views.length > 0);
    out.floatingGroups = fg;
  }
  return stripMaximized(out);
}

/** True when `layout` has exactly one grid group (a deck). */
export function isDeckShaped(layout: SerializedDockview): boolean {
  return leaves(root(layout)).length <= 1;
}
