import { test } from "node:test";
import assert from "node:assert";
import { isCompatible, CURRENT_VERSION } from "./storage.ts";

test("isCompatible should return false for null and undefined", () => {
  assert.strictEqual(isCompatible(null), false);
  assert.strictEqual(isCompatible(undefined), false);
});

test("isCompatible should return false for non-object types", () => {
  assert.strictEqual(isCompatible("string"), false);
  assert.strictEqual(isCompatible(123), false);
  assert.strictEqual(isCompatible(true), false);
  assert.strictEqual(isCompatible(Symbol("test")), false);
});

test("isCompatible should return false for objects missing the version property", () => {
  assert.strictEqual(isCompatible({}), false);
  assert.strictEqual(isCompatible({ layout: {} }), false);
});

test("isCompatible should return true for objects with CURRENT_VERSION", () => {
  assert.strictEqual(isCompatible({ version: CURRENT_VERSION }), true);
  assert.strictEqual(isCompatible({ version: CURRENT_VERSION, layout: {} }), true);
});

test("isCompatible should return false for objects with an incorrect version", () => {
  assert.strictEqual(isCompatible({ version: CURRENT_VERSION + 1 }), false);
  assert.strictEqual(isCompatible({ version: CURRENT_VERSION - 1 }), false);
  assert.strictEqual(isCompatible({ version: "1" }), false);
});
