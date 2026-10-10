// Rapier adapter: turns a Field into rigid bodies and integrates them.
//
// Division of labor, on purpose:
//   - field.ts decides what mass IS and how attention changes it.
//   - this file decides how mass MOVES. Bodies, collisions, damping and
//     integration are Rapier's. The forces are ours, computed from the
//     field every tick, so when the field changes (a traversal makes an
//     edge heavier) the geometry responds on the next step with no
//     joint rebuilds.
//
// Forces, per step:
//   gravity    every pair feels (G · m₁ · m₂ − G · repulsion) / r², clamped
//              below a minimum distance so two heavy nodes don't slingshot.
//              The subtraction is the point: a pair whose mass product is
//              under `repulsion` pushes apart, a pair above it pulls
//              together. Two unconnected light nodes keep their distance;
//              anything near a heavy node falls in. That is the geodesic
//              effect, and it means a node with no edges pulls nothing.
//              O(n²); the panel gates node count above it.
//   edges      Hooke spring along every edge, stiffness ∝ edge weight,
//              rest length that shrinks as weight grows. Heavier
//              connections pull tighter.
//   centering  a weak pull toward the origin so the whole field stays
//              in view instead of drifting.
//   collision  Rapier ball colliders, radius ∝ √mass. Nodes do not
//              overlap. Dense clusters pack; diffuse ones spread.
//
// Rapier is loaded once per page through initPhysics(); its WASM is
// inlined in the -compat build so no fetch or asset path is involved,
// which keeps it working inside the Tauri webview and the web build.

import type RAPIER_NS from "@dimforge/rapier2d-compat";
import type { Field } from "./field";

type Rapier = typeof RAPIER_NS;

let rapierPromise: Promise<Rapier> | null = null;

/** Load and initialize Rapier once. Safe to call from every panel instance. */
export function initPhysics(): Promise<Rapier> {
  if (!rapierPromise) {
    rapierPromise = import("@dimforge/rapier2d-compat").then(async (mod) => {
      const R = (mod.default ?? mod) as unknown as Rapier;
      await R.init();
      return R;
    });
  }
  return rapierPromise;
}

export interface PhysicsOptions {
  /** Pixel radius of a mass-1 node. Radius scales with √mass. */
  baseRadius: number;
  /** Gravitational constant. */
  G: number;
  /** Mass product below which a pair repels instead of attracts. */
  repulsion: number;
  /** Below this separation, gravity stops growing. */
  minGravityDistance: number;
  /** Spring constant per unit edge weight. */
  springK: number;
  /** Rest length for a weight-1 edge; divided by √weight as it grows. */
  springRest: number;
  /** Centering pull per unit mass. */
  centering: number;
  /** Rapier linear damping. */
  damping: number;
  /** Max force magnitude per body per step, a safety clamp. */
  maxForce: number;
}

export const defaultPhysics: PhysicsOptions = {
  baseRadius: 7,
  G: 160000,
  repulsion: 6,
  minGravityDistance: 90,
  springK: 30,
  springRest: 120,
  centering: 0.03,
  damping: 2.5,
  maxForce: 6000,
};

export interface BodyView {
  id: string;
  x: number;
  y: number;
  r: number;
}

export class FieldWorld {
  private R: Rapier;
  private world: RAPIER_NS.World;
  private bodies = new Map<string, RAPIER_NS.RigidBody>();
  private colliders = new Map<string, RAPIER_NS.Collider>();
  private lastMass = new Map<string, number>();
  private dragging = new Set<string>();
  field: Field;
  opts: PhysicsOptions;

  constructor(R: Rapier, field: Field, opts: PhysicsOptions, seedPositions?: Map<string, { x: number; y: number }>) {
    this.R = R;
    this.field = field;
    this.opts = opts;
    this.world = new R.World({ x: 0, y: 0 });
    this.world.timestep = 1 / 60;

    const n = field.nodes.length;
    field.nodes.forEach((node, i) => {
      // Seed on a loose spiral so the first frames aren't a singularity.
      const seed = seedPositions?.get(node.id);
      const angle = i * 2.399963; // golden angle
      const rad = 18 * Math.sqrt(i + 1) * Math.max(1, Math.sqrt(n) / 4);
      const x = seed ? seed.x : Math.cos(angle) * rad;
      const y = seed ? seed.y : Math.sin(angle) * rad;
      const bodyDesc = R.RigidBodyDesc.dynamic()
        .setTranslation(x, y)
        .setLinearDamping(opts.damping)
        .lockRotations();
      const body = this.world.createRigidBody(bodyDesc);
      const r = this.radiusFor(node.mass);
      // Body mass IS field mass: density is chosen so π r² · density = mass.
      const colDesc = R.ColliderDesc.ball(r)
        .setDensity(this.densityFor(node.mass))
        .setRestitution(0.05)
        .setFriction(0);
      const col = this.world.createCollider(colDesc, body);
      this.bodies.set(node.id, body);
      this.colliders.set(node.id, col);
      this.lastMass.set(node.id, node.mass);
    });
  }

  radiusFor(mass: number): number {
    return this.opts.baseRadius * Math.sqrt(Math.max(1, mass));
  }

  densityFor(mass: number): number {
    const r = this.radiusFor(mass);
    return Math.max(1, mass) / (Math.PI * r * r);
  }

