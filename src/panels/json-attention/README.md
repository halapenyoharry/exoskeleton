# json-attention

A rigid-body field where mass is earned from connection and a token of attention moves through it. Every other graph viewer in the suite draws the document as given. This one draws what the document does under attention.

## The model

Three rules, all in [field.ts](field.ts), none of them needing the physics engine to be stated:

**Mass is earned from connection.** A node's mass is one plus the summed weight of its edges. A node with no edges weighs one and pulls nothing. Parallel stated relations between the same pair merge into one heavier edge.

**Traversal adds weight along the path it took.** When attention moves from one node to a neighbor, that edge gets heavier, which makes both ends heavier. This is the only way thinking about something makes it heavier: along a path the document already stated. A jump with no edge between the two nodes moves attention and adds nothing.

**Dwelling grows a node without going anywhere.** Park attention on a node and every edge already touching it gains a little, equally. No traversal, no new edges. The node becomes more findable; nothing is invented.

Nothing in the panel creates an edge. Reification is earned upstream in the document. The field only redistributes weight along what was stated.

**Density** is the clustering coefficient, fixed by topology: how tightly a node's neighbors are coupled to each other. It is reported, not simulated, and shown in the status line when you hover a node.

## The walk

Attention chooses its next hop among the current node's neighbors with probability proportional to edge weight × target mass<sup>gravity</sup>. With `gravity` at 0 it is a fair coin; at 1 it is proportional to mass; above that heavy nodes dominate. With a small probability per step (`jumpRate`) it instead jumps anywhere, weighted by mass alone. That jump is the geodesic effect in one line: from an unrelated starting point, the heaviest node is the likeliest landing.

Modes: **walk** (hop every `hopMs`), **dwell** (tick in place), **hold** (freeze attention; physics keeps running). Click a node to park attention on it, which also broadcasts a focus to the other graph panels. An incoming focus from another panel parks attention here.

## The physics

[physics.ts](physics.ts) turns the field into Rapier 2D rigid bodies. Rapier owns bodies, collisions, damping and integration; the forces are computed from the field every tick, so a traversal changes the geometry on the next step with no joint rebuilds.

- **Gravity**: every pair feels (G · m₁ · m₂ − G · repulsion) / r², clamped near contact. A pair whose mass product is below `repulsion` pushes apart; above it, pulls together. Two unconnected light nodes keep their distance. Anything near a heavy node falls in. O(n²), so the panel gates at `nodeThreshold` nodes (400 by default; 150 nodes cost about a millisecond per step).
- **Edges**: Hooke springs with stiffness proportional to edge weight and a rest length that shrinks as weight grows. Heavier connections pull tighter.
- **Centering**: a weak pull toward the origin, proportional to mass, so the field stays in view.
- **Collisions**: ball colliders with radius ∝ √mass and density chosen so body mass equals field mass. Nodes do not overlap; dense clusters pack.

The `-compat` build of Rapier inlines its WASM, so there is no asset path to configure and it loads inside the Tauri webview and the web build alike. It is lazy-loaded with the panel (about 1.3 MB gzipped) and initialized once per page.

## What you see

Edges thicken and brighten with weight; the edge attention just crossed is hot. Nodes warm toward the accent color with visits and dwell. The current node has a halo; the token is a bright dot that eases between nodes and leaves a short trail. Labels are drawn for the heaviest `labelCount` nodes plus whatever is hovered, selected elsewhere, or under attention, sized by mass. Reified relations (`kind: "hyperedge"`) are drawn hollow and dashed; physically they still have mass.

**forget** rebuilds the field from the document, keeping node positions, and discards everything attention did.

## Sync

Same identity-only contract as the other graph viewers ([docs/cross-panel-sync.md](../../../docs/cross-panel-sync.md)). Hover broadcasts a selection, click broadcasts a focus, an incoming selection highlights, an incoming focus parks attention and eases the camera there in this panel's own coordinates. Nothing positional crosses the bus.

## Params

| Param | Default | What it does |
|---|---|---|
| `documentId` | `"default"` | json-bus channel to read from. |
| `mode` | `"walk"` | `walk`, `dwell`, or `paused`. |
| `hopMs` | `700` | Milliseconds between hops or dwell ticks. |
| `gravityBias` | `1` | Exponent on target mass when choosing the next hop. |
| `traverseGain` | `0.15` | Weight added to an edge per traversal. |
| `dwellGain` | `0.02` | Weight added to each incident edge per dwell tick. |
| `jumpRate` | `0.05` | Per-step probability of a mass-weighted jump anywhere. |
| `showLabels` | `true` | Draw labels. |
| `labelCount` | `12` | How many of the heaviest nodes get labels. |
| `fitOnLoad` | `true` | Fit the view 1.5 s after a document loads. |
| `nodeThreshold` | `400` | Perf gate (gravity is n²). |
| `seed` | `1` | PRNG seed; the walk is reproducible for a given seed. |

## Tests

`field.test.ts` checks the rules without the engine: mass from degree, clustering coefficient, edge merging, traversal adding weight only where it walked, dwell never creating an edge, the geodesic landing distribution, and that gravity 0 is flat. `physics.test.ts` runs Rapier under node and checks bounded integration, radius following mass, springs tightening connected pairs, and drag. Both run under `npm test`.

## Dependencies

`@dimforge/rapier2d-compat` ^0.21, `d3` (already present, used for pan/zoom and the focus transition).
