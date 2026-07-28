import { test } from "node:test";
import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseTopology } from "./parse.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_FIXTURE_PATH = join(__dirname, "__fixtures__", "synthetic-topology.json");

function loadTopologyDoc(): { doc: unknown; isOverride: boolean } {
  const overrideDir = process.env.EXO_TOPOLOGY_DIR;
  if (overrideDir) {
    try {
      const entries = readdirSync(overrideDir);
      const candidate =
        entries.find((f) => f.includes("audit") && f.endsWith(".normalized-dyadic.json")) ??
        entries.find((f) => f.endsWith(".normalized-dyadic.json") && !f.includes("target"));
      if (candidate) {
        return {
          doc: JSON.parse(readFileSync(join(overrideDir, candidate), "utf8")),
          isOverride: true,
        };
      }
    } catch {
      // Fallback to synthetic fixture
    }
  }
  return {
    doc: JSON.parse(readFileSync(DEFAULT_FIXTURE_PATH, "utf8")),
    isOverride: false,
  };
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

test("parseTopology against a topology file (synthetic fixture or EXO_TOPOLOGY_DIR override)", () => {
  const { doc, isOverride } = loadTopologyDoc();
  assert.ok(doc, "expected a loaded topology document");
  const result = parseTopology(doc);

  // Structural assertions — shape must always hold.
  assert.ok(result.nodesById.size > 0, "expected real nodes");
  assert.ok(
    result.reificationsById.size > 0,
    "expected at least one c: reification",
  );

  // Disjoint maps — a c: id must never appear as a real node
  for (const id of result.reificationsById.keys()) {
    assert.ok(
      !result.nodesById.has(id),
      `reification ${id} must NOT appear in nodesById`,
    );
  }

  // Every reification carries a primary edge_category
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

  // In override mode, warnings should be empty. For synthetic fixture, malformed/dangling warnings are expected.
  if (isOverride) {
    assert.deepStrictEqual(
      result.warnings,
      [],
      `parser warnings on the real file: ${result.warnings.join("; ")}`,
    );
  } else {
    // Confirm three-member hyperedge reification is present
    const triadLayer = result.layers.get("triad_layer");
    const threeMember = triadLayer?.reifications.find((r) => r.relation.id === "c:rel-three-member");
    assert.ok(threeMember, "expected three-member hyperedge reification");
    assert.strictEqual(threeMember.spokes.length, 3, "expected 3 spokes for three-member hyperedge");

    // Confirm all 4 canonical edge categories are represented in layers
    const categories = new Set(Array.from(result.layers.values()).map((l) => l.primaryCategory));
    assert.ok(categories.has("containment"), "missing containment layer");
    assert.ok(categories.has("state_change"), "missing state_change layer");
    assert.ok(categories.has("interactivity"), "missing interactivity layer");
    assert.ok(categories.has("reference"), "missing reference layer");
  }
});