  /** Grow or shrink colliders whose field mass changed since last sync. */
  syncMass(): void {
    for (const node of this.field.nodes) {
      const prev = this.lastMass.get(node.id);
      if (prev === node.mass) continue;
      const col = this.colliders.get(node.id);
      if (col) {
        col.setRadius(this.radiusFor(node.mass));
        col.setDensity(this.densityFor(node.mass));
      }
      this.lastMass.set(node.id, node.mass);
    }
  }

  private applyForces(): void {
    const { G, repulsion, minGravityDistance, springK, springRest, centering, maxForce } = this.opts;
    const nodes = this.field.nodes;
    const pos: { x: number; y: number }[] = new Array(nodes.length);
    const fx = new Float64Array(nodes.length);
    const fy = new Float64Array(nodes.length);
    const index = new Map<string, number>();
    for (let i = 0; i < nodes.length; i++) {
      const b = this.bodies.get(nodes[i].id)!;
      pos[i] = b.translation();
      index.set(nodes[i].id, i);
    }

    // Gravity: every pair. Positive f attracts, negative repels. Clamped so
    // the force saturates near contact.
    const minD2 = minGravityDistance * minGravityDistance;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        const d2 = Math.max(dx * dx + dy * dy, minD2);
        const d = Math.sqrt(d2);
        const f = (G * (nodes[i].mass * nodes[j].mass - repulsion)) / d2;
        const ux = dx / d;
        const uy = dy / d;
        fx[i] += f * ux;
        fy[i] += f * uy;
        fx[j] -= f * ux;
        fy[j] -= f * uy;
      }
    }

    // Edges: springs whose stiffness and tightness follow weight.
    for (const e of this.field.edges) {
      const i = index.get(e.source)!;
      const j = index.get(e.target)!;
      const dx = pos[j].x - pos[i].x;
      const dy = pos[j].y - pos[i].y;
      const d = Math.max(1e-3, Math.hypot(dx, dy));
      const rest = springRest / Math.sqrt(e.weight);
      const f = springK * e.weight * (d - rest);
      const ux = dx / d;
      const uy = dy / d;
      fx[i] += f * ux;
      fy[i] += f * uy;
      fx[j] -= f * ux;
      fy[j] -= f * uy;
    }

    // Centering, and apply.
    for (let i = 0; i < nodes.length; i++) {
      if (this.dragging.has(nodes[i].id)) continue;
      fx[i] -= centering * nodes[i].mass * pos[i].x;
      fy[i] -= centering * nodes[i].mass * pos[i].y;
      const mag = Math.hypot(fx[i], fy[i]);
      const s = mag > maxForce ? maxForce / mag : 1;
      const b = this.bodies.get(nodes[i].id)!;
      b.resetForces(true);
      b.addForce({ x: fx[i] * s, y: fy[i] * s }, true);
    }
  }

  step(): void {
    this.syncMass();
    this.applyForces();
    this.world.step();
  }

  /** Current positions and radii, for the renderer. */
  view(out?: BodyView[]): BodyView[] {
    const res = out ?? [];
    res.length = 0;
    for (const node of this.field.nodes) {
      const b = this.bodies.get(node.id)!;
      const t = b.translation();
      res.push({ id: node.id, x: t.x, y: t.y, r: this.radiusFor(node.mass) });
    }
    return res;
  }

  positionOf(id: string): { x: number; y: number } | undefined {
    const b = this.bodies.get(id);
    if (!b) return undefined;
    const t = b.translation();
    return { x: t.x, y: t.y };
  }

  /** Nearest body under a world-space point, or undefined. */
  hitTest(x: number, y: number, slop = 4): string | undefined {
    let best: string | undefined;
    let bestD = Infinity;
    for (const node of this.field.nodes) {
      const t = this.bodies.get(node.id)!.translation();
      const d = Math.hypot(t.x - x, t.y - y);
      const r = this.radiusFor(node.mass) + slop;
      if (d <= r && d < bestD) {
        best = node.id;
        bestD = d;
      }
    }
    return best;
  }

  beginDrag(id: string): void {
    const b = this.bodies.get(id);
    if (!b) return;
    this.dragging.add(id);
    b.setBodyType(this.R.RigidBodyType.KinematicPositionBased, true);
  }

  drag(id: string, x: number, y: number): void {
    const b = this.bodies.get(id);
    if (!b || !this.dragging.has(id)) return;
    b.setNextKinematicTranslation({ x, y });
  }

  endDrag(id: string): void {
    const b = this.bodies.get(id);
    if (!b) return;
    this.dragging.delete(id);
    b.setBodyType(this.R.RigidBodyType.Dynamic, true);
  }

  /** Bounding box of all bodies, for fit-to-view. */
  bounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of this.field.nodes) {
      const t = this.bodies.get(node.id)!.translation();
      const r = this.radiusFor(node.mass);
      minX = Math.min(minX, t.x - r);
      minY = Math.min(minY, t.y - r);
      maxX = Math.max(maxX, t.x + r);
      maxY = Math.max(maxY, t.y + r);
    }
    if (!isFinite(minX)) return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
    return { minX, minY, maxX, maxY };
  }

  dispose(): void {
    this.world.free();
    this.bodies.clear();
    this.colliders.clear();
  }
}
