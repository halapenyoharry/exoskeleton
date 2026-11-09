import { test } from "node:test";
import assert from "node:assert";
import type { DetectedGraph } from "../../data/json-utils/graphDetect.ts";
import { colorForLayer } from "../../data/json-utils/layers.ts";
import { toCosmos } from "./toCosmos.ts";

function parseExpectedHex(hex: string): [number, number, number] {
  const clean = hex.slice(1);
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return [
    Math.fround(parseInt(full.slice(0, 2), 16) / 255),
    Math.fround(parseInt(full.slice(2, 4), 16) / 255),
    Math.fround(parseInt(full.slice(4, 6), 16) / 255),
  ];
}

test("toCosmos: index mapping and link pairs", () => {
  const graph: DetectedGraph = {
    nodes: [
      { id: "alpha", label: "Alpha" },
      { id: "beta", label: "Beta" },
      { id: "gamma", label: "Gamma" },
    ],
    links: [
      { source: "alpha", target: "gamma", layer: "causal" },
      { source: "gamma", target: "beta" },
    ],
  };

  const out = toCosmos(graph);

  assert.deepEqual(out.ids, ["alpha", "beta", "gamma"]);
  assert.equal(out.indexById.get("alpha"), 0);
  assert.equal(out.indexById.get("beta"), 1);
  assert.equal(out.indexById.get("gamma"), 2);
  assert.equal(out.droppedLinks, 0);
  assert.deepEqual(Array.from(out.links), [0, 2, 2, 1]);

  const [cr, cg, cb] = parseExpectedHex(colorForLayer("causal"));
  const [dr, dg, db] = parseExpectedHex(colorForLayer(undefined));
  assert.deepEqual(Array.from(out.linkColors), [
    cr,
    cg,
    cb,
    Math.fround(0.35),
    dr,
    dg,
    db,
    Math.fround(0.35),
  ]);
});

test("toCosmos: drops dangling links and counts how many were dropped", () => {
  const graph: DetectedGraph = {
    nodes: [
      { id: "n0", label: "N0" },
      { id: "n1", label: "N1" },
    ],
    links: [
      { source: "n0", target: "n1" },
      { source: "missing-src", target: "n1" },
      { source: "n0", target: "missing-tgt" },
      { source: "ghost-a", target: "ghost-b" },
      { source: "n1", target: "n0" },
    ],
  };

  const out = toCosmos(graph);

  assert.equal(out.droppedLinks, 3);
  assert.deepEqual(Array.from(out.links), [0, 1, 1, 0]);
  assert.equal(out.linkColors.length, 8);
});

test("toCosmos: hex color parsing (#rgb, #rrggbb) and fallback to colorForLayer", () => {
  const graph: DetectedGraph = {
    nodes: [
      { id: "short", label: "Short", color: "#f0a" },
      { id: "long", label: "Long", color: "#12Abef" },
      { id: "typed", label: "Typed", type: "concept", color: "not-a-hex" },
      { id: "kindOnly", label: "KindOnly", kind: "hyperedge", color: "#12345" },
      { id: "plain", label: "Plain" },
    ],
    links: [],
  };

  const out = toCosmos(graph);

  const [sr, sg, sb] = parseExpectedHex("#f0a");
  assert.deepEqual(Array.from(out.pointColors.slice(0, 4)), [sr, sg, sb, 1]);

  const [lr, lg, lb] = parseExpectedHex("#12Abef");
  assert.deepEqual(Array.from(out.pointColors.slice(4, 8)), [lr, lg, lb, 1]);

  const [tr, tg, tb] = parseExpectedHex(colorForLayer("concept"));
  assert.deepEqual(Array.from(out.pointColors.slice(8, 12)), [tr, tg, tb, 1]);

  const [kr, kg, kb] = parseExpectedHex(colorForLayer("hyperedge"));
  assert.deepEqual(Array.from(out.pointColors.slice(12, 16)), [kr, kg, kb, 1]);

  const [pr, pg, pb] = parseExpectedHex(colorForLayer("node"));
  assert.deepEqual(Array.from(out.pointColors.slice(16, 20)), [pr, pg, pb, 1]);
});

