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

test("isCompatible should return true for any known schema version", () => {
  // Valid v8 (CURRENT_VERSION) state is accepted.
  const validV8 = {
    version: CURRENT_VERSION,
    activeWorkspaceId: "default",
    workspaces: {
      default: { id: "default", name: "Default", layout: {}, updatedAt: 1 },
    },
  };
  assert.strictEqual(isCompatible(validV8), true);
  // Older schema versions (1..7) are accepted too — migrateToV8 brings them
  // up to current on load. Version 1 and 7 must work.
  assert.strictEqual(isCompatible({ version: 7, layout: {} }), true);
  assert.strictEqual(isCompatible({ version: 1 }), true);
});

test("isCompatible should return false for unknown / future / wrong-type versions", () => {
  // Future versions (downgrade) are rejected.
  assert.strictEqual(isCompatible({ version: CURRENT_VERSION + 1 }), false);
  // Non-positive versions are rejected.
  assert.strictEqual(isCompatible({ version: 0 }), false);
  assert.strictEqual(isCompatible({ version: -1 }), false);
  // Non-number versions are rejected.
  assert.strictEqual(isCompatible({ version: "1" }), false);
});
