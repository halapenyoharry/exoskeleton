import { test } from "node:test";
import assert from "node:assert";
import { publishOptions, getOptions, onOptions } from "./runtime-options.ts";

test("runtime-options: publish, get, subscribe, unsubscribe", () => {
  assert.deepEqual(getOptions("p1", "layers"), []);
  const seen: string[][] = [];
  const off = onOptions("p1", "layers", (o) => seen.push(o.map((x) => x.value)));
  publishOptions("p1", "layers", [{ value: "a", label: "A" }, { value: "b", label: "B" }]);
  publishOptions("p2", "layers", [{ value: "z", label: "Z" }]);
  assert.deepEqual(seen, [["a", "b"]]);
  assert.equal(getOptions("p1", "layers").length, 2);
  assert.equal(getOptions("p2", "layers")[0].value, "z");
  off();
  publishOptions("p1", "layers", []);
  assert.equal(seen.length, 1);
  assert.deepEqual(getOptions("p1", "layers"), []);
});
