import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildField,
  chooseNext,
  defaultRules,
  findEdge,
  heaviest,
  mulberry32,
  step,
  traverse,
  type Walker,
} from "./field.ts";
import type { DetectedGraph } from "../../data/json-utils/graphDetect.ts";

// A hub ("amy") connected to five leaves, plus a two-node island.
function hubGraph(): DetectedGraph {
  const nodes = ["amy", "club", "money", "dog", "text", "school", "bird", "plant"].map(
    (id) => ({ id, label: id }),
  );
  const links = [
    { source: "amy", target: "club" },
    { source: "amy", target: "money" },
    { source: "amy", target: "dog" },
    { source: "amy", target: "text" },
    { source: "amy", target: "school" },
    { source: "club", target: "money" },
    { source: "bird", target: "plant" },
  ];
  return { nodes, links };
}

test("mass is earned from connection: 1 + summed incident weight", () => {
  const f = buildField(hubGraph());
  assert.equal(f.byId.get("amy")!.mass, 6);
  assert.equal(f.byId.get("club")!.mass, 3);
  assert.equal(f.byId.get("bird")!.mass, 2);
  assert.equal(heaviest(f)!.id, "amy");
});

test("density is the clustering coefficient, fixed by topology", () => {
  const f = buildField(hubGraph());
  // amy has 5 neighbors; only club–money are linked: 1 of 10 pairs.
  assert.equal(f.byId.get("amy")!.density, 0.1);
  // club's neighbors are amy and money, which are linked: 1 of 1.
  assert.equal(f.byId.get("club")!.density, 1);
  assert.equal(f.byId.get("bird")!.density, 0);
});

test("parallel edges merge into one heavier edge; self-loops and unknown ids drop", () => {
  const f = buildField({
    nodes: [{ id: "a", label: "a" }, { id: "b", label: "b" }],
    links: [
      { source: "a", target: "b" },
      { source: "b", target: "a" },
      { source: "a", target: "a" },
      { source: "a", target: "ghost" },
    ],
  });
  assert.equal(f.edges.length, 1);
  assert.equal(f.edges[0].weight, 2);
  assert.equal(f.byId.get("a")!.mass, 3);
});

test("traversal adds weight along the edge it moved on, and only there", () => {
  const f = buildField(hubGraph());
  const w: Walker = { at: "club", mode: "walk", from: null };
  const before = f.byId.get("dog")!.mass;
  traverse(f, w, "amy", defaultRules);
  const e = f.edges[findEdge(f, "club", "amy")];
  assert.ok(Math.abs(e.weight - (1 + defaultRules.traverseGain)) < 1e-9);
  assert.equal(e.traversals, 1);
  assert.ok(f.byId.get("amy")!.mass > 6);
  assert.equal(f.byId.get("dog")!.mass, before);
  assert.equal(w.at, "amy");
  assert.equal(w.from, "club");
  assert.equal(f.byId.get("amy")!.visits, 1);
});

test("a jump with no edge moves attention without adding weight", () => {
  const f = buildField(hubGraph());
  const w: Walker = { at: "bird", mode: "walk", from: null };
  const amyBefore = f.byId.get("amy")!.mass;
  traverse(f, w, "amy", defaultRules);
  assert.equal(w.at, "amy");
  assert.equal(f.byId.get("amy")!.mass, amyBefore);
});

test("dwell strengthens every existing incident edge equally and does not move", () => {
  const f = buildField(hubGraph());
  const w: Walker = { at: "amy", mode: "dwell", from: null };
  const edgeCount = f.edges.length;
  for (let i = 0; i < 10; i++) step(f, w, defaultRules, mulberry32(1));
  assert.equal(w.at, "amy");
  assert.equal(f.byId.get("amy")!.dwelled, 10);
  assert.equal(f.edges.length, edgeCount, "dwell never creates an edge");
  const incident = f.incident.get("amy")!.map((i) => f.edges[i].weight);
  for (const wgt of incident) assert.ok(Math.abs(wgt - (1 + 10 * defaultRules.dwellGain)) < 1e-9);
  // The island was untouched.
  assert.equal(f.edges[findEdge(f, "bird", "plant")].weight, 1);
});

test("geodesic effect: from an unrelated start, attention lands on the heaviest node most often", () => {
  const rng = mulberry32(42);
  const landings = new Map<string, number>();
  for (let trial = 0; trial < 2000; trial++) {
    const f = buildField(hubGraph());
    const w: Walker = { at: null, mode: "walk", from: null };
    const next = chooseNext(f, w, { ...defaultRules, gravityBias: 1 }, rng);
    landings.set(next!, (landings.get(next!) ?? 0) + 1);
  }
  const amy = landings.get("amy") ?? 0;
  for (const [id, n] of landings) {
    if (id !== "amy") assert.ok(amy > n, `amy (${amy}) should beat ${id} (${n})`);
  }
});

test("with gravityBias 0 the walk is unbiased by mass", () => {
  const rng = mulberry32(7);
  const landings = new Map<string, number>();
  for (let trial = 0; trial < 4000; trial++) {
    const f = buildField(hubGraph());
    const w: Walker = { at: null, mode: "walk", from: null };
    const next = chooseNext(f, w, { ...defaultRules, gravityBias: 0 }, rng);
    landings.set(next!, (landings.get(next!) ?? 0) + 1);
  }
  const counts = [...landings.values()];
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  // 8 nodes × ~500 each; allow generous sampling noise.
  assert.ok(max - min < 150, `expected flat landing distribution, got ${counts.join(",")}`);
});

test("walking makes the hub heavier over time: traversal is plasticity", () => {
  const rng = mulberry32(3);
  const f = buildField(hubGraph());
  const w: Walker = { at: "dog", mode: "walk", from: null };
  const before = f.byId.get("amy")!.mass;
  for (let i = 0; i < 200; i++) step(f, w, defaultRules, rng);
  assert.ok(f.byId.get("amy")!.mass > before);
  assert.ok(f.byId.get("amy")!.visits > f.byId.get("bird")!.visits);
});

test("paused does nothing", () => {
  const f = buildField(hubGraph());
  const w: Walker = { at: "dog", mode: "paused", from: null };
  const snapshot = JSON.stringify(f.edges);
  step(f, w, defaultRules, mulberry32(1));
  assert.equal(w.at, "dog");
  assert.equal(JSON.stringify(f.edges), snapshot);
});
