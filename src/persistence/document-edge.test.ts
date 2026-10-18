import { test } from "node:test";
import assert from "node:assert";
import type { SerializedDockview } from "dockview-react";
import {
  DOCUMENT_EDGE_ID,
  DOCUMENT_PANEL_ID,
  migrateEdgeLayout,
} from "./document-edge.ts";
import { buildDeckLayout, edgeViewIds, layoutPanelOrder, reconcileLayouts } from "./deck.ts";

/** The pre-2026-10-12 Cmd+B settings group id, as old saved layouts carry it. */
const SETTINGS_EDGE_ID = "side-grid";
import { migrateSavedLayout } from "./default-layout.ts";

const p = (id: string, params?: Record<string, unknown>) => ({
  id,
  contentComponent: id,
  title: id,
  ...(params ? { params } : {}),
});

// A layout saved BEFORE the document edge: json-edit is a grid pane,
// settings is open in the LEFT edge group, the status bar is the bottom edge.
//   g1: json-edit   | (g2: json-tree over g3: editor)
function legacy(): SerializedDockview {
  return {
    grid: {
      orientation: "HORIZONTAL",
      width: 1200,
      height: 800,
      root: {
        type: "branch",
        size: 800,
        data: [
          { type: "leaf", size: 400, data: { id: "g1", views: ["json-edit"], activeView: "json-edit" } },
          {
            type: "branch",
            size: 800,
            data: [
              { type: "leaf", size: 400, data: { id: "g2", views: ["json-tree"], activeView: "json-tree" } },
              { type: "leaf", size: 400, data: { id: "g3", views: ["editor"], activeView: "editor" } },
            ],
          },
        ],
      },
    },
    panels: {
      "json-edit": p("json-edit", { documentId: "doc-7", followActive: false }),
      "json-tree": p("json-tree"),
      editor: p("editor"),
      settings: p("settings"),
      "status-bar": p("status-bar"),
    },
    activeGroup: "g1",
    edgeGroups: {
      left: {
        size: 320,
        visible: true,
        group: { id: SETTINGS_EDGE_ID, views: ["settings"], activeView: "settings" },
      },
      bottom: {
        size: 85,
        visible: true,
        group: { id: "status-bar-group", views: ["status-bar"], activeView: "status-bar", hideHeader: true },
      },
    },
  } as unknown as SerializedDockview;
}

const edges = (l: SerializedDockview) => l.edgeGroups as any;
const gridIds = (l: SerializedDockview) => {
  const out: string[] = [];
  const walk = (n: any) => (n.type === "leaf" ? out.push(...n.data.views) : n.data.forEach(walk));
  walk(l.grid.root);
  return out;
};

test("json-edit in the grid moves to the document edge; empty grid group is removed", () => {
  const next = migrateEdgeLayout(legacy());
  assert.deepStrictEqual(gridIds(next).sort(), ["editor", "json-tree"]);
  assert.ok(!JSON.stringify(next.grid.root).includes('"g1"'), "the emptied grid group is gone");
  const left = edges(next).left;
  assert.strictEqual(left.group.id, DOCUMENT_EDGE_ID);
  assert.deepStrictEqual(left.group.views, [DOCUMENT_PANEL_ID, "settings"]);
  assert.strictEqual(left.group.activeView, DOCUMENT_PANEL_ID);
  assert.strictEqual(left.visible, true);
  assert.ok(!left.collapsed, "desktop: a migrated document is expanded, it was on screen before");
  // panel state (and so the document it edits) rides along
  assert.deepStrictEqual(next.panels["json-edit"].params, { documentId: "doc-7", followActive: false });
  // the removed leaf was the active group: activeGroup points at a surviving one
  assert.ok(["g2", "g3"].includes(next.activeGroup as string));
  // the source is not mutated
  assert.deepStrictEqual(gridIds(legacy()).sort(), ["editor", "json-edit", "json-tree"]);
});

test("a legacy left-edge settings group folds into the document edge; status bar untouched", () => {
  const next = migrateEdgeLayout(legacy());
  const e = edges(next);
  assert.ok(!e.right, "no right edge group any more");
  assert.strictEqual(e.left.group.id, DOCUMENT_EDGE_ID);
  assert.deepStrictEqual(e.left.group.views, ["json-edit", "settings"]);
  assert.strictEqual(e.left.size, 360);
  assert.deepStrictEqual(e.bottom, edges(legacy()).bottom);
});

test("settings alone on the left (no json-edit anywhere): the group becomes the document edge holding settings", () => {
  const l = legacy();
  l.grid = {
    ...l.grid,
    root: { type: "branch", size: 800, data: [{ type: "leaf", size: 400, data: { id: "g3", views: ["editor"], activeView: "editor" } }] },
  } as unknown as SerializedDockview["grid"];
  delete (l.panels as any)["json-edit"];
  delete (l.panels as any)["json-tree"];
  const next = migrateEdgeLayout(l);
  assert.strictEqual(edges(next).left.group.id, DOCUMENT_EDGE_ID);
  assert.deepStrictEqual(edges(next).left.group.views, ["settings"]);
  assert.ok(!edges(next).right);
});

test("on a phone the migrated document edge starts collapsed", () => {
  assert.strictEqual(edges(migrateEdgeLayout(legacy(), { phone: true })).left.collapsed, true);
  assert.ok(!edges(migrateEdgeLayout(legacy(), { phone: false })).left.collapsed);
});

