import { test } from "node:test";
import assert from "node:assert/strict";
import { buildField, defaultRules, traverse, type Walker } from "./field.ts";
import { FieldWorld, defaultPhysics, initPhysics } from "./physics.ts";

// Rapier's -compat build inlines its WASM, so this runs under plain node.

function hub() {
  const nodes = ["hub", "a", "b", "c", "d", "e", "far1", "far2"].map((id) => ({ id, label: id }));
  const links = [
    { source: "hub", target: "a" },
    { source: "hub", target: "b" },
    { source: "hub", target: "c" },
    { source: "hub", target: "d" },
    { source: "hub", target: "e" },
    { source: "far1", target: "far2" },
  ];
  return { nodes, links };
}

test("bodies integrate without blowing up and the heavy node ends nearest the centre", async () => {
  const R = await initPhysics();
  const field = buildField(hub());
  const world = new FieldWorld(R, field, defaultPhysics);
  for (let i = 0; i < 600; i++) world.step();
  const view = world.view();
  for (const v of view) {
    assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y), `${v.id} has finite position`);
    assert.ok(Math.hypot(v.x, v.y) < 5000, `${v.id} stayed in bounds`);
  }
  const byId = new Map(view.map((v) => [v.id, v]));
  const hubD = Math.hypot(byId.get("hub")!.x, byId.get("hub")!.y);
  const farD = Math.hypot(byId.get("far1")!.x, byId.get("far1")!.y);
  assert.ok(hubD < farD, `hub (${hubD.toFixed(1)}) should sit nearer the centre than the island (${farD.toFixed(1)})`);
  world.dispose();
});

test("collider radius follows mass after a traversal", async () => {
  const R = await initPhysics();
  const field = buildField(hub());
  const world = new FieldWorld(R, field, defaultPhysics);
  const before = world.radiusFor(field.byId.get("hub")!.mass);
  const w: Walker = { at: "a", mode: "walk", from: null };
  traverse(field, w, "hub", defaultRules);
  world.step();
  const after = world.view().find((v) => v.id === "hub")!.r;
  assert.ok(after > before);
  world.dispose();
});

test("springs pull connected nodes closer than unconnected ones of equal mass", async () => {
  const R = await initPhysics();
  const field = buildField({
    nodes: ["p", "q", "r"].map((id) => ({ id, label: id })),
    links: [{ source: "p", target: "q" }],
  });
  const world = new FieldWorld(R, field, defaultPhysics);
  for (let i = 0; i < 600; i++) world.step();
  const byId = new Map(world.view().map((v) => [v.id, v]));
  const pq = Math.hypot(byId.get("p")!.x - byId.get("q")!.x, byId.get("p")!.y - byId.get("q")!.y);
  const pr = Math.hypot(byId.get("p")!.x - byId.get("r")!.x, byId.get("p")!.y - byId.get("r")!.y);
  assert.ok(pq < pr, `p–q (${pq.toFixed(1)}) should be tighter than p–r (${pr.toFixed(1)})`);
  world.dispose();
});

test("drag makes a body kinematic and releases it", async () => {
  const R = await initPhysics();
  const field = buildField(hub());
  const world = new FieldWorld(R, field, defaultPhysics);
  world.beginDrag("a");
  world.drag("a", 300, 300);
  world.step();
  const p = world.positionOf("a")!;
  assert.ok(Math.abs(p.x - 300) < 1 && Math.abs(p.y - 300) < 1);
  world.endDrag("a");
  for (let i = 0; i < 60; i++) world.step();
  const p2 = world.positionOf("a")!;
  assert.ok(Math.hypot(p2.x - 300, p2.y - 300) > 1, "released body moves under forces again");
  world.dispose();
});
