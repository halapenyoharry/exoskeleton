import { test } from "node:test";
import assert from "node:assert";
import { emitPanelMenu, onPanelMenu, registerPanelMenu, getPanelMenu } from "./panel-menu.ts";

test("emitPanelMenu reaches only the subscribed panel; unsubscribe works", () => {
  const got: string[] = [];
  const off = onPanelMenu("p1", (id) => got.push(`p1:${id}`));
  onPanelMenu("p2", (id) => got.push(`p2:${id}`));
  emitPanelMenu("p1", "a");
  off();
  emitPanelMenu("p1", "b");
  emitPanelMenu("p2", "c");
  assert.deepStrictEqual(got, ["p1:a", "p2:c"]);
});

test("getPanelMenu resolves exact ids and clone ids", () => {
  registerPanelMenu("json-edit", [{ id: "new", label: "New" }]);
  assert.strictEqual(getPanelMenu("json-edit")?.[0].id, "new");
  assert.strictEqual(getPanelMenu("json-edit-ab12")?.[0].id, "new");
  assert.strictEqual(getPanelMenu("json-tree"), undefined);
  assert.strictEqual(getPanelMenu("terminal"), undefined);
});
