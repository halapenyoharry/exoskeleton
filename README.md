# Exoskeleton

A cross-platform desktop workspace built on Tauri 2 — structure you operate inside while you work. Not a tool you switch to; a chassis your tools live in. Targets macOS Apple Silicon and Pop!_OS.

This README is the all-in-one fork-and-build guide. If you want to make your own desktop workspace by editing Exoskeleton, this is the entry point.

## What's in the box

A running Exoskeleton gives you:

- A **main grid** of panels you can drag, dock, tab, split, resize, and pop out into separate OS windows.
- A **side-grid** (toggleable with **⌘B** / **Ctrl+B**) for app-level controls — currently a raw-JSON state editor.
- Sixteen panels (14 in the default layout, plus the Cmd+B settings panel and the status bar): a Markdown editor, a real-shell terminal, an iframe webview for LAN HTTP services, a tempo clock, a piano, an oscilloscope, and the JSON suite — a Monaco editor feeding seven visualizers over an in-process json-bus.
- **Persistence**: panel arrangement, panel state (open file, webview URL, etc.), and preferences survive close + reopen. Stored as a single JSON file in `~/Library/Application Support/dev.harold.exoskeleton/`.
- **Drag-and-drop**: rearrange tabs, split groups, tear groups out into floating or popout OS windows.
- **WebKit Inspector**: auto-opens in debug builds, for diagnosing layout or JS issues.
- **Unified logging**: Rust and JS log calls converge to one file in the OS log dir.

## Stack

