# json-edit

Monaco-based JSON editor that publishes parsed documents onto the [`json-bus`](https://github.com/halapenyoharry/exoskeleton/blob/main/src/data/json-bus.ts). Six sibling viewer panels (`json-tree`, `json-graph`, `json-cytoscape`, `json-graph3d`, `json-circles`, `json-mass`) subscribe to the same channel and render the document.

## What you get

A Monaco editor configured with:
- The bundled **Midnight Alaska** theme (cyan keys, white string values, gold numbers, green keywords). Hard-coded JSON-Crack-inspired palette.
- Bracket pair colorization, indent guides, word wrap, format-on-paste — sensible JSON defaults.
- Debounced (250ms) publishing to `json-bus`: each keystroke doesn't trigger a viewer re-render, but a brief pause does.
- A parse-error indicator in the panel header if the buffer doesn't currently parse — the bus value sticks at the last valid parse so viewers don't flicker on invalid intermediate states.

## Params

| Param | Default | What it does |
|---|---|---|
| `documentId` | `"default"` | json-bus channel to publish into. Open two `json-edit` panels with different ids to drive different viewer groups. |
| `debounceMs` | `250` | Milliseconds to wait after the last keystroke before re-publishing. |
| `theme` | `"midnight-alaska"` | Monaco theme id. The bundled `midnight-alaska` is auto-registered before mount. |
| `fontSize` | `13` | Editor font size in px. |
| `wordWrap` | `"on"` | `"on"` \| `"off"` \| `"bounded"` \| `"wordWrapColumn"` |
| `tabSize` | `2` | Indent width in spaces. |
| `minimap` | `false` | Show Monaco's minimap on the right. |
| `lineNumbers` | `"on"` | `"on"` \| `"off"` \| `"relative"` \| `"interval"` |
| `formatOnPaste` | `true` | Auto-format the buffer on paste. |

All params persist via `props.api.updateParameters` — they survive exoskeleton restarts.

## Initial value

On mount, `json-edit` checks `getJson(documentId)`. If a viewer or another editor previously published a document on that channel, the editor loads it (pretty-printed). Otherwise it starts with an empty buffer.

## Theme customization

The bundled Midnight Alaska theme lives in `themes/midnight-alaska.ts` as a plain `IStandaloneThemeData` object. Edit it directly to recolor; or supply a different `theme` id and register your own theme separately in your exoskeleton fork.

## Cross-panel data contract

```ts
// What this panel does (debounced):
import { setJson } from "../../data/json-bus";
setJson("default", parsedJsonValue);

// What viewer panels do:
import { getJson, onJsonChange } from "../../data/json-bus";
const [doc, setDoc] = useState(() => getJson("default"));
useEffect(() => onJsonChange("default", setDoc), []);
```

See the [AGENTS-FAQ entry](https://github.com/halapenyoharry/exoskeleton/blob/main/docs/AGENTS-FAQ.md) on snapshot-state-with-subscription for the design rationale.

## Gotchas

- **Popout windows don't share the bus.** If you drag this panel out via `addPopoutGroup`, the new React tree has its own JS heap and `json-bus` doesn't reach it. Viewers stay in sync only while in the main window.
- **Parse cost.** The editor calls `JSON.parse` on every debounced change. For documents over a few MB, dial up `debounceMs` or split the document into a separate file referenced by your visualizers.
- **No undo across reloads.** Monaco's undo stack is in-memory; restarting exoskeleton resets it. The current buffer is recovered from `json-bus` on mount, but prior edit history is gone.

## Install

Standard exoskeleton install protocol (see [library README](../README.md)). Additional step:

- Ensure `_shared/json-utils/` is NOT required by this panel (it isn't — only viewers need it). The editor only depends on `@monaco-editor/react`, `monaco-editor`, and `src/data/json-bus.ts` from the exoskeleton core.

## Provenance

Adapted from [`halapenyoharry/json-visual-viewer`](https://github.com/halapenyoharry/json-visual-viewer) Editor.tsx on 2026-05-19. Theme verbatim. Editor options preserved as defaults; now all tunable via params.
