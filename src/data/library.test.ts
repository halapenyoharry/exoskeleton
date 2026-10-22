import { test } from "node:test";
import assert from "node:assert";
import { getJson, getJsonMeta, listJson } from "./json-bus.ts";
import { openLibraryDocument } from "./library.ts";
import { graphLibrary, type GraphLibraryEntry } from "../fixtures/graphs/index.ts";

// Node cannot import the fixture JSON without import attributes, so the
// test supplies its own entries with the real ids, titles, and shapes.
const entries: GraphLibraryEntry[] = graphLibrary.map((e) => ({
  ...e,
  load: async () => ({ fixture: e.id, shape: e.shape }),
}));

test("opening a library entry creates a titled library document", async () => {
  const entry = entries[0];
  const id = await openLibraryDocument(entry.id, { entries });
  assert.strictEqual(id, `library-${entry.id}`);
  const meta = getJsonMeta(id);
  assert.strictEqual(meta?.title, entry.title);
  assert.strictEqual(meta?.source, "library");
  assert.deepStrictEqual(getJson(id), { fixture: entry.id, shape: entry.shape });
});

test("opening the same entry twice does not duplicate the document", async () => {
  const entry = entries[1];
  const a = await openLibraryDocument(entry.id, { entries });
  const before = listJson().length;
  const b = await openLibraryDocument(entry.id, { entries });
  assert.strictEqual(a, b);
  assert.strictEqual(listJson().length, before);
});

test("unknown entry rejects", async () => {
  await assert.rejects(openLibraryDocument("nope", { entries }));
});
