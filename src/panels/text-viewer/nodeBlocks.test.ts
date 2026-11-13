import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildNodeBlocks,
  shouldFollowNodeBroadcast,
  shouldScrollOnBroadcast,
} from "./nodeBlocks.ts";
import { getPanes } from "../../chrome/panes-registry.ts";
import { textViewerPanes } from "../../chrome/panes/text-viewer.panes.ts";

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

test("when scrollOnHover is true (default), both selection (hover) and focus (click) scroll", () => {
  assert.strictEqual(shouldFollowNodeBroadcast("selection", true), true);
  assert.strictEqual(shouldFollowNodeBroadcast("focus", true), true);
  assert.strictEqual(shouldScrollOnBroadcast("selection", "n1", true), true);
  assert.strictEqual(shouldScrollOnBroadcast("focus", "n1", true), true);
  assert.strictEqual(shouldScrollOnBroadcast("selection", null, true), false);
});

test("when scrollOnHover is false (click only), selection (hover) is ignored and focus (click) scrolls", () => {
  assert.strictEqual(shouldFollowNodeBroadcast("selection", false), false);
  assert.strictEqual(shouldFollowNodeBroadcast("focus", false), true);
  assert.strictEqual(shouldScrollOnBroadcast("selection", "n1", false), false);
  assert.strictEqual(shouldScrollOnBroadcast("selection", null, false), false);
  assert.strictEqual(shouldScrollOnBroadcast("focus", "n1", false), true);
  assert.strictEqual(shouldScrollOnBroadcast("focus", null, false), false);
});

test("text-viewer controls pane registers scroll on hover toggle", () => {
  const panes = getPanes("text-viewer");
  assert.deepStrictEqual(panes, textViewerPanes);
  assert.strictEqual(panes?.[0]?.id, "scroll");
  const cell = panes?.[0]?.body?.cells[0];
  assert.strictEqual(cell?.type, "toggle");
  assert.strictEqual(cell?.param, "scrollOnHover");
  assert.strictEqual(cell?.label, "scroll on hover");
});

