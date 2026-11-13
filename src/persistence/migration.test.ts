import { test } from "node:test";
import assert from "node:assert";
import type { SerializedDockview } from "dockview-react";
import { migrateSavedLayout, panelsToAutoAdd, type RegistryEntry } from "./default-layout.ts";
import { layoutPanelOrder } from "./deck.ts";

const mockRegistry: RegistryEntry[] = [
  { id: "editor", component: "editor", introducedAt: 1 },
  { id: "terminal", component: "terminal", introducedAt: 1 },
  { id: "panel-v5-no-auto", component: "v5-no-auto", introducedAt: 5 },
  { id: "panel-v5-auto", component: "v5-auto", introducedAt: 5, autoAdd: true },
  { id: "panel-v6-no-auto", component: "v6-no-auto", introducedAt: 6, autoAdd: false },
  { id: "panel-v6-auto", component: "v6-auto", introducedAt: 6, autoAdd: true },
];

test("panelsToAutoAdd excludes version-newer entry without autoAdd flag", () => {
  const result = panelsToAutoAdd(4, mockRegistry);
  const ids = result.map((e) => e.id);
  assert.ok(!ids.includes("panel-v5-no-auto"));
  assert.ok(!ids.includes("panel-v6-no-auto"));
});

test("panelsToAutoAdd includes version-newer entry with autoAdd === true", () => {
  const result = panelsToAutoAdd(4, mockRegistry);
  const ids = result.map((e) => e.id);
  assert.deepStrictEqual(ids, ["panel-v5-auto", "panel-v6-auto"]);
});

test("panelsToAutoAdd excludes entries at or below savedVersion even if autoAdd === true", () => {
  const result = panelsToAutoAdd(5, mockRegistry);
  const ids = result.map((e) => e.id);
  assert.deepStrictEqual(ids, ["panel-v6-auto"]);
  assert.ok(!ids.includes("panel-v5-auto"));
});

test("panelsToAutoAdd returns empty array for current-version or newer save", () => {
  const result = panelsToAutoAdd(7, mockRegistry);
  assert.deepStrictEqual(result, []);
});

test("migrateSavedLayout drops panels whose component no longer exists and prunes empty groups", () => {
  const removedComp = ["tl", "draw"].join("");
  const cloneId = `${removedComp}-x9a1`;
  const saved = {
    grid: {
      orientation: "HORIZONTAL",
      width: 1200,
      height: 800,
      root: {
        type: "branch",
        size: 800,
        data: [
          {
            type: "leaf",
            size: 600,
            data: {
              id: "g1",
              views: ["json-tree", removedComp, "json-cosmos"],
              activeView: removedComp,
            },
          },
          {
            type: "leaf",
            size: 600,
            data: {
              id: "g2",
              views: [cloneId],
              activeView: cloneId,
            },
          },
        ],
      },
    },
    panels: {
      "json-tree": { id: "json-tree", contentComponent: "json-tree", title: "tree" },
      [removedComp]: { id: removedComp, contentComponent: removedComp, title: removedComp },
      "json-cosmos": { id: "json-cosmos", contentComponent: "json-cosmos", title: "cosmos" },
      [cloneId]: { id: cloneId, contentComponent: removedComp, title: removedComp },
    },
    activeGroup: "g2",
  } as unknown as SerializedDockview;

  const restored = migrateSavedLayout(saved, 11);
  assert.deepStrictEqual(layoutPanelOrder(restored), ["json-tree", "json-cosmos"]);
  assert.strictEqual(restored.panels[removedComp], undefined);
  assert.strictEqual(restored.panels[cloneId], undefined);
  assert.strictEqual(restored.activeGroup, "g1");
  const leaves = (
    restored.grid.root as unknown as {
      data: { data: { id: string; views: string[]; activeView: string } }[];
    }
  ).data;
  assert.strictEqual(leaves.length, 1);
  assert.deepStrictEqual(leaves[0].data.views, ["json-tree", "json-cosmos"]);
  assert.strictEqual(leaves[0].data.activeView, "json-tree");
});