test("toCosmos: default sizes by kind and positive node.size override", () => {
  const graph: DetectedGraph = {
    nodes: [
      { id: "defaultNode", label: "Default" },
      { id: "explicitNode", label: "Node", kind: "node" },
      { id: "hyper", label: "Hyper", kind: "hyperedge" },
      { id: "edgeNode", label: "EdgeNode", kind: "edge-as-node" },
      { id: "customSize", label: "Custom", kind: "hyperedge", size: 9.5 },
      { id: "zeroSize", label: "Zero", kind: "node", size: 0 },
      { id: "negSize", label: "Neg", kind: "edge-as-node", size: -3 },
    ],
    links: [],
  };

  const out = toCosmos(graph);
  assert.deepEqual(Array.from(out.pointSizes), [4, 4, 2, 2, 9.5, 4, 2]);
});

test("toCosmos: seeded positions are deterministic and spread grows with sqrt(node count)", () => {
  const makeGraph = (count: number): DetectedGraph => ({
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
    })),
    links: [],
  });

  const small = makeGraph(25);
  const a = toCosmos(small, 42);
  const b = toCosmos(small, 42);
  const c = toCosmos(small, 99);

  assert.deepEqual(Array.from(a.positions), Array.from(b.positions));
  assert.notDeepEqual(Array.from(a.positions), Array.from(c.positions));

  const spanX = (pos: Float32Array): number => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < pos.length; i += 2) {
      if (pos[i] < min) min = pos[i];
      if (pos[i] > max) max = pos[i];
    }
    return max - min;
  };

  const large = toCosmos(makeGraph(2500), 42);
  assert.ok(
    spanX(large.positions) > spanX(a.positions) * 5,
    "2500-node spread should be much wider than 25-node spread",
  );
});

test("toCosmos: converts a 50,000-node / 100,000-link graph in under 2 seconds", () => {
  const nodeCount = 50_000;
  const linkCount = 100_000;
  const nodes = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    nodes[i] = { id: `n${i}`, label: `n${i}` };
  }
  const links = new Array(linkCount);
  for (let i = 0; i < linkCount; i++) {
    links[i] = {
      source: `n${i % nodeCount}`,
      target: `n${(i * 31 + 7) % nodeCount}`,
      layer: i % 3 === 0 ? "l1" : "l2",
    };
  }

  const start = performance.now();
  const out = toCosmos({ nodes, links });
  const elapsedMs = performance.now() - start;

  assert.equal(out.ids.length, nodeCount);
  assert.equal(out.positions.length, nodeCount * 2);
  assert.equal(out.pointColors.length, nodeCount * 4);
  assert.equal(out.pointSizes.length, nodeCount);
  assert.equal(out.links.length, linkCount * 2);
  assert.equal(out.linkColors.length, linkCount * 4);
  assert.equal(out.droppedLinks, 0);
  assert.ok(
    elapsedMs < 2000,
    `Expected conversion under 2000ms, took ${elapsedMs.toFixed(1)}ms`,
  );
});

test("toCosmos: reads color, size and category from attrs and the raw node, as graphDetect produces them", () => {
  // graphDetect fills only id, label, kind, attrs and data; type/color/size stay undefined.
  const graph: DetectedGraph = {
    nodes: [
      { id: "a", label: "A", kind: "node", attrs: { "i2t:kind": "person" }, data: { id: "a" } },
      { id: "b", label: "B", kind: "node", data: { id: "b", type: "group-3" } },
      { id: "c", label: "C", kind: "node", data: { id: "c", group: "cluster-x", color: "#00ff00", size: 9 } },
      { id: "d", label: "D", kind: "node", attrs: { "i2t:kind": "place", color: "#123456" }, data: { id: "d" } },
    ],
    links: [],
  };
  const out = toCosmos(graph);
  const rgb = (i: number) => Array.from(out.pointColors.slice(i * 4, i * 4 + 3));
  assert.deepEqual(rgb(0), parseExpectedHex(colorForLayer("person")));
  assert.deepEqual(rgb(1), parseExpectedHex(colorForLayer("group-3")));
  assert.deepEqual(rgb(2), parseExpectedHex("#00ff00"));
  assert.deepEqual(rgb(3), parseExpectedHex("#123456"));
  assert.equal(out.pointSizes[2], 9);
  assert.equal(out.pointSizes[0], 4);
});
