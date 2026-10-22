import { test } from "node:test";
import assert from "node:assert";
import { registerPanes, getPanes } from "./panes-registry.ts";
import { json3dInspectPanes } from "./panes/json-graph3d-inspect.panes.ts";

const item = (id: string) => ({ id, kind: "action" as const, icon: "x", label: id });

test("registry: exact, prefix (longest wins), miss, cap at 4", () => {
  registerPanes("zz", [item("a")]);
  registerPanes("zz-deep", [item("b")]);
  registerPanes("many", ["1", "2", "3", "4", "5", "6"].map(item));
  assert.equal(getPanes("zz")?.[0].id, "a");
  assert.equal(getPanes("zz-ab12")?.[0].id, "a");
  assert.equal(getPanes("zz-deep-ab12")?.[0].id, "b");
  assert.equal(getPanes("zzz"), undefined);
  assert.equal(getPanes("many")?.length, 4);
  registerPanes("empty", []);
  assert.equal(getPanes("empty"), undefined);
});

test("json-graph3d-inspect panes register and is valid", () => {
  assert.equal(getPanes("json-graph3d-inspect-1a2b")?.length, 4);
  assert.deepEqual(json3dInspectPanes.map((t) => t.id), ["look", "structure", "motion", "fit"]);
});
