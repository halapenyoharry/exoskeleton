import { test } from "node:test";
import assert from "node:assert";
import {
  deleteJson,
  getJson,
  getJsonMeta,
  hydrateJson,
  listJson,
  onJsonChange,
  onJsonListChange,
  onJsonStore,
  setJson,
  uniqueJsonId,
  updateJsonMeta,
  type StoreEvent,
} from "./json-bus.ts";

// The bus is module state shared by every test in this file, so each test
// uses its own ids.

test("setJson records a title, source, and timestamps; listJson returns it", () => {
  setJson("lib-a", { a: 1 }, { title: "Doc A", source: "test" });
  const meta = getJsonMeta("lib-a");
  assert.strictEqual(meta?.title, "Doc A");
  assert.strictEqual(meta?.source, "test");
  assert.ok(meta?.createdAt && meta.updatedAt);
  assert.ok(listJson().some((d) => d.id === "lib-a"));
});

test("a later setJson keeps the title and createdAt", () => {
  setJson("lib-b", 1, { title: "Doc B" });
  const created = getJsonMeta("lib-b")?.createdAt;
  setJson("lib-b", 2);
  assert.strictEqual(getJsonMeta("lib-b")?.title, "Doc B");
  assert.strictEqual(getJsonMeta("lib-b")?.createdAt, created);
  assert.strictEqual(getJson("lib-b"), 2);
});

test("list listeners fire on add, retitle, and delete, not on value-only updates", () => {
  let calls = 0;
  const off = onJsonListChange(() => calls++);
  setJson("lib-c", 1);
  assert.strictEqual(calls, 1);
  setJson("lib-c", 2);
  assert.strictEqual(calls, 1);
  updateJsonMeta("lib-c", { title: "C" });
  assert.strictEqual(calls, 2);
  assert.strictEqual(deleteJson("lib-c"), true);
  assert.strictEqual(calls, 3);
  assert.strictEqual(getJson("lib-c"), undefined);
  assert.strictEqual(deleteJson("lib-c"), false);
  off();
});

test("uniqueJsonId slugs the base and avoids existing ids", () => {
  setJson("notes", {});
  assert.strictEqual(uniqueJsonId("Notes.json"), "notes-2");
  assert.strictEqual(uniqueJsonId("Prometheus Bound!"), "prometheus-bound");
  assert.strictEqual(uniqueJsonId("   "), "doc");
});

test("store listeners see sets and deletes; hydrate does not echo or overwrite", () => {
  const events: StoreEvent[] = [];
  const off = onJsonStore((e) => events.push(e));
  setJson("lib-d", { live: true });
  deleteJson("lib-d");
  assert.deepStrictEqual(events.map((e) => [e.type, e.id]), [["set", "lib-d"], ["delete", "lib-d"]]);

  setJson("lib-e", { live: true });
  events.length = 0;
  const seen: unknown[] = [];
  const offE = onJsonChange("lib-f", (v) => seen.push(v));
  const meta = { title: "stored", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
  hydrateJson([
    { id: "lib-e", value: { stored: true }, meta },
    { id: "lib-f", value: { stored: true }, meta },
  ]);
  assert.deepStrictEqual(getJson("lib-e"), { live: true }, "live document wins");
  assert.deepStrictEqual(getJson("lib-f"), { stored: true });
  assert.deepStrictEqual(seen, [{ stored: true }], "subscribers see hydrated documents");
  assert.strictEqual(events.length, 0, "hydration is not written back");
  off();
  offE();
});
