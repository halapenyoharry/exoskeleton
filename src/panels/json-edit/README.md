# json-edit

CodeMirror 6 JSON editor that publishes parsed documents onto the [`json-bus`](https://github.com/halapenyoharry/exoskeleton/blob/main/src/data/json-bus.ts). Six sibling viewer panels (`json-tree`, `json-graph`, `json-cytoscape`, `json-graph3d`, `json-circles`, `json-mass`) subscribe to the same channel and render the document.

## What you get

A CodeMirror 6 editor configured with:
- The bundled **Midnight Alaska** theme (cyan keys, white string values, gold numbers, green keywords). Hard-coded JSON-Crack-inspired palette.
- JSON language mode, line wrapping, format-on-paste — sensible JSON defaults.
- A document picker: every document on the `json-bus` is a named entry in an in-app library (persisted in IndexedDB by `src/data/json-bus-persist.ts`). The ☰ menu adds New document, Open file(s)… (each file becomes its own document), Save / Download, Copy JSON, Rename…, and Delete document. File and clipboard actions go through `src/utils/file-io.ts`, so they work in the desktop app (native dialogs) and in a plain browser tab (downloads, file picker, clipboard fallback), and every action reports success or failure in the header.
- Follows the active document: picking a document here, in another editor, or pushing one from `topology-extract` switches this editor and the viewers to it. It also listens to the bus, so documents other panels publish appear without a remount.
- Debounced (250ms) publishing to `json-bus`: each keystroke doesn't trigger a viewer re-render, but a brief pause does.
- A parse-error indicator in the panel header if the buffer doesn't currently parse — the bus value sticks at the last valid parse so viewers don't flicker on invalid intermediate states.

## Params

| Param | Default | What it does |
|---|---|---|
| `documentId` | `"default"` | The document this panel last had open; reopened on launch. |
| `followActive` | `true` | Edit whichever document is active. Set `false` and give two `json-edit` panels different `documentId`s to drive different viewer groups. |
| `debounceMs` | `250` | Milliseconds to wait after the last keystroke before re-publishing. |
| `theme` | `"midnight-alaska"` | Theme id. The bundled `midnight-alaska` CodeMirror extension is applied at mount. |
| `filePath` | *(legacy)* | Older layouts' backing-file path. Read once (desktop app) into an empty document, then dropped; the bus library now keeps documents across launches. |
| `fontSize` | `13` | Editor font size in px. |
| `lineWrapping` | `true` | Wrap long lines. (Superseded the Monaco-era `wordWrap` string param; old saved values are migrated.) |
| `tabSize` | `2` | Indent width in spaces. |
| `lineNumbers` | `"on"` | `"on"` \| `"off"` |
| `formatOnPaste` | `true` | Auto-format the buffer on paste. |

All params persist via `props.api.updateParameters` — they survive exoskeleton restarts.

## Initial value

On mount, `json-edit` reopens its last document (`documentId`) and makes it active, unless another panel already chose an active document, in which case it follows that one. Documents load from the persisted library shortly after launch and appear as they arrive.

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
- **No undo across reloads.** CodeMirror's undo stack is in-memory; restarting exoskeleton resets it. The current buffer is recovered from `json-bus` on mount, but prior edit history is gone.

## Install

Standard exoskeleton install protocol (see [library README](../README.md)). Additional step:

- Ensure `_shared/json-utils/` is NOT required by this panel (it isn't — only viewers need it). The editor depends on `@codemirror/{view,state,lang-json,language}`, the Tauri `fs`/`dialog` plugins (open/save of the backing file), and `src/data/json-bus.ts` from the exoskeleton core.

## Provenance

Adapted from [`halapenyoharry/json-visual-viewer`](https://github.com/halapenyoharry/json-visual-viewer) Editor.tsx on 2026-05-19. Theme verbatim. Editor options preserved as defaults; now all tunable via params.
