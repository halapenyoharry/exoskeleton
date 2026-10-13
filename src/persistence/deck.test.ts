import { test } from "node:test";
import assert from "node:assert";
import type { SerializedDockview } from "dockview";
import {
  buildDeckLayout,
  layoutPanelOrder,
  layoutActivePanel,
  reconcileLayouts,
  isDeckShaped,
} from "./deck.ts";

const p = (id: string, params?: Record<string, unknown>) => ({ id, contentComponent: id, title: id, ...(params ? { params } : {}) });

// editor | (webview over terminal), plus status-bar edge resident.
const grid = {
  grid: {
    orientation: "HORIZONTAL",
    width: 1200,
    height: 800,
    root: {
      type: "branch",
      size: 800,
      data: [
        { type: "leaf", size: 600, data: { id: "g1", views: ["editor"], activeView: "editor" } },
        {
          type: "branch",
          size: 600,
          data: [
            { type: "leaf", size: 400, data: { id: "g2", views: ["webview"], activeView: "webview" } },
            { type: "leaf", size: 400, data: { id: "g3", views: ["terminal"], activeView: "terminal" } },
          ],
        },
      ],
    },
  },
  panels: {
    editor: p("editor", { filePath: "/a.md" }),
    webview: p("webview", { url: "https://x" }),
    terminal: p("terminal"),
    "status-bar": p("status-bar"),
  },
  activeGroup: "g3",
} as unknown as SerializedDockview;

test("buildDeckLayout puts every panel in one group, keeps params and active", () => {
  const deck = buildDeckLayout(grid);
  assert.deepStrictEqual(layoutPanelOrder(deck), ["editor", "webview", "terminal"]);
  assert.strictEqual(layoutActivePanel(deck), "terminal");
  assert.ok(isDeckShaped(deck));
  assert.deepStrictEqual(deck.panels.editor.params, { filePath: "/a.md" });
  assert.ok(deck.panels["status-bar"], "edge resident panel state is kept");
  // the source grid is not mutated
  assert.strictEqual(layoutPanelOrder(grid).length, 3);
  assert.ok(!isDeckShaped(grid));
});

test("reconcile deck <- grid: added panels appended, removed dropped, params follow source", () => {
  const deck = buildDeckLayout(grid);
  // desktop edits: terminal closed, a json-tree added, editor file changed
  const edited = {
    ...grid,
    panels: { ...grid.panels, "json-tree": p("json-tree"), editor: p("editor", { filePath: "/b.md" }) },
    grid: {
      ...grid.grid,
      root: {
        ...(grid.grid.root as any),
        data: [
          { type: "leaf", size: 600, data: { id: "g1", views: ["editor", "json-tree"], activeView: "editor" } },
          { type: "leaf", size: 600, data: { id: "g2", views: ["webview"], activeView: "webview" } },
        ],
      },
    },
  } as unknown as SerializedDockview;
  delete (edited.panels as any).terminal;
  const next = reconcileLayouts(deck, edited);
  assert.deepStrictEqual(layoutPanelOrder(next), ["editor", "webview", "json-tree"]);
  assert.strictEqual(next.panels.editor.params?.filePath, "/b.md");
  assert.ok(!next.panels.terminal);
  assert.ok(isDeckShaped(next));
});

test("reconcile grid <- deck: removal prunes empty groups, addition lands in active group", () => {
  const deck = buildDeckLayout(grid);
  // phone edits: webview closed, scope added
  const edited = reconcileLayouts(deck, {
    ...deck,
    panels: { editor: deck.panels.editor, terminal: deck.panels.terminal, scope: p("scope"), "status-bar": deck.panels["status-bar"] },
    grid: {
      ...deck.grid,
      root: { type: "branch", size: 800, data: [{ type: "leaf", size: 400, data: { id: "g1", views: ["editor", "terminal", "scope"], activeView: "scope" } }] },
    } as any,
  } as unknown as SerializedDockview);
  const next = reconcileLayouts(grid, edited);
  assert.deepStrictEqual([...layoutPanelOrder(next)].sort(), ["editor", "scope", "terminal"]);
  // webview's group (g2) vanished; the grid is still two groups: editor | terminal(+scope in active g3)
  const ids = JSON.stringify(next.grid.root);
  assert.ok(!ids.includes('"g2"'));
  assert.ok(ids.includes('"g1"') && ids.includes('"g3"'));
  const g3 = (next.grid.root as any).data.find((n: any) => n.data?.id === "g3");
  assert.deepStrictEqual(g3.data.views, ["terminal", "scope"]);
  assert.strictEqual(next.activeGroup, "g3");
  assert.strictEqual((next.grid.root as any).data.length, 2, "no one-child branch left behind");
});

test("reconcile removes a whole side and folds the lone branch", () => {
  const src = buildDeckLayout(grid);
  const onlyEditor = { ...src, panels: { editor: src.panels.editor, "status-bar": src.panels["status-bar"] } } as unknown as SerializedDockview;
  (onlyEditor.grid.root as any).data[0].data.views = ["editor"];
  const next = reconcileLayouts(grid, onlyEditor);
  assert.deepStrictEqual(layoutPanelOrder(next), ["editor"]);
  assert.strictEqual((next.grid.root as any).data.length, 1);
  assert.strictEqual((next.grid.root as any).data[0].type, "leaf");
});

test("reconcile into an empty grid builds a single group", () => {
  const empty = { grid: { orientation: "HORIZONTAL", width: 1, height: 1, root: { type: "branch", data: [] } }, panels: {} } as unknown as SerializedDockview;
  const next = reconcileLayouts(empty, buildDeckLayout(grid));
  assert.deepStrictEqual(layoutPanelOrder(next), ["editor", "webview", "terminal"]);
});

test("deck/reconcile outputs never carry a maximizedNode", () => {
  const g = JSON.parse(JSON.stringify(grid)) as SerializedDockview;
  (g.grid as unknown as { maximizedNode?: unknown }).maximizedNode = { location: [0] };
  const deck = buildDeckLayout(g);
  assert.equal((deck.grid as unknown as { maximizedNode?: unknown }).maximizedNode, undefined);
  const back = reconcileLayouts(g, deck);
  assert.equal((back.grid as unknown as { maximizedNode?: unknown }).maximizedNode, undefined);
});
