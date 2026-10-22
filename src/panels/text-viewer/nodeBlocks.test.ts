import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildNodeBlocks } from "./nodeBlocks.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "graphs");
const load = (f: string) => JSON.parse(readFileSync(join(root, f), "utf8"));

for (const f of ["state-chain.json", "star-hub.json"]) {
  test(`buildNodeBlocks extracts nodes from ${f}`, () => {
    const doc = load(f);
    const blocks = buildNodeBlocks(doc);
    assert.ok(blocks.length > 0);
    assert.strictEqual(blocks.length, doc.nodes.length);
    for (const b of blocks) assert.ok(b.id && b.title);
  });
}

test("plain nodes surface fields as pills", () => {
  const b = buildNodeBlocks(load("star-hub.json"))[0];
  assert.ok("group" in b.allAttrs);
});

test("non-graph input yields no blocks", () => {
  assert.deepStrictEqual(buildNodeBlocks({ a: 1 }), []);
  assert.deepStrictEqual(buildNodeBlocks(null), []);
});
