import { test } from "node:test";
import assert from "node:assert";
import {
  DEFAULT_PRESET_ID,
  presets,
  resolvePresetPanelIds,
  resolvePresetPlacements,
  shouldSeedPresetDocument,
} from "./presets.ts";
import { isPanelSupported, panelRegistry } from "./default-layout.ts";

test("presets have unique ids", () => {
  const ids = presets.map((p) => p.id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(ids.length, uniqueIds.size);
});

test("minimal preset is removed and DEFAULT_PRESET_ID is blank, while founding panels stay in registry", () => {
  assert.strictEqual(DEFAULT_PRESET_ID, "blank");
  assert.strictEqual(presets.find((p) => p.id === "minimal"), undefined);
  const validIds = new Set(panelRegistry.map((p) => p.id));
  for (const id of ["editor", "terminal", "webview"]) {
    assert.ok(validIds.has(id), `${id} remains in panelRegistry`);
  }
});

test("all preset panelIds and layouts entries name real panelRegistry ids", () => {
  const validIds = new Set(panelRegistry.map((p) => p.id));
  for (const preset of presets) {
    for (const id of preset.panelIds) {
      assert.ok(
        validIds.has(id),
        `preset "${preset.id}" contains unknown panel id "${id}"`,
      );
    }
    for (const platform of ["desktop", "phone"] as const) {
      const layout = preset.layouts?.[platform];
      for (const step of layout === "tabs" ? [] : (layout ?? [])) {
        assert.ok(
          validIds.has(step.id),
          `preset "${preset.id}" ${platform} layout contains unknown panel id "${step.id}"`,
        );
        if (step.reference) {
          assert.ok(
            validIds.has(step.reference),
            `preset "${preset.id}" ${platform} layout references unknown panel id "${step.reference}"`,
          );
        }
      }
    }
  }
});

test("resolvePresetPanelIds resolves empty array to every registry id but the document for everything preset", () => {
  const allRegistryIds = panelRegistry.map((p) => p.id);
  const resolved = resolvePresetPanelIds("everything", allRegistryIds);
  // json-edit is the document: it lives in the left edge, never in a preset's grid.
  assert.deepStrictEqual(resolved, allRegistryIds.filter((id) => id !== "json-edit"));
});

test("no preset puts json-edit in its grid or platform layouts (the left edge always has it)", () => {
  const allRegistryIds = panelRegistry.map((p) => p.id);
  for (const preset of presets) {
    assert.ok(!preset.panelIds.includes("json-edit"), `preset "${preset.id}" lists json-edit`);
    assert.ok(
      !resolvePresetPanelIds(preset.id, allRegistryIds).includes("json-edit"),
      `preset "${preset.id}" resolves to a grid containing json-edit`,
    );
    for (const platform of ["desktop", "phone"] as const) {
      const steps = resolvePresetPlacements(preset.id, platform, allRegistryIds) ?? [];
      assert.ok(
        !steps.some((s) => s.id === "json-edit"),
        `preset "${preset.id}" ${platform} layout contains json-edit`,
      );
    }
  }
  assert.ok(!resolvePresetPanelIds("no-such-preset", allRegistryIds).includes("json-edit"));
});

test("json-lab and everything open the document edge and seed Berry Thief; the rest do not", () => {
  const open = presets.filter((p) => p.documentOpen).map((p) => p.id).sort();
  assert.deepStrictEqual(open, ["everything", "json-lab"]);
  const seeded = presets.filter((p) => shouldSeedPresetDocument(p.id)).map((p) => p.id).sort();
  assert.deepStrictEqual(seeded, ["everything", "json-lab"]);
});

test("phone layouts match preferred one-column arrangements", () => {
  assert.deepStrictEqual(resolvePresetPlacements("json-lab", "phone"), [
    { id: "text-viewer", direction: "right" },
    { id: "json-graph3d-inspect", reference: "text-viewer", direction: "below" },
  ]);
  assert.deepStrictEqual(resolvePresetPlacements("av-lab", "phone"), [
    { id: "tempo-clock", direction: "right", size: 140 },
    { id: "piano", reference: "tempo-clock", direction: "below" },
    { id: "scope", reference: "piano", direction: "below" },
  ]);
  assert.deepStrictEqual(resolvePresetPlacements("procedural-lab", "phone"), [
    { id: "procedural-visuals-control", direction: "right" },
    { id: "procedural-visuals-manifold", reference: "procedural-visuals-control", direction: "below" },
    { id: "procedural-visuals-balls", reference: "procedural-visuals-manifold", direction: "within" },
    { id: "procedural-visuals-fountain", reference: "procedural-visuals-manifold", direction: "within" },
    { id: "procedural-visuals-recursive", reference: "procedural-visuals-manifold", direction: "within" },
  ]);
  // "tabs": every panel of the preset, in registry order, in one group.
  const ids = panelRegistry.map((p) => p.id);
  const everythingPhone = resolvePresetPlacements("everything", "phone", ids) ?? [];
  assert.deepStrictEqual(everythingPhone.map((s) => s.id), resolvePresetPanelIds("everything", ids));
  assert.strictEqual(everythingPhone[0]?.direction, "right");
  assert.ok(everythingPhone.slice(1).every((s) => s.reference === everythingPhone[0].id && s.direction === "within"));
});

test("resolvePresetPanelIds falls back to DEFAULT_PRESET_ID (blank) for unknown preset id", () => {
  const allRegistryIds = panelRegistry.map((p) => p.id);
  const resolved = resolvePresetPanelIds("non-existent-preset", allRegistryIds);
  assert.deepStrictEqual(resolved, []);
  assert.strictEqual(resolvePresetPlacements("non-existent-preset", "desktop"), undefined);
});

test("isPanelSupported omits pty-requiring terminal on web and keeps it on desktop", () => {
  assert.strictEqual(isPanelSupported("terminal", true), false);
  assert.strictEqual(isPanelSupported("terminal", false), true);
  assert.strictEqual(isPanelSupported("editor", true), true);
  assert.strictEqual(isPanelSupported("webview", true), true);
});
