# json-graph3d

WebGL force-directed 3D graph rendering of the JSON document on the `json-bus`. Built on [`react-force-graph-3d`](https://github.com/vasturiano/react-force-graph) (Three.js under the hood); multi-edges fan out in 3D with per-edge sprite labels.

## What you see

- Nodes positioned by 3D force simulation; drag to rotate (orbit camera); scroll to zoom; right-drag to pan.
- Directed edges show arrows; if `particles: true`, traveling-light particles flow along directed edges.
- Multi-edges between the same node pair fan out via rotation + curvature so each one is individually visible.
- Hover any node or edge to see a rich HTML tooltip with attributes (cap of `tooltipMaxAttrs` rows).

## 2D / 3D switch

Set `dimensions: 2` to flatten the layout (still uses the same simulation, just constrained to the xy plane). Useful for screenshots, fine-tuning small graphs, or when 3D is overkill.

## Label modes

- `"hover"` (default): no inline labels; HTML tooltip on hover.
- `"always"`: edge labels render as in-scene sprite text along each edge. Heavy for big graphs.
- `"never"`: no labels, no tooltips. Fast.

## Freeze

Pin every node to its current position; orbit controls keep working, simulation pauses. Toggling off re-heats the simulation.

## Params

| Group | Param | Default | Notes |
|---|---|---|---|
| Data | `documentId` | `"default"` | |
| Mode | `dimensions` | `3` | `2` or `3` |
| Mode | `labelMode` | `"hover"` | `"always"` / `"hover"` / `"never"` |
| Mode | `particles` | `true` | Animated traveling particles. |
| Mode | `freezeLayout` | `false` | Pin nodes; pause sim. |
| Mode | `curvature` | `0.3` | Base curvature for multi-edges. |
| Mode | `layerVisibility` | `{}` | Auto-populated per detected layer. |
| Sizing | `nodeRelSize` | `4` | |
| Sizing | `nodeOpacity` | `0.9` | |
| Sizing | `linkOpacity` | `0.6` | |
| Sizing | `linkWidth` | `0.6` | |
| Sizing | `arrowLength` | `3` | |
| Sizing | `arrowRelPos` | `1` | 0=at source, 1=at target. |
| Particles | `particleCount` | `2` | Particles per directed edge. |
| Particles | `particleWidth` | `1.5` | |
| Particles | `particleSpeed` | `0.006` | |
| Colors | `backgroundColor` | `#0a0e26` | Scene background. |
| Colors | `nodeKindColors` | `{node, hyperedge, edge-as-node}` | Per-kind palette. |
| Labels | `inlineLabelTextHeight` | `2` | Sprite text height in scene units. |
| Labels | `inlineLabelBg` | `rgba(10, 14, 38, 0.7)` | Sprite background. |
| Labels | `inlineLabelPadding` | `2` | |
| Labels | `tooltipMaxAttrs` | `12` | Tooltip attr-row cap. |
| Labels | `tooltipValueMaxLen` | `80` | Tooltip value truncation. |
| Camera | `fitDuration` | `600` | Auto-fit transition ms. |
| Camera | `fitPadding` | `60` | |
| Camera | `fitDelayMs` | `800` | Delay before initial fit. |
| Camera | `cooldownTicks` | `150` | Simulation cooldown ticks. |
| Camera | `showNavInfo` | `false` | Show navigation hint overlay. |
| Perf | Perf | `nodeThreshold` | `50000` | Above 5,000 nodes the panel auto-degrades detail (1px links, no curvature/arrows/particles, shorter cooldown) instead of blocking. |

## Dependencies

- `react-force-graph-3d ^1.27.0`, `three ^0.184.0`, `three-spritetext ^1.10.0`
- `_shared/json-utils/graphDetect.ts` + `_shared/json-utils/layers.ts`

## Gotchas

- **WebGL only.** This panel will not work in environments without WebGL (older OS X integrated GPUs, some embedded WebViews). If you see a blank canvas, check the browser console for WebGL errors.
- **No SVG export.** `react-force-graph-3d` exposes only canvas-to-PNG. Use `canvas.toBlob()` if you need to save a frame.
- **Sprite labels are expensive.** `labelMode: "always"` allocates one sprite per edge; with thousands of edges it'll hammer the GPU. Default to `"hover"` unless you specifically need always-on labels.
- **Particles + freeze.** Particles are disabled while frozen — they look weird when nodes aren't moving.

## Provenance

Ported from [`json-visual-viewer`](https://github.com/halapenyoharry/json-visual-viewer) `src/components/Graph3DView.tsx` on 2026-05-19.
