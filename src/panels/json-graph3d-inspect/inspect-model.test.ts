import { test } from "node:test";
import assert from "node:assert";
import {
  containmentGroups,
  degreeMap,
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
