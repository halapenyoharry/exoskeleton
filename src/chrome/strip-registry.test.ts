import { test } from "node:test";
import assert from "node:assert";
import { registerStrip, getStrip } from "./strip-registry.ts";
import { spanToPlacement, normalizeSpan, spanToPixels, gridColumns } from "./grid-math.ts";
import { json3dInspectStrip } from "./strips/json-graph3d-inspect.strip.ts";

const item = (id: string) => ({ id, kind: "button" as const, icon: "x", label: id });

test("registry: exact, prefix (longest wins), miss, cap at 4", () => {
  registerStrip("zz", [item("a")]);
  registerStrip("zz-deep", [item("b")]);
  registerStrip("many", ["1", "2", "3", "4", "5", "6"].map(item));
  assert.equal(getStrip("zz")?.[0].id, "a");
  assert.equal(getStrip("zz-ab12")?.[0].id, "a");
  assert.equal(getStrip("zz-deep-ab12")?.[0].id, "b");
  assert.equal(getStrip("zzz"), undefined);
  assert.equal(getStrip("many")?.length, 4);
  registerStrip("empty", []);
  assert.equal(getStrip("empty"), undefined);
});

test("json-graph3d-inspect strip registers and is valid", () => {
  assert.equal(getStrip("json-graph3d-inspect-1a2b")?.length, 4);
  assert.deepEqual(json3dInspectStrip.map((t) => t.id), ["view", "style", "layout", "fit"]);
});

test("grid span -> css placement", () => {
  assert.deepEqual(spanToPlacement(undefined, 6), { gridColumn: "span 1", gridRow: "span 1" });
  assert.deepEqual(spanToPlacement([2, 1], 6), { gridColumn: "span 2", gridRow: "span 1" });
  assert.deepEqual(spanToPlacement([2, 2], 6), { gridColumn: "span 2", gridRow: "span 2" });
  assert.deepEqual(spanToPlacement([3, 1], 2), { gridColumn: "span 2", gridRow: "span 1" });
  assert.deepEqual(normalizeSpan([5, 5], 6), [1, 1]);
});

test("grid pixel + column math", () => {
  assert.deepEqual(spanToPixels([1, 1]), { width: 52, height: 52 });
  assert.deepEqual(spanToPixels([2, 1]), { width: 112, height: 52 });
  assert.deepEqual(spanToPixels([3, 1]), { width: 172, height: 52 });
  assert.equal(gridColumns("vertical", 900), 2);
  assert.equal(gridColumns("horizontal", 600), 10);
  assert.equal(gridColumns("horizontal", 100), 3);
});