test("phone forces an already-migrated, expanded document edge to start collapsed; size is kept", () => {
  const migrated = migrateEdgeLayout(legacy());
  edges(migrated).left.size = 410;
  const phone = migrateEdgeLayout(migrated, { phone: true });
  assert.strictEqual(edges(phone).left.collapsed, true);
  assert.strictEqual(edges(phone).left.size, 410);
  assert.notStrictEqual(phone, migrated);
});

test("migration is idempotent and returns the same object when nothing changes", () => {
  const once = migrateEdgeLayout(legacy());
  assert.strictEqual(migrateEdgeLayout(once), once);
  const phoneOnce = migrateEdgeLayout(legacy(), { phone: true });
  assert.strictEqual(migrateEdgeLayout(phoneOnce, { phone: true }), phoneOnce);
});

test("clones (json-edit-xxxx) stay in the grid; only the exact canonical id moves", () => {
  const l = legacy();
  (l.grid.root as any).data[1].data[0].data.views = ["json-tree", "json-edit-ab12"];
  l.panels["json-edit-ab12"] = p("json-edit-ab12") as any;
  const next = migrateEdgeLayout(l);
  assert.ok(gridIds(next).includes("json-edit-ab12"));
  assert.ok(!gridIds(next).includes("json-edit"));
});

test("json-edit in a floating group moves too; an emptied floating group is dropped", () => {
  const l = legacy();
  (l.grid.root as any).data[0].data.views = ["editor"];
  l.floatingGroups = [
    { data: { id: "f1", views: ["json-edit"], activeView: "json-edit" }, position: { left: 10, top: 10, width: 300, height: 300 } },
  ] as any;
  const next = migrateEdgeLayout(l);
  assert.ok(!next.floatingGroups || next.floatingGroups.length === 0);
  assert.deepStrictEqual(edges(next).left.group.views, [DOCUMENT_PANEL_ID, "settings"]);
});

test("a grid copy next to an existing document edge is dropped; the edge entry wins", () => {
  const migrated = migrateEdgeLayout(legacy());
  edges(migrated).left.size = 500;
  edges(migrated).left.collapsed = true;
  // pretend a stale grid also still lists json-edit
  (migrated.grid.root as any).data[0].data.views.push("json-edit");
  const next = migrateEdgeLayout(migrated);
  assert.ok(!gridIds(next).includes("json-edit"));
  assert.strictEqual(edges(next).left.size, 500);
  assert.strictEqual(edges(next).left.collapsed, true);
  assert.deepStrictEqual(edges(next).left.group.views, [DOCUMENT_PANEL_ID, "settings"]);
});

test("a json-edit-only grid migrates to an empty grid with the document on the edge", () => {
  const l = legacy();
  l.grid = {
    ...l.grid,
    root: { type: "branch", size: 800, data: [{ type: "leaf", size: 400, data: { id: "g1", views: ["json-edit"], activeView: "json-edit" } }] },
  } as unknown as SerializedDockview["grid"];
  const next = migrateEdgeLayout(l);
  assert.deepStrictEqual((next.grid.root as any).data, []);
  assert.strictEqual(next.activeGroup, undefined);
  assert.deepStrictEqual(edges(next).left.group.views, [DOCUMENT_PANEL_ID, "settings"]);
});

test("migrateSavedLayout runs the edge migration (every load path goes through it)", () => {
  const next = migrateSavedLayout(legacy(), 11, { phone: true });
  assert.strictEqual(edges(next).left.group.id, DOCUMENT_EDGE_ID);
  assert.strictEqual(edges(next).left.collapsed, true);
  assert.ok(!edges(next).right);
});

// ---- deck / reconcile leave edge groups alone ------------------------------

test("edgeViewIds lists every panel living in an edge group", () => {
  const next = migrateEdgeLayout(legacy());
  assert.deepStrictEqual(edgeViewIds(next).sort(), ["json-edit", "settings", "status-bar"]);
});

test("deck: the document stays on its edge, is not a deck tab, and its state is kept", () => {
  const grid = migrateEdgeLayout(legacy());
  const deck = buildDeckLayout(grid);
  assert.deepStrictEqual(layoutPanelOrder(deck), ["json-tree", "editor"]);
  assert.deepStrictEqual(deck.edgeGroups, grid.edgeGroups);
  assert.deepStrictEqual(deck.panels["json-edit"].params, { documentId: "doc-7", followActive: false });
  assert.ok(deck.panels["settings"] && deck.panels["status-bar"]);
});

test("reconcile never folds the document into the grid, either way", () => {
  const grid = migrateEdgeLayout(legacy());
  const deck = buildDeckLayout(grid);
  edges(deck).left.collapsed = true; // the phone collapsed its own copy
  const backToGrid = reconcileLayouts(grid, deck);
  assert.ok(!gridIds(backToGrid).includes("json-edit"));
  assert.deepStrictEqual(backToGrid.edgeGroups, grid.edgeGroups, "the grid keeps its own edge state");
  const backToDeck = reconcileLayouts(deck, grid);
  assert.ok(!gridIds(backToDeck).includes("json-edit"));
  assert.strictEqual(edges(backToDeck).left.collapsed, true, "the deck keeps its own edge state");
});

test("a legacy grid reconciled into a migrated deck still ends with one document, on the edge", () => {
  const deck = buildDeckLayout(migrateEdgeLayout(legacy()));
  // the saved grid is still legacy (json-edit is a pane there): reconcile adds it to the deck...
  const merged = reconcileLayouts(deck, legacy());
  // ...and the load-time migration (migrateSavedLayout) takes it back out.
  const loaded = migrateSavedLayout(merged, 11);
  assert.ok(!gridIds(loaded).includes("json-edit"));
  assert.deepStrictEqual(edges(loaded).left.group.views, [DOCUMENT_PANEL_ID, "settings"]);
});
