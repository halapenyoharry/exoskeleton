import { test } from "node:test";
import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { parseTopology } from "./parse.ts";

// Run parseTopology against the real speak topology JSON so the indices
// it builds are checked against a known-good source rather than a
// synthetic fixture. If the file isn't present (e.g. running on a fresh
// clone without speak/, or the file's been renamed), the test is skipped
// instead of failing — the schema lives in two repos and we don't want
// one to break the other.

const SPEAK_DIR = "/Users/harold/Projects/speak/topology";

function loadSpeakOrSkip(): unknown | null {
  try {
    const entries = readdirSync(SPEAK_DIR);
    // Prefer the original audit file; fall back to any *.normalized-dyadic.json
    // that isn't a target/baseline.
    const candidate =
      entries.find((f) => f.includes("audit") && f.endsWith(".normalized-dyadic.json")) ??
      entries.find((f) => f.endsWith(".normalized-dyadic.json") && !f.includes("target"));
    if (!candidate) return null;
    return JSON.parse(readFileSync(`${SPEAK_DIR}/${candidate}`, "utf8"));
  } catch {
    return null;
  }
}

test("parseTopology rejects non-object input", () => {
  const result = parseTopology("not an object");
  assert.deepStrictEqual([...result.nodesById.keys()], []);
  assert.deepStrictEqual([...result.reificationsById.keys()], []);
  assert.ok(result.warnings.length > 0);
});

test("parseTopology rejects missing nodes/links arrays", () => {
  const result = parseTopology({ nodes: [] });
  assert.ok(result.warnings.some((w) => w.includes("links")));
});

test("parseTopology splits nodes from c: reifications by kind tag", () => {
  const result = parseTopology({
    nodes: [
      { id: "engine:a", kind: "node", attrs: { label: "A" } },
      {
        id: "c:rel-1",
        kind: "hyperedge",
        attrs: {
          "i2t:predicate": "contains",
          "i2t:edge_category": "containment",
        },
      },
    ],
    links: [
      { source: "c:rel-1", target: "engine:a", layer: "contains", role: "contained" },
    ],
  });
  assert.strictEqual(result.nodesById.size, 1);
  assert.strictEqual(result.reificationsById.size, 1);
  assert.ok(result.nodesById.has("engine:a"));
  assert.ok(result.reificationsById.has("c:rel-1"));
  assert.ok(!result.nodesById.has("c:rel-1"));
});

test("parseTopology assigns category from reification when layer has one", () => {
  const result = parseTopology({
    nodes: [
      { id: "x", kind: "node" },
      {
        id: "c:r",
        kind: "hyperedge",
        attrs: { "i2t:edge_category": "state_change" },
      },
    ],
    links: [{ source: "c:r", target: "x", layer: "L" }],
  });
  const layer = result.layers.get("L");
  assert.ok(layer);
  assert.strictEqual(layer.primaryCategory, "state_change");
  assert.strictEqual(layer.reifications.length, 1);
  assert.strictEqual(layer.reifications[0].spokes.length, 1);
});

test("parseTopology takes mode of categories from dyadic links when no reification", () => {
  const result = parseTopology({
    nodes: [
      { id: "a", kind: "node" },
      { id: "b", kind: "node" },
      { id: "c", kind: "node" },
    ],
    links: [
      {
        source: "a",
        target: "b",
        layer: "L",
        attrs: { "i2t:edge_category": "interactivity" },
      },
      {
        source: "b",
        target: "c",
        layer: "L",
        attrs: { "i2t:edge_category": "interactivity" },
      },
      {
        source: "a",
        target: "c",
        layer: "L",
        attrs: { "i2t:edge_category": "reference" },
      },
    ],
  });
  assert.strictEqual(result.layers.get("L")?.primaryCategory, "interactivity");
});

test("parseTopology against a real speak topology file", (t) => {
  const doc = loadSpeakOrSkip();
  if (!doc) {
    t.skip("speak topology file not present at expected path");
    return;
  }
  const result = parseTopology(doc);

  // Structural assertions — the exact counts drift as Harold edits the
  // source file, but the shape must always hold.

  // Some nodes, some reifications, both > 0.
  assert.ok(result.nodesById.size > 0, "expected real nodes");
  assert.ok(
    result.reificationsById.size > 0,
    "expected at least one c: reification (file is a dyadic projection)",
  );

  // Disjoint maps — a c: id must never appear as a real node, otherwise
  // the renderer could draw it as a tile.
  for (const id of result.reificationsById.keys()) {
    assert.ok(
      !result.nodesById.has(id),
      `reification ${id} must NOT appear in nodesById`,
    );
  }

  // Every reification carries a primary edge_category — this is the
  // primary visual switch the panel reads, so an absent category would
  // mean the renderer falls back to "reference" (low-weight) silently.
  for (const [id, rel] of result.reificationsById) {
    assert.ok(
      rel.attrs?.["i2t:edge_category"],
      `reification ${id} missing i2t:edge_category`,
    );
  }

  // At least one layer present, and every layer has a category.
  assert.ok(result.layers.size > 0, "expected layers");
  for (const [name, layer] of result.layers) {
    assert.ok(
      ["containment", "state_change", "interactivity", "reference"].includes(
        layer.primaryCategory,
      ),
      `layer "${name}" got non-canonical category ${layer.primaryCategory}`,
    );
  }

  // No warnings (in the well-formed file case). If this fires, the file
  // has structural surprises worth investigating before shipping.
  assert.deepStrictEqual(
    result.warnings,
    [],
    `parser warnings on the real file: ${result.warnings.join("; ")}`,
  );
});
