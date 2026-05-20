# json-cytoscape

[Cytoscape.js](https://js.cytoscape.org/) graph rendering. Detects graph-shaped JSON from the json-bus (`{ nodes, edges }`, `{ nodes, links }`, edge-only arrays, single-rooted-node-with-edges) and lays it out with one of seven algorithms.

## Layouts

Pick via the header dropdown — persisted in panel params:

| Layout | Use for |
|---|---|
| **fcose** (default) | Most general-purpose; force-directed with compound-node awareness. |
| **cose** | Classic force-directed (no compound nodes). |
| **breadthfirst** | DAGs; uses link direction to lay out levels. |
| **concentric** | Star-shaped graphs (one hub + radiating spokes). |
| **circle** | Force a circle layout — useful for cycles. |
| **grid** | Regular grid; deterministic. |
| **random** | Stress test or starting point. |

## Multi-edge support

Edges with the same `source`/`target` pair render as curved bezier offsets when `curveEdges: true` (default). Toggle off via the panel header to see them overlap as straight lines.

## Layer toggles

Edges in the source JSON can carry a `layer` field (or `attrs.layer`). The panel auto-detects these and renders each layer in a stable color (hashed from layer name). The `layerVisibility` param holds the on/off state per layer — currently no in-panel toggle UI; tweak via the panel's `layerVisibility` JSON in the layout file, or open a feature request for a panel-internal layer list.

## Params

| Param | Default | What it does |
|---|---|---|
| `documentId` | `"default"` | json-bus channel to read from. |
| `layout` | `"fcose"` | One of the seven layout names above. |
| `curveEdges` | `true` | Bezier-curve multi-edges (vs. straight overlap). |
| `layerVisibility` | `{}` | Map of layer-name → visible boolean. Auto-populated from detected graph. |
| `wheelSensitivity` | `0.2` | Mouse-wheel zoom sensitivity. |
| `minZoom` | `0.1` | Smallest zoom level. |
| `maxZoom` | `4` | Largest zoom level. |
| `hideEdgesOnViewport` | `true` | Hide edges during pan/zoom (perf). |
| `hideLabelsOnViewport` | `true` | Hide labels during pan/zoom (perf). |
| `textureOnViewport` | `true` | Cache to texture during pan/zoom (perf). |
| `motionBlur` | `true` | Motion blur during pan/zoom (perf). |
| `fitPadding` | `40` | Pixel padding when calling reset / fit. |
| `tooltipMaxAttrs` | `12` | Cap on `attrs` rows shown in the hover tooltip. |
| `tooltipValueMaxLen` | `80` | Truncate tooltip values longer than this. |
| `bypassPerf` | `false` | Skip the perf gate. |
| `nodeThreshold` | `1500` | Show perf warning above this many nodes. |

## Dependencies

- `cytoscape ^3.33.0`, `cytoscape-fcose ^2.2.0`
- `_shared/json-utils/graphDetect.ts` + `_shared/json-utils/layers.ts` (copy to `src/data/json-utils/` during install).

## Gotchas

- **Canvas takeover.** Cytoscape mounts its own canvas into the container ref. Anything else in the same container will be over-painted. The panel reserves an absolute-positioned div for the canvas and layers tooltips on top with absolute positioning + `pointer-events: none`.
- **No SVG export.** Cytoscape's native export is PNG/JPG/JSON. SVG requires the `cytoscape-svg` plugin. Not bundled in this panel; add it if you need vector export.
- **Tooltip math.** Edge-midpoint positioning uses Cytoscape's `pan` + `zoom` to translate model coordinates to screen pixels. The math is sensitive — if you see tooltips drift, check that `cy.pan()` and `cy.zoom()` are being read fresh.

## Provenance

Ported from [`json-visual-viewer`](https://github.com/halapenyoharry/json-visual-viewer) `src/components/CytoscapeView.tsx` on 2026-05-19.
