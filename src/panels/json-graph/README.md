# json-graph

D3 force-directed graph of the JSON document on the `json-bus`. Detects graph-shaped JSON via [`graphDetect`](../_shared/json-utils/graphDetect.ts) and runs a force simulation with drag, zoom, layer toggles, and a freeze/explore toggle.

## What you see

Nodes laid out by force physics — repulsion, link distance, collision avoidance, centring. Drag a node to nudge it; the simulation accommodates. Toggle **freeze** to pin everything in place for stable inspection.

Directed edges get an arrowhead; undirected edges don't. Edges carrying a `layer` field are colored by that layer's stable hash color.

## Params

Liberal exposure — every force tunable, sizing constant, and camera parameter is a panel param:

| Group | Param | Default | Notes |
|---|---|---|---|
| Data | `documentId` | `"default"` | json-bus channel. |
| State | `freezeLayout` | `false` | Pin all nodes; pause the simulation. |
| State | `layerVisibility` | `{}` | Per-layer on/off; auto-populated. |
| Forces | `linkDistance` | `120` | Target edge length. |
| Forces | `chargeStrength` | `-300` | Node-node repulsion (negative = repel). |
| Forces | `collideRadius` | `30` | Hard-shell collision radius. |
| Forces | `collideStrength` | `0.9` | 0=ignore overlap, 1=enforce strictly. |
| Forces | `velocityDecay` | `0.85` | Drag coefficient (1 = no inertia). |
| Forces | `alphaDecay` | `0.05` | Cooling rate. |
| Forces | `alphaMin` | `0.01` | Stop threshold. |
| Sizing | `nodeRadius` | `14` | Node circle radius. |
| Camera | `fitOnLoad` | `true` | Auto-fit after simulation settles. |
| Camera | `fitPadding` | `100` | Pixels of margin around the fit-bounds. |
| Camera | `fitMaxScale` | `1.5` | Don't zoom in beyond this on auto-fit. |
| Camera | `fitDelayMs` | `1500` | How long to let the sim settle before fitting. |
| Camera | `zoomMin` / `zoomMax` | `0.1` / `8` | Scroll zoom range. |
| Labels | `nodeLabelMaxLength` | `20` | Truncate long labels with `...`. |
| Labels | `nodeLabelOffset` | `28` | Y offset of node labels below the circle. |
| Perf | Perf | `nodeThreshold` | `500` | Show perf warning above this. |

## Dependencies

- `d3 ^7.9.0`
- `_shared/json-utils/graphDetect.ts` + `_shared/json-utils/layers.ts` (copy to `src/data/json-utils/`).

## Gotchas

- **Tick-driven layout race.** The auto-fit happens after `fitDelayMs` regardless of whether the simulation has settled. For dense graphs, bump `fitDelayMs` or use the manual reset (⤢) button.
- **Drag does pin.** Dragging a node sets its `fx`/`fy` until you release. If you want it pinned permanently, freeze the layout.
- **No multi-edge curving.** Multiple edges between the same node pair render as overlapping straight lines. For multi-edge visualization, prefer `json-cytoscape` or `json-graph3d`.

## Provenance

Ported from [`json-visual-viewer`](https://github.com/halapenyoharry/json-visual-viewer) `src/components/ForceGraphView.tsx` on 2026-05-19. Hardcoded force constants from the original ("perfect physics from universal-graph-viewer") promoted to params.
