import { test } from "node:test";
import assert from "node:assert";
import {
  DEFAULT_PRESET_ID,
  presets,
  resolvePresetPanelIds,
} from "./presets.ts";
import { panelRegistry } from "./default-layout.ts";

test("presets have unique ids", () => {
  const ids = presets.map((p) => p.id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(ids.length, uniqueIds.size);
});

test("all preset panelIds entries name real panelRegistry ids", () => {
  const validIds = new Set(panelRegistry.map((p) => p.id));
  for (const preset of presets) {
    for (const id of preset.panelIds) {
      assert.ok(
        validIds.has(id),
        `preset "${preset.id}" contains unknown panel id "${id}"`,
      );
    }
  }
});

test("minimal preset contains exactly editor, terminal, webview", () => {
  const minimal = presets.find((p) => p.id === "minimal");
  assert.ok(minimal, "minimal preset should exist");
  assert.deepStrictEqual(minimal.panelIds, ["editor", "terminal", "webview"]);
});

test("resolvePresetPanelIds resolves empty array to every registry id but the document for everything preset", () => {
  const allRegistryIds = panelRegistry.map((p) => p.id);
  const resolved = resolvePresetPanelIds("everything", allRegistryIds);
  // json-edit is the document: it lives in the left edge, never in a preset's grid.
  assert.deepStrictEqual(resolved, allRegistryIds.filter((id) => id !== "json-edit"));
});

test("no preset puts json-edit in its grid (the left edge always has it)", () => {
  const allRegistryIds = panelRegistry.map((p) => p.id);
  for (const preset of presets) {
    assert.ok(!preset.panelIds.includes("json-edit"), `preset "${preset.id}" lists json-edit`);
    assert.ok(
      !resolvePresetPanelIds(preset.id, allRegistryIds).includes("json-edit"),
      `preset "${preset.id}" resolves to a grid containing json-edit`,
    );
  }
  assert.ok(!resolvePresetPanelIds("no-such-preset", allRegistryIds).includes("json-edit"));
});

test("json-lab and everything open the document edge; the rest start collapsed", () => {
  const open = presets.filter((p) => p.documentOpen).map((p) => p.id).sort();
  assert.deepStrictEqual(open, ["everything", "json-lab"]);
});

test("resolvePresetPanelIds resolves specific panelIds for minimal preset", () => {
  const allRegistryIds = panelRegistry.map((p) => p.id);
  const resolved = resolvePresetPanelIds("minimal", allRegistryIds);
  assert.deepStrictEqual(resolved, ["editor", "terminal", "webview"]);
});

test("resolvePresetPanelIds falls back to DEFAULT_PRESET_ID for unknown preset id", () => {
  const allRegistryIds = panelRegistry.map((p) => p.id);
  const resolved = resolvePresetPanelIds("non-existent-preset", allRegistryIds);
  const defaultPreset = presets.find((p) => p.id === DEFAULT_PRESET_ID);
  assert.deepStrictEqual(resolved, defaultPreset?.panelIds);
});
