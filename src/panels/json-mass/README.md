# json-mass

Circle packing weighted by **substrate-normalized mass** (text line count, image weight) rather than leaf count. Built for [project-mass-scanner](https://github.com/halapenyoharry/project-mass-scanner) output, but degrades gracefully to count-weighting on arbitrary JSON.

## What this gives you that json-circles doesn't

`json-circles` assigns every leaf a uniform weight — a 50-line markdown file packs the same as a one-line ini. `json-mass` assigns weight by *mass*: text leaves carry their line count, image leaves are pegged to a thousand-word document equivalent, unscored leaves default to `defaultLeafMass` (usually 1).

Container nodes' visual size is therefore proportional to their actual content burden in the project — useful for finding the heaviest parts of a codebase or media library at a glance.

## Input shape

This panel expects one of three JSON shapes, in order of preference:

1. **project-mass-scanner output:** `{ _meta, tree: { name, children?, mass?, substrate? } }` — the typical case. Mass fields are honoured; substrates color leaves.
2. **Already-shaped hierarchy:** `{ name, children, mass?, substrate? }` — anything with a `name` field at the root.
3. **Arbitrary JSON:** falls through to `jsonToHierarchy` (the same converter `json-circles` uses) and treats every leaf as `defaultLeafMass`. The view never crashes on unfamiliar input; it just degenerates to count-weighting.

## Params

| Param | Default | What it does |
|---|---|---|
| `documentId` | `"default"` | json-bus channel to read from. |
| `padding` | `3` | Pixel padding between sibling circles. |
| `leafFontSize` | `16` | Base font size for leaf labels. |
| `textSubstrateColor` | `#0f1447` | Fill for `substrate: "text"` leaves. |
| `imageSubstrateColor` | `#ff6b9d` | Fill for `substrate: "image"` leaves. |
| `internalGradientStart` | `#0f1447` | Container fill at root depth. |
| `internalGradientEnd` | `#00e5ff` | Container fill at deepest depth. |
| `defaultLeafMass` | `1` | Weight assigned to leaves without a `mass` field. |
| `panZoomMin` | `0.25` | Minimum scroll-zoom scale. |
| `panZoomMax` | `12` | Maximum scroll-zoom scale. |
| `bypassPerf` | `false` | Skip the perf gate. |
| `nodeThreshold` | `5000` | Show perf warning above this many nodes. |

## Native SVG tooltip

Each circle gets a `<title>` element with `name`, computed mass, and substrate. Browsers render these as native tooltips on hover.

## Dependencies

- `d3 ^7.9.0`
- `_shared/json-utils/jsonToHierarchy.ts` (copied to `src/data/json-utils/` during install).

## Provenance

Ported from [`json-visual-viewer`](https://github.com/halapenyoharry/json-visual-viewer) `src/components/MassCirclesView.tsx` on 2026-05-19.
