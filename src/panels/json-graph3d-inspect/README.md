# json-graph3d-inspect ("3D-Inspect")

A copy of [`json-graph3d`](../json-graph3d/README.md) rebuilt for *reading* a topology instead of looking at its shape. Same engine (`react-force-graph-3d`, Three.js), same json-bus and selection/focus sync, different rendering:

| | json-graph3d | json-graph3d-inspect |
|---|---|---|
| Node | sphere | the node's label as a text sprite (first `labelMaxWords` words, default 5) |
| Node size | per kind | `degree` — `(degree/max)^nodeSizeExponent` mapped between `nodeTextHeightMin` and `Max` — or `uniform` |
| Edge label | sprite of `label` when `always` | **role** on spokes, **predicate** on dyadic links; `always` by default; lies **along the edge** (`----- label ---->`, hinged billboard) or faces the viewer |
| Relation nodes (hyperedges) | sphere + id | their **predicate** as smaller text in category color, or a junction `dot`, or the raw `id` |
| Edge color | layer hash | i2t **category** by default; `layer` or `predicate` hashing; any of them overridable |
| Edge width | uniform | scaled per category (state_change 1.4 · interactivity 1.0 · reference 0.4 · containment hairline) |
| Containment | lines like everything else | transparent **hull** around participants; spoke lines hidden (`showContainmentLinks` to bring them back) |
| Particles | on | off (reading view); when on, only on state_change edges |

## What the whitepaper asks for, and where this lands

[`information2topology/docs/systems-thinking-exoskeleton-blueprint.md`](../../../../information2topology/docs/systems-thinking-exoskeleton-blueprint.md) Table 1 gives each category a visual idiom:

| Category | Idiom in the spec | Here |
|---|---|---|
| containment | enclosing hulls, **no connecting lines** | hull (blob or convex), lines off by default |
| state_change | motion gradients, directed flows | directed arrows, thickest line, optional particles |
| interactivity | shared fields, springs | solid mid-weight line, amber |
| reference | low-weight dashed, floating callout | thinnest line, slate; *not* dashed yet (Three line dashes need a different material) |

The colors are the same four tokens `json-dyadic` uses (`CATEGORY_TOKENS`), so a category reads the same across both panels.

## Fonts

Text sprites render to a canvas, so any installed font works and nothing is fetched. Defaults: `system-ui` stack, weight 700, resolution 120px, with a dark stroke (`strokeWidth` 0.08 of text height) so labels stay legible over lines and hulls. All adjustable in params.

## Colors for "the OSC bus vs. everything else"

`colorOverrides` is a flat map of CSS colors keyed by, in order of precedence:

```
node:<id>          one specific node
kind:<i2t:kind>    every node whose attrs["i2t:kind"] matches
predicate:<p>      every link with that i2t:predicate / label
layer:<l>          every link in that layer
category:<c>       containment | state_change | interactivity | reference
```

Example, for `docs/exoskeleton-system.topology.json`:

```json
"colorOverrides": {
  "node:bus:osc": "#ffb300",
  "node:bus:json": "#18ffff",
  "predicate:plays_over": "#ffb300",
  "predicate:is_driven_over": "#ffb300",
  "predicate:shares_document_through": "#18ffff"
}
```

Hyperedge (reified relation) nodes take their category color unless overridden. Node colors otherwise come from `attrs.color`, then a stable hash of `i2t:kind`, then `nodeDefaultColor`.

## Hulls

One mesh per containment hyperedge, enclosing every participant (container and contained), colored by the container node's color. `hullMode`:

- `ellipsoid` (default, "blob") — axis-aligned bounding box of the participants, padded by `hullPadding`, drawn as a sphere scaled to it. Robust for any member count, 2D or 3D.
- `convex` — `ConvexGeometry` over the padded participant points (3D only, ≥4 points; falls back to the ellipsoid otherwise).

Hulls are refit from the panel's own animation loop (every `hullRebuildEveryTicks` frames), not from simulation ticks, so they survive the sim cooling down, resizes and camera moves. They skip frustum culling and depth testing on purpose — a background blob must never be hidden by a sprite or a zoomed-in camera. The same loop re-hinges along-edge labels toward the camera between ticks.

## Params

| Group | Param | Default |
|---|---|---|
| Data | `documentId` | `"default"` |
| Mode | `dimensions`, `freezeLayout`, `layerVisibility`, `backgroundColor` | `3`, `false`, `{}`, `#0a0e26` |
| Node text | `labelMaxWords` | `5` |
| | `fontFace` | system-ui stack |
| | `fontWeight`, `fontResolution` | `"700"`, `120` |
| | `strokeWidth`, `strokeColor` | `0.08`, `#05071a` |
| | `nodeSizeBy` | `"degree"` |
| | `nodeTextHeightMin`, `nodeTextHeightMax` | `3.5`, `16` |
| | `nodeSizeExponent` | `1.4` (>1 makes hubs stand out more) |
| | `hyperedgeTextScale` | `0.6` |
| | `hyperedgeLabel` | `"predicate"` / `"dot"` / `"id"` |
| | `nodeDefaultColor`, `selectedColor` | `#dff6ff`, `#ff007f` |
| Edges | `edgeLabels` | `"always"` |
| | `edgeLabelTextHeight` | `2.6` |
| | `edgeLabelOrientation` | `"along"` / `"billboard"` |
| | `edgeColorBy` | `"category"` |
| | `colorOverrides` | `{}` |
| | `linkWidth`, `linkOpacity`, `arrowLength`, `curvature` | `0.8`, `0.55`, `3.5`, `0.25` |
| | `showContainmentLinks` | `false` |
| | `particles`, `particleCount`, `particleSpeed` | `false`, `2`, `0.006` |
| Hulls | `hulls`, `hullMode`, `hullOpacity`, `hullPadding`, `hullRebuildEveryTicks` | `true`, `"ellipsoid"`, `0.12`, `8`, `2` |
| Misc | `showLegend` | `false` (header checkbox) |
| | `tooltipMaxAttrs`, `tooltipValueMaxLen` | `12`, `80` |
| | `fitDuration`, `fitPadding`, `fitDelayMs`, `cooldownTicks` | `600`, `60`, `800`, `200` |
| Perf | `nodeThreshold` | `5000` (one text sprite per node is heavier than a sphere) |

## Gotchas

- Everything from the `json-graph3d` README applies (WebGL only, no SVG export).
- One canvas texture per node and per labeled edge. Fine into the low thousands; above `nodeThreshold` the panel asks before rendering.
- Node sprites always face the camera; in 2D mode that is what you want, in 3D it means two labels can overlap at some angles — orbit a little.
