import { test } from "node:test";
import assert from "node:assert";
import { panelsToAutoAdd, type RegistryEntry } from "./default-layout.ts";

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
