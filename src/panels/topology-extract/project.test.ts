import { test } from "node:test";
import assert from "node:assert";
import { projectRelations, type RelationDocument } from "./project.ts";
import { parseTopology } from "../json-dyadic/parse.ts";

const SOURCE = `Marta told her brother Tomas that the river would _flood_ the orchard.
##
By morning the river had carried two hives to the mill.`;

function fixture(): RelationDocument {
  return {
    metadata: { title: "fixture", source: "user-input" },
    nodes: [
      { id: "marta", kind: "node", label: "Marta" },
      { id: "tomas", kind: "node", label: "Tomas", attrs: { aliases: ["her brother"] } },
      { id: "river", kind: "node", label: "the river" },
      { id: "orchard", kind: "node", label: "the orchard" },
      { id: "hives", kind: "node", label: "the hives" },
      { id: "mill", kind: "node", label: "the mill" },
    ],
    relations: [
      {
        predicate: "sibling_of",
        category: "interactivity",
        mode: "asserted",
        directed: false,
        evidence: "her brother Tomas",
        participants: [
          { node: "marta", role: "sibling" },
          { node: "tomas", role: "sibling" },
        ],
      },
      {
        predicate: "warns",
        category: "interactivity",
        mode: "asserted",
        label: "Marta warns Tomas",
        evidence: "Marta told her brother Tomas that the river would flood the orchard.",
        participants: [
          { node: "marta", role: "speaker" },
          { node: "tomas", role: "addressee" },
          { node: "orchard", role: "topic" },
        ],
      },
      {
        predicate: "located_at",
        category: "containment",
        mode: "asserted",
        evidence: "two hives to the mill",
        participants: [
          { node: "hives", role: "contained" },
          { node: "mill", role: "container" },
        ],
      },
    ],
  };
}

test("two participants project to one dyadic link with roles, layer = predicate", () => {
  const doc = projectRelations(fixture(), SOURCE);
  const link = doc.links.find((l) => l.attrs?.["i2t:predicate"] === "sibling_of");
  assert.ok(link);
  assert.strictEqual(link.source, "marta");
  assert.strictEqual(link.target, "tomas");
  assert.strictEqual(link.directed, false);
  assert.strictEqual(link.layer, "sibling_of");
  assert.strictEqual(link.source_role, "sibling");
  assert.strictEqual(link.attrs?.["i2t:edge_category"], "interactivity");
});

test("three participants project to a category-prefixed hyperedge plus role spokes", () => {
  const doc = projectRelations(fixture(), SOURCE);
  const he = doc.nodes.find((n) => n.kind === "hyperedge");
  assert.ok(he);
  assert.ok(he.id.startsWith("i:"), he.id);
  assert.strictEqual(he.label, "Marta warns Tomas");
  const spokes = doc.links.filter((l) => l.source === he.id);
  assert.deepStrictEqual(
    spokes.map((s) => [s.target, s.role, s.layer]),
    [
      ["marta", "speaker", "warns"],
      ["tomas", "addressee", "warns"],
      ["orchard", "topic", "warns"],
    ],
  );
  assert.strictEqual(spokes[0].attrs, undefined);
});

test("containment is reordered container -> contained", () => {
  const doc = projectRelations(fixture(), SOURCE);
  const link = doc.links.find((l) => l.attrs?.["i2t:predicate"] === "located_at");
  assert.ok(link);
  assert.strictEqual(link.source, "mill");
  assert.strictEqual(link.target, "hives");
  assert.strictEqual(link.source_role, "container");
});

test("evidence is verified against the source, ignoring markdown emphasis", () => {
  const input = fixture();
  input.relations.push({
    predicate: "floods",
    category: "state_change",
    mode: "attributed",
    asserted_by: "marta",
    evidence: "the river will flood the orchard", // paraphrase, not verbatim
    participants: [
      { node: "river", role: "agent" },
      { node: "orchard", role: "flooded" },
    ],
  });
  const doc = projectRelations(input, SOURCE);
  const warns = doc.nodes.find((n) => n.kind === "hyperedge");
  assert.strictEqual(warns?.attrs?.["i2t:evidence_verified"], true);
  const floods = doc.links.find((l) => l.attrs?.["i2t:predicate"] === "floods");
  assert.strictEqual(floods?.attrs?.["i2t:evidence_verified"], false);
  assert.strictEqual(doc.metadata?.["i2t:evidence_unverified"], 1);
});

test("participants cited by label or alias resolve to the declared node", () => {
  const input = fixture();
  input.relations[0].participants = [
    { node: "Marta", role: "sibling" },
    { node: "her brother", role: "sibling" },
  ];
  const doc = projectRelations(input, SOURCE);
  const link = doc.links.find((l) => l.attrs?.["i2t:predicate"] === "sibling_of");
  assert.strictEqual(link?.source, "marta");
  assert.strictEqual(link?.target, "tomas");
  assert.strictEqual(doc.metadata?.["i2t:auto_created_nodes"], undefined);
});

test("short undeclared participants become flagged nodes; quotations are dropped", () => {
  const input = fixture();
  input.relations.push({
    predicate: "carries",
    category: "state_change",
    mode: "asserted",
    evidence: "By morning the river had carried two hives to the mill.",
    participants: [
      { node: "river", role: "carrier" },
      { node: "two hives", role: "moved" },
      { node: "By morning the river had carried two hives to the mill and beyond", role: "topic" },
    ],
  });
  const doc = projectRelations(input, SOURCE);
  const auto = doc.nodes.find((n) => n.id === "two-hives");
  assert.ok(auto);
  assert.strictEqual(auto.label, "two hives");
  assert.strictEqual(auto.attrs?.["i2t:auto_created"], true);
  assert.deepStrictEqual(doc.metadata?.["i2t:auto_created_nodes"], ["two-hives"]);
  const carries = doc.links.find((l) => l.attrs?.["i2t:predicate"] === "carries");
  assert.strictEqual(carries?.target, "two-hives");
  const warnings = doc.metadata?.["i2t:extraction_warnings"] as string[];
  assert.ok(warnings.some((w) => w.includes("dropped participant")));
});

test("repeated predicate on the same first participant gets distinct hyperedge ids", () => {
  const input = fixture();
  input.relations.push({ ...input.relations[1], evidence: "Marta told her brother Tomas" });
  const doc = projectRelations(input, SOURCE);
  const ids = doc.nodes.filter((n) => n.kind === "hyperedge").map((n) => n.id);
  assert.strictEqual(new Set(ids).size, 2, ids.join(","));
});

test("projection parses cleanly in the json-dyadic viewer", () => {
  const parsed = parseTopology(projectRelations(fixture(), SOURCE));
  assert.deepStrictEqual(parsed.warnings, []);
  assert.strictEqual(parsed.nodesById.size, 6);
  assert.strictEqual(parsed.reificationsById.size, 1);
  assert.strictEqual(parsed.layers.get("warns")?.primaryCategory, "interactivity");
  assert.strictEqual(parsed.layers.get("located_at")?.primaryCategory, "containment");
});
