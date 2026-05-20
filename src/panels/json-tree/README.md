# json-tree

Hierarchical D3 tree of the JSON document published on the `json-bus`. Pairs with [`json-edit`](../json-edit) (the producer); becomes one tab of the viewer group along with `json-graph`, `json-cytoscape`, `json-graph3d`, `json-circles`, `json-mass`.

## What you see

- A `d3.tree` (tidy) or `d3.cluster` layout of the JSON's nested structure.
- Pan with drag; zoom with scroll wheel; drag individual nodes to nudge them.
- Reset (⤢) button restores the default centred view.

## Params

| Param | Default | What it does |
|---|---|---|
| `documentId` | `"default"` | json-bus channel to read from. |
| `layout` | `"cluster"` | `"cluster"` (equal-depth leaves) or `"tidy"` (compact). |
| `direction` | `"LR"` | `"LR"` \| `"RL"` \| `"TB"` \| `"BT"` |
| `spacingX` | `14` | Density along the perpendicular axis (smaller = tighter). |
| `spacingY` | `200` | Spread between depth levels (smaller = compressed depth). |
| `fontSize` | `11` | Label font size in px. |
| `nodeColor` | `#00e5ff` | Leaf-node fill. |
| `linkColor` | `#555555` | Link stroke + internal node fill. |
| `showArrayIndices` | `true` | Show `[N]` prefix on array items. |
| `explodePrimitives` | `false` | Separate `key: value` into `key` → `value` child node. |
| `bypassPerf` | `false` | Skip the perf-warning gate. |
| `nodeThreshold` | `10000` | Show warning above this many nodes. |

All params persist via `props.api.updateParameters`.

## Subscribing to json-bus

```ts
import { getJson, onJsonChange } from "../../data/json-bus";

const [doc, setDoc] = useState(() => getJson(params.documentId));
useEffect(() => onJsonChange(params.documentId, setDoc), [params.documentId]);
```

If nothing is on the bus yet (e.g. no `json-edit` panel is open), `doc` is `undefined` and the panel shows a "Waiting for JSON…" placeholder.

## Dependencies

- `d3 ^7.9.0` — declared in the manifest's `npmDependencies`.
- `_shared/json-utils/jsonToHierarchy.ts` — must be copied to `src/data/json-utils/` in the fork during install (see [_shared/json-utils/README.md](../_shared/json-utils/README.md)).

## Gotchas

- **Large documents.** The d3 hierarchy + SVG rendering scales linearly but rendering 10k+ nodes is sluggish. The perf gate fires above `nodeThreshold`.
- **Drag is visual only.** Dragging a node nudges its position on screen but doesn't relink edges or persist. Reset (⤢) restores the layout.
- **Popout windows.** Per the [json-bus FAQ entry](https://github.com/halapenyoharry/exoskeleton/blob/main/docs/AGENTS-FAQ.md), this panel won't receive bus updates if popped out into a separate Tauri window. Stay in the main window for now.

## Provenance

Adapted from [`halapenyoharry/json-visual-viewer`](https://github.com/halapenyoharry/json-visual-viewer) `src/components/TreeView.tsx` on 2026-05-19. D3 rendering preserved verbatim; store reads replaced with params + json-bus subscription.
