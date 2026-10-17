import { test } from "node:test";
import assert from "node:assert";
import {
  containmentGroups,
  degreeMap,
  isRelationRow,
  linkColor,
  linkInlineText,
  nodeColor,
  resolveLinkCategory,
  slug,
} from "./inspect-model.ts";
import type { DetectedGraph, GraphNode } from "../../data/json-utils/graphDetect.ts";
import { CATEGORY_TOKENS } from "../json-dyadic/categories.ts";

const graph: DetectedGraph = {
  nodes: [
    { id: "a", label: "Alpha", kind: "node", attrs: { "i2t:kind": "bus" } },
    { id: "b", label: "Beta", kind: "node" },
    { id: "c", label: "Gamma", kind: "node" },
    {
      id: "c:box",
      label: "contains",
      kind: "hyperedge",
      attrs: { "i2t:predicate": "contains", "i2t:edge_category": "containment" },
    },
    {
      id: "i:pair",
      label: "plays_over",
      kind: "hyperedge",
      attrs: { "i2t:predicate": "plays_over", "i2t:edge_category": "interactivity" },
    },
  ],
  links: [
    { source: "c:box", target: "a", role: "container", layer: "membranes" },
    { source: "c:box", target: "b", role: "member", layer: "membranes" },
    { source: "i:pair", target: "b", role: "peer", layer: "couplings" },
    { source: "i:pair", target: "c", role: "peer", layer: "couplings" },
    {
      source: "a",
      target: "c",
      label: "refers_to",
      layer: "pointers",
      attrs: { "i2t:edge_category": "reference", "i2t:predicate": "refers_to" },
    },
  ],
};
const byId = new Map<string, GraphNode>(graph.nodes.map((n) => [n.id, n]));

test("slug keeps short labels whole", () => {
  assert.strictEqual(slug("OSC bus", 5), "OSC bus");
});

test("slug cuts to maxWords and marks the cut", () => {
  assert.strictEqual(slug("one two three four five six seven", 5), "one two three four five…");
});

test("slug collapses whitespace", () => {
  assert.strictEqual(slug("  a   b  ", 5), "a b");
});

test("resolveLinkCategory reads the link's own attrs first", () => {
  assert.strictEqual(resolveLinkCategory(graph.links[4], byId), "reference");
});

test("resolveLinkCategory falls back to the hyperedge at either endpoint", () => {
  assert.strictEqual(resolveLinkCategory(graph.links[0], byId), "containment");
  assert.strictEqual(
    resolveLinkCategory({ source: "b", target: "i:pair", role: "peer" }, byId),
    "interactivity",
  );
});

test("resolveLinkCategory is undefined for untyped links", () => {
  assert.strictEqual(resolveLinkCategory({ source: "a", target: "b" }, byId), undefined);
});

test("linkInlineText prefers role (spoke) over label (predicate)", () => {
  assert.strictEqual(linkInlineText({ source: "x", target: "y", role: "member", label: "contains" }), "member");
  assert.strictEqual(linkInlineText({ source: "x", target: "y", label: "refers_to" }), "refers_to");
  assert.strictEqual(linkInlineText({ source: "x", target: "y" }), "");
});

test("degreeMap counts every endpoint including spokes", () => {
  const d = degreeMap(graph);
  assert.strictEqual(d.get("a"), 2);
  assert.strictEqual(d.get("b"), 2);
  assert.strictEqual(d.get("c:box"), 2);
  assert.strictEqual(d.get("c"), 2);
});

test("containmentGroups groups participants per containment hyperedge and names the container", () => {
  const groups = containmentGroups(graph, byId);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].relationId, "c:box");
  assert.deepStrictEqual([...groups[0].participantIds].sort(), ["a", "b"]);
  assert.strictEqual(groups[0].containerId, "a");
});

test("containmentGroups ignores interactivity hyperedges", () => {
  assert.strictEqual(containmentGroups(graph, byId).some((g) => g.relationId === "i:pair"), false);
});

test("nodeColor overrides go id > kind > attrs.color > fallback", () => {
  assert.strictEqual(nodeColor(graph.nodes[0], { "node:a": "#111" }, "#fff"), "#111");
  assert.strictEqual(nodeColor(graph.nodes[0], { "kind:bus": "#222" }, "#fff"), "#222");
  assert.strictEqual(nodeColor(graph.nodes[1], {}, "#fff"), "#fff");
});

test("hyperedge nodes take their category color", () => {
  assert.strictEqual(nodeColor(graph.nodes[3], {}, "#fff"), CATEGORY_TOKENS.containment.color);
});

test("linkColor honors overrides then the chosen scheme", () => {
  const l = graph.links[4];
  assert.strictEqual(linkColor(l, "reference", "category", {}), CATEGORY_TOKENS.reference.color);
  assert.strictEqual(linkColor(l, "reference", "category", { "predicate:refers_to": "#abc" }), "#abc");
  assert.strictEqual(linkColor(l, "reference", "layer", { "layer:pointers": "#def" }), "#def");
});

// --- reified arity-2 edge (kind "edge-as-node") -------------------------
// i2t spec S4: an edge whose id is also a node id, because another edge
// points at it. The adapter merges the edge's attrs onto the row.
const reified: DetectedGraph = {
  nodes: [
    { id: "x", label: "X", kind: "node" },
    { id: "y", label: "Y", kind: "node" },
    { id: "src", label: "Source", kind: "node" },
    {
      id: "edge:x-builds-y",
      label: "x-builds-y (reified)",
      kind: "edge-as-node",
      attrs: {
        "schema:name": "x-builds-y (reified)",
        "i2t:reified": true,
        "i2t:predicate": "builds",
        "i2t:edge_category": "state_change",
      },
    },
  ],
  links: [
    { source: "x", target: "edge:x-builds-y", role: "source", layer: "builds" },
    { source: "edge:x-builds-y", target: "y", role: "target", layer: "builds" },
    {
      source: "src",
      target: "edge:x-builds-y",
      label: "grounds",
      layer: "grounds",
      attrs: { "i2t:predicate": "grounds", "i2t:edge_category": "reference" },
    },
  ],
};
const reifiedById = new Map<string, GraphNode>(reified.nodes.map((n) => [n.id, n]));

test("isRelationRow covers hyperedge and edge-as-node, not entities", () => {
  assert.strictEqual(isRelationRow("hyperedge"), true);
  assert.strictEqual(isRelationRow("edge-as-node"), true);
  assert.strictEqual(isRelationRow("node"), false);
  assert.strictEqual(isRelationRow(undefined), false);
});

test("incidence links of an edge-as-node inherit its category from either endpoint", () => {
  assert.strictEqual(resolveLinkCategory(reified.links[0], reifiedById), "state_change");
  assert.strictEqual(resolveLinkCategory(reified.links[1], reifiedById), "state_change");
});

test("a link that points at an edge-as-node keeps its own category", () => {
  assert.strictEqual(resolveLinkCategory(reified.links[2], reifiedById), "reference");
});

test("an edge-as-node takes its category color like a hyperedge row", () => {
  assert.strictEqual(nodeColor(reified.nodes[3], {}, "#fff"), CATEGORY_TOKENS.state_change.color);
});
