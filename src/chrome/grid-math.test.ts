import { test } from "node:test";
import assert from "node:assert";
import { drawerColumns, gridColumns, normalizeSpan } from "./grid-math.ts";

test("vertical grid is 2-up narrow, 3-up wide", () => {
  assert.strictEqual(drawerColumns("vertical", 276), 2);
  assert.strictEqual(drawerColumns("vertical", 420), 3);
});
test("horizontal grid fits width with a floor of 3", () => {
  assert.strictEqual(gridColumns("horizontal", 100), 3);
  assert.strictEqual(gridColumns("horizontal", 600), 10);
});
test("spans clamp to columns", () => {
  assert.deepStrictEqual(normalizeSpan([3, 1], 2), [2, 1]);
});