| Concern | Choice |
| --- | --- |
| Shell / window | [Tauri 2](https://v2.tauri.app/) (Rust) |
| UI framework | React 19 + TypeScript |
| Layout / docking | [Dockview 6](https://dockview.dev) |
| Terminal frontend | [`@xterm/xterm`](https://www.npmjs.com/package/@xterm/xterm) v6 |
| Terminal backend | [`tauri-plugin-pty`](https://github.com/Tnze/tauri-plugin-pty) via [`tauri-pty`](https://www.npmjs.com/package/tauri-pty) |
| Markdown editor | textarea (TODO: muya — see Known caveats) |
| File ops | `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog` |
| Webview | plain `<iframe>` with URL bar |
| Persistence | `@tauri-apps/plugin-store` |
| Logging | `tauri-plugin-log` (Rust + JS unified) |

## Run

Prereqs: Rust 1.77+, Node 20+, on macOS Xcode CLT, on Pop!_OS the [Tauri Linux deps](https://v2.tauri.app/start/prerequisites/#linux).

```
npm install
npm run tauri dev
```

First compile is **5–15 min**; subsequent runs ~5 sec.

For a production bundle:

```
npm run tauri build
```

## How it's put together

Exoskeleton starts empty. Tauri gives you an OS window. Inside the window is a WebView — a small embedded browser surface. React mounts inside the WebView. Dockview, a layout library, mounts inside React. At that moment you have a **grid** — a splittable canvas — and it has nothing in it.

What turns the empty grid into the workspace you see is one file: [src/App.tsx](src/App.tsx). It's the manifest. Read it and you know what this app *is*.

### The manifest

Two things in `App.tsx` matter.

**First, a map from names to React components:**

```ts
const components = {
  editor: EditorPanel,
  terminal: TerminalPanel,
  webview: LanWebview,
};
```

The left side of each pair is the *role*. The right side is the *implementation* — the React component that fills the role. The role is stable; the implementation is swappable. That's why `WebviewPanel` could be renamed to `LanWebview` without changing anything else — the role kept its name and color.

**Second, an `onReady` function** — what Dockview runs once the grid is mounted but empty:

```ts
event.api.addPanel({ id: "editor", component: "editor", title: "editor" });
event.api.addPanel({ id: "webview",  ..., position: { referencePanel: "editor", direction: "right" } });
event.api.addPanel({ id: "terminal", ..., position: { referencePanel: "editor", direction: "below" } });
```

Three calls. The first fills the empty grid. The second cuts the grid side-to-side. The third splits the left half top-to-bottom. The arrangement that results is the one you see on first launch. (`direction: "within"` is also available — it adds a panel *as a tab inside an existing group* rather than splitting.)

### Forking it: adding your own panel

The recipe is two edits to [src/App.tsx](src/App.tsx):

1. Add an entry to the `components` map: `notes: NotesPanel`.
2. Add an `addPanel` call in `onReady` telling Dockview where to put it.

The component itself comes from one of three places, in increasing order of effort:

- **npm.** `npm install some-react-component`, import it, drop it in the map.
- **Your own file** under [src/panels/](src/panels/), modeled on the existing panels.
- **A Tauri plugin**, if the thing needs to reach outside the WebView — filesystem, notifications, subprocesses, system dialogs. Plugins are registered in [src-tauri/Cargo.toml](src-tauri/Cargo.toml) and granted permission in [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json). Today's plugins (`fs`, `dialog`, `opener`, `pty`, `store`, `log`) are why the editor can save files, the terminal runs a real shell, layouts persist, and logs land in one place.

### Three rules for when a new thing earns a panel

Panels are first-class citizens, not afterthoughts. Before adding another one, ask:

- **Does it have continuous state?** A panel persists across focus switches and coffee breaks — an open file, a shell session, a loaded URL. If the thing only matters while you're looking at it, it's a modal, not a panel.
- **Is it a distinct mode of work?** A second terminal isn't a new mode — it's a tab inside the existing `terminal` panel.
- **Is there a color slot for it?** The accent in peripheral vision is how the user knows which mode they're in without focused attention. Adding accents indefinitely dilutes that; the right question is usually "should I retire one of the four?", not "should I add a fifth?"

Pass all three and the thing earns its own panel. Pass two and it's a tab inside an existing one. Pass one and it's a modal.

### The schema/state split

Two strict rules that keep things organized:

1. **Schema lives in code.** What panels are *possible*, what colors they get, what their default arrangement is — that's in `App.tsx` and the panel component files.
2. **State lives in one JSON file.** What's *currently* arranged, what each panel currently holds, what preferences are set — that's a single JSON in the OS app-data dir.

State is always a delta on top of schema. Forking the schema (adding a panel) doesn't break existing users' state. Resetting is one operation: delete the state file.

| File | What it tells you |
| --- | --- |
| [src/App.tsx](src/App.tsx) | which panels exist and the default arrangement |
| [package.json](package.json) | what React-side parts are available |
| [src-tauri/Cargo.toml](src-tauri/Cargo.toml) | what system powers the app has |
| `~/Library/Application Support/dev.harold.exoskeleton/exoskeleton.json` | the current user state on disk |

### The side-grid

Beyond the main grid, Exoskeleton has a **side-grid** — a separate Dockview instance that lives on the left side of the window. Toggleable with **⌘B** (or **Ctrl+B**). Hidden by default.

The side-grid is where *controls* live — things that operate *on* the workspace rather than being content of it. Today it holds one panel: a raw JSON editor showing the current app state. Tomorrow it can hold themes, command palettes, debug logs, anything you'd typically put in a sidebar.

The main grid and the side-grid are **peers**: two independent Dockview instances in the same window. They have their own state, their own drag-and-drop scope (you can't drag a tab across the boundary), and their own visibility. They share the same persistence file under separate keys.

The side-grid lives in [src/sidegrid/](src/sidegrid/) — `SideGrid.tsx` is the mini-Dockview wrapper, `SettingsPanel.tsx` is the JSON editor inside it.

### Chrome customization

Dockview has five places where you can replace the default rendering:

| Slot | What it controls | Where in this codebase |
| --- | --- | --- |
| `defaultTabComponent` | What a tab looks like | [ColoredTab.tsx](src/ColoredTab.tsx) — glyph + accent color via CSS variable |
| `watermarkComponent` | What's shown when the grid is empty | [Watermark.tsx](src/Watermark.tsx) for main, [SideGridWatermark.tsx](src/sidegrid/SideGridWatermark.tsx) for side |
| `prefixHeaderActionsComponent` | The bar *before* the tabs | [HeaderActions.tsx](src/HeaderActions.tsx) — a glowing accent dot |
| `leftHeaderActionsComponent` | The bar *after* the tabs, on the left | [HeaderActions.tsx](src/HeaderActions.tsx) — `+` button that adds a tab of the same kind |
| `rightHeaderActionsComponent` | The bar on the right of the header | [HeaderActions.tsx](src/HeaderActions.tsx) — `⤴` popout + `⨯` close-group |

There's no single `headerComponent` slot in Dockview. A fully custom header is built by composing the four slots above with custom `tabComponents`.

### Persistence

State is saved automatically. Every time a panel is dragged/closed/resized, the active panel changes, a panel's parameters change, or the side-grid visibility flips, Exoskeleton debounces 400ms and writes to:

```
~/Library/Application Support/dev.harold.exoskeleton/exoskeleton.json
```

The JSON has:
```json
{
  "version": 7,
  "layout": { /* Dockview toJSON() of the whole dock (main grid + edge groups) */ },
  "preferences": { }
}
```

(Schema v3 folded the old separate `sideGrid` blob and `preferences.sideGridVisible` into the single `layout`; the settings side-grid is now a Dockview edge group inside it.)

`version` tracks the schema — when it changes incompatibly, increment `CURRENT_VERSION` in `storage.ts` and write a migration (`migrateSavedLayout` rewrites the saved blob before `fromJSON`; `migrateLayout` adds panels the save predates; `repairLayout` rescues pathological saves, e.g. panels absorbed into an edge group). Mismatched-version state falls back to defaults silently (with a console warning).

**To reset to defaults**: delete `exoskeleton.json` and relaunch.

The persistence layer in [src/persistence/](src/persistence/) is split into three small files so it's portable:
- `storage.ts` — environment-agnostic interface + `AppState` type.
- `tauri-storage.ts` — Tauri adapter (today).
- `default-layout.ts` — the default panel arrangement.

To run Exoskeleton in a browser or VSCode webview later, write `web-storage.ts` (localStorage / IndexedDB) or `vscode-storage.ts` (webview message passing → `globalState`), branch in `App.tsx` to pick the adapter at runtime, and the rest of the code doesn't know which backend it's talking to.

### Multi-window

Click the **⤴** button in a group's header to pop that group out into its own OS-level window. The panels keep their content; they're now in a separate Tauri WebviewWindow you can move, resize, or close independently. Closing the popout returns the panels to the main grid.

Each popout window is its own React tree. The hypergraph architecture this points at — treating *both* OS windows and UI groups as edges of the same hypergraph, with revision-gated IPC for cross-window state sync — is described in [docs/Dockview Tauri Hypergraph JSON.md](docs/Dockview%20Tauri%20Hypergraph%20JSON.md). Today's implementation is simpler — single state file, no IPC — but the file format leaves room to grow into the unified approach when popout windows hold panels that need to share live state.

### Debugging

Three places to look when something's wrong:

| Where | What's there |
| --- | --- |
| WebKit Inspector | Auto-opens in debug builds (see [src-tauri/src/lib.rs](src-tauri/src/lib.rs)). Elements + Console + Sources. |
| `~/Library/Logs/dev.harold.exoskeleton/` | Log file from `tauri-plugin-log`. Contains both Rust-side and JS-side log calls. |
| The `npm run tauri dev` terminal | stdout from Rust + Vite + JS console combined. |

To log from JS:
```ts
import { info, warn, error } from "@tauri-apps/plugin-log";
info("layout restored from disk");
```
The output appears in all three places.

### The structure is self-similar

A panel's content is just a React component. A React component can render anything — including a whole `DockviewReact` of its own. Which means one panel can contain its own grid, with its own groups, with its own panels. Each of *those* panels can do the same. The hierarchy is fractal:

```
window
  └─ grid
      └─ groups
          └─ panels
              └─ (each panel's content can be) → another whole DockviewReact
                                                   └─ grid
                                                       └─ groups
                                                           └─ panels ...
```

Same shape at every level, no architectural depth limit — only the practical one of whoever's reading the screen. Each nested Dockview is its own world: independent state, independent drag-and-drop scope, independent layout to persist. You can't drag a tab across the boundary between an outer grid and an inner one; they're peers in topology, not in interaction. Useful when one panel needs to *be* a self-contained mini-workspace (a lab, a scratchpad, a portable mini-IDE). Wrong when you just want more splits — those belong to the outer grid as more groups, not as a nested instance.

## Source layout

```
exoskeleton/
├── src/                            <- React frontend
│   ├── App.tsx                        the manifest — composes main grid + side-grid
│   ├── ColoredTab.tsx                 custom tab: glyph + accent color
│   ├── Watermark.tsx                  main-grid empty state
│   ├── HeaderActions.tsx              prefix/left/right header-action components
│   ├── panels/                        main-grid panel components
│   │   ├── EditorPanel.tsx               textarea + open/save via fs/dialog
│   │   ├── TerminalPanel.tsx             xterm + PTY
│   │   └── LanWebview.tsx                iframe with URL toolbar
│   ├── sidegrid/                      side-grid (the Cmd+B controls area)
│   │   ├── SideGrid.tsx                  the side-grid's DockviewReact
│   │   ├── SettingsPanel.tsx             raw JSON state editor
│   │   └── SideGridWatermark.tsx         side-grid empty state
│   └── persistence/                   state save/load layer
│       ├── storage.ts                    interface + AppState type
│       ├── tauri-storage.ts              Tauri adapter
│       └── default-layout.ts             default panel arrangement
├── src-tauri/                      <- Rust backend
│   ├── src/lib.rs                     plugin registration + setup (devtools auto-open)
│   ├── tauri.conf.json                window + bundle config (dragDropEnabled: false)
│   ├── capabilities/default.json      fs / dialog / pty / store / log permissions
│   └── Cargo.toml
├── docs/
│   ├── SESSIONS.md                    append-only handoff log
│   ├── dockviewtips1.md               accumulated Dockview gotchas
│   └── Dockview Tauri Hypergraph JSON.md  long-form architecture research
├── CLAUDE.md                       project context for Claude (reading guide + don't-touch list)
├── README.md                       (this file)
├── package.json
└── vite.config.ts
```

## Known caveats

- **Muya not yet integrated.** Editor uses a plain textarea. Muya 0.2.5 on npm is the latest published version and is flagged "not for production." Path forward: pin a fork, run from master, or swap to a maintained alternative (Milkdown / Lexical / CodeMirror+remark). The editor's open/save plumbing is independent of the editor surface, so swapping is mechanical.
- **First Rust compile is slow.** Tauri pulls a large dep graph. Expect 5–15 min on first `npm run tauri dev`; future incremental rebuilds are fast.
- **Default webview URL** is `https://dockview.dev` (the docs site for the layout library Exoskeleton wraps). Change `DEFAULT_WEBVIEW_URL` in [src/persistence/default-layout.ts](src/persistence/default-layout.ts) to set a different first-launch default, or just edit the URL bar.
- **Webview is an iframe**, not a native child webview. iframes can't observe `X-Frame-Options`-deny pages. For LAN HTTP services (ComfyUI, Open WebUI, Cockpit, etc.) and most docs sites this works fine. If you need an embed-rejected site, switch to Tauri's `WebviewWindow::new` for a native child surface.
- **OS-level file drop is disabled.** Tauri's native file-drop listener was intercepting Dockview's HTML5 drag-and-drop on macOS WKWebView (the green-plus cursor of doom). Re-enabling it requires intercepting `dragover` at the React level to set `dataTransfer.dropEffect = "move"` for Dockview-originating drags. See [docs/dockviewtips1.md](docs/dockviewtips1.md).
- **Cross-platform compile** is tested on macOS only. The same source should `cargo tauri build` on Pop!_OS once `webkit2gtk-4.1` and friends are installed (see Tauri prerequisites).

## What's not yet built

- A custom Tauri titlebar (currently uses native macOS chrome).
- Per-group tab position preferences (top / bottom / left / right). Dockview supports these natively; not yet exposed to the user.
- Transparent-on-hover tab chrome (a design choice noted but not implemented).
- New-tab-goes-left-of-active ordering.
- A friendlier preferences UI than the raw JSON editor.
- Undo/redo across layout changes (the JSON format leaves room).
- Multi-window state sync via revision-gated IPC (will become necessary when popout windows hold panels that mutate shared state — currently they don't, because state is single-process).
- A non-Tauri build target (web / VSCode webview). The persistence layer is split to make this slot-in.
