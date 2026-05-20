# json-circles

Zoomable circle packing of the JSON document on the `json-bus`. Click any circle to zoom in; click the background to zoom out; scroll/drag to pan-zoom freely.

## What you see

Bostock's classic circle-packing visualization (D3 `pack` layout), reading from the json-bus. Internal nodes are colored by depth (gradient `internalGradientStart` → `internalGradientEnd`); leaves use `leafFill`. Hover highlights; click triggers an animated zoom focus transition.

## Params

| Param | Default | What it does |
|---|---|---|
| `documentId` | `"default"` | json-bus channel to read from. |
| `showArrayIndices` | `true` | Show `[N]` prefix on array items. |
| `explodePrimitives` | `false` | Separate `key: value` into `key` → `value`. |
| `padding` | `3` | Pixel padding between sibling circles. |
| `leafFontSize` | `16` | Base font size for leaf labels (auto-fit shrinks them). |
| `internalGradientStart` | `#0f1447` | Color of the root container. |
| `internalGradientEnd` | `#00e5ff` | Color of the deepest internal nodes. |
| `leafFill` | `#131940` | Leaf-node fill. |
| `panZoomMin` | `0.25` | Minimum scroll-zoom scale. |
| `panZoomMax` | `12` | Maximum scroll-zoom scale. |
| `bypassPerf` | `false` | Skip the perf gate. |
| `nodeThreshold` | `5000` | Show perf warning above this many nodes. |

All params persist via `props.api.updateParameters`.

## Default layout

This panel defaults to `direction: "within", reference: "json-tree"` — it appears as a tab in the same dockview group as the other JSON viewers. Switch tabs to compare the same document under different visualizations.

## Dependencies

- `d3 ^7.9.0`
- `_shared/json-utils/jsonToHierarchy.ts` (copied to `src/data/json-utils/` during install).

## Provenance

Ported from [`json-visual-viewer`](https://github.com/halapenyoharry/json-visual-viewer) `src/components/CirclesView.tsx` on 2026-05-19. Bostock's click-to-zoom layered with `d3.zoom` for free pan/zoom on top.
