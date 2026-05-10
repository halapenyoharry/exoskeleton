# Exoskeleton

Cross-platform desktop workspace built on Tauri — structure you operate inside while you work. One window with three docked panels: a Markdown editor, a terminal that runs a real shell, and a webview for local-network services like ComfyUI on the lumen RTX 3090. Targets macOS (Apple Silicon) and Pop!_OS.

## Stack

| Concern | Choice |
| --- | --- |
| Shell / window | [Tauri 2](https://v2.tauri.app/) (Rust) |
| UI framework | React 19 + TypeScript |
| Layout / docking | [Dockview 6](https://dockview.dev) — drag, dock, tab, resize |
| Terminal frontend | [`@xterm/xterm`](https://www.npmjs.com/package/@xterm/xterm) v6 |
| Terminal backend | [`tauri-plugin-pty`](https://github.com/Tnze/tauri-plugin-pty) (wraps `portable-pty`) via [`tauri-pty`](https://www.npmjs.com/package/tauri-pty) JS bindings |
| Markdown editor | currently a textarea **(TODO: swap in [`@marktext/muya`](https://github.com/marktext/muya) when stable; npm 0.2.5 is flagged not-for-prod)** |
| File ops | `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog` |
| Webview | plain `<iframe>` with URL bar |

## Run

Prereqs: Rust 1.77+, Node 20+, on macOS Xcode CLT, on Pop!_OS the [Tauri Linux deps](https://v2.tauri.app/start/prerequisites/#linux).

```
npm install
npm run tauri dev
```

First run compiles the Rust deps — **5–15 min** depending on the box. Subsequent dev runs are fast.

For a production bundle:

```
npm run tauri build
```

## Layout

The app boots with three panels in a Dockview grid:

```
+-------------------------+----------------+
| editor (Markdown)       |                |
|                         |    webview     |
+-------------------------+   (LAN URL)    |
| terminal (xterm + pty)  |                |
+-------------------------+----------------+
```

You can drag panel headers to redock, split, tab, or resize. Dockview persists the runtime grid state in memory; persistence to disk is not wired yet.

## Source layout

```
exoskeleton/
├── src/                       <- React frontend
│   ├── App.tsx                   Dockview composition
│   ├── main.tsx                  React mount + global CSS
│   ├── theme.css                 dark cyan-tinted base
│   └── panels/
│       ├── EditorPanel.tsx       textarea + open/save via Tauri fs/dialog
│       ├── TerminalPanel.tsx     xterm wired to a real PTY
│       └── LanWebview.tsx        iframe with URL toolbar (LAN HTTP services)
├── src-tauri/                 <- Rust backend
│   ├── src/lib.rs                plugin registration (fs, dialog, pty, opener)
│   ├── tauri.conf.json           window + bundle config
│   ├── capabilities/default.json grants fs/dialog/pty permissions
│   └── Cargo.toml
├── docs/
│   └── patchbay-spec.md          (preserved earlier spec, unrelated to current build)
├── package.json
└── vite.config.ts
```

## Building with it

Exoskeleton starts empty. Tauri gives you an OS window. Inside the window is a WebView — a small embedded browser surface. React mounts inside the WebView. Dockview, a layout library, mounts inside React. At that moment you have a **grid** — a splittable canvas — and it has nothing in it.

What turns the empty grid into the three-panel workspace you actually see is one file: [src/App.tsx](src/App.tsx). It's the manifest. About 45 lines. Read it and you know what this app *is*.

Two things in that file matter.

**First, a map from names to React components:**

```ts
const components = {
  editor: EditorPanel,
  terminal: TerminalPanel,
  webview: LanWebview,
};
```

Three slots — `editor`, `terminal`, `webview`. The left side of each pair is the *role*. The right side is the *implementation* — the React component that fills the role. The role is stable; the implementation is swappable. That's why `WebviewPanel` could be renamed to `LanWebview` without changing anything else — the role kept its name and its mint accent color.

**Second, an `onReady` function** — what Dockview runs once the grid is mounted but still empty:

```ts
event.api.addPanel({ id: "editor", component: "editor", title: "editor" });
event.api.addPanel({ id: "webview",  ..., position: { referencePanel: "editor", direction: "right" } });
event.api.addPanel({ id: "terminal", ..., position: { referencePanel: "editor", direction: "below" } });
```

Three calls. The first fills the empty grid. The second cuts the grid in half side-to-side. The third splits the left half top-to-bottom. That's why you see the editor top-left, the terminal bottom-left, and the webview on the right.

### Adding a fourth thing

Say you want a notes pane, a file tree, a chart, a JSON viewer — anything. The recipe is two edits to [src/App.tsx](src/App.tsx):

1. Add an entry to the `components` map: `notes: NotesPanel`.
2. Add an `addPanel` call in `onReady`, telling Dockview where to put it.

The component itself comes from one of three places, in increasing order of effort:

- **npm.** `npm install some-react-component`, import it, drop it in the map. No panel code of your own.
- **Your own file** under [src/panels/](src/panels/), modeled on the existing three. Use this when nothing on npm fits, or when you want close control.
- **A Tauri plugin**, if the thing needs to reach outside the WebView — filesystem, OS notifications, subprocesses, native dialogs. Plugins are registered in [src-tauri/Cargo.toml](src-tauri/Cargo.toml) and granted permission in [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json). Today's four plugins (`fs`, `dialog`, `opener`, `pty`) are why the editor can save files and the terminal can run a real shell.

### Before writing a fourth panel, ask three questions

Exoskeleton runs on a small budget on purpose: three panel slots, three accent colors. New panels have to earn the slot.

- **Does it have continuous state?** A panel persists across focus switches and coffee breaks — an open file, a shell session, a loaded URL. If the thing only matters while you're looking at it, it's a modal, not a panel.
- **Is it a distinct mode of work?** Text editing is one mode. Shell is another. Live remote rendering is a third. A second terminal isn't a new mode — it's a tab inside the existing `terminal` panel.
- **Is there a color slot for it?** Cyan, amber, mint. All three are taken. The accent in your peripheral vision is how you know which mode you're in without looking carefully. A fourth color dilutes that. The right question is usually "is one of the three wrong?", not "should there be a fourth?"

Pass all three and the thing earns its own panel. Pass two and it's a tab inside an existing one. Pass one and it's a modal — a thing that opens, does its job, and closes.

### The manifest in one sentence

If you ever want to know what Exoskeleton *is*, three files answer that:

| File | What it tells you |
| --- | --- |
| [src/App.tsx](src/App.tsx) | which panels exist and how they're arranged |
| [package.json](package.json) | what React-side parts are available to wire up |
| [src-tauri/Cargo.toml](src-tauri/Cargo.toml) | what system powers the app has |

Everything else is implementation detail behind one of those three.

(A note on format: today the manifest is TypeScript. Dockview can serialize the runtime layout to JSON via `api.toJSON()` and restore it via `api.fromJSON()` — so when Exoskeleton grows layout persistence, "where you left your panels last time" will live as JSON on disk, while *which panels are even possible* will keep living as code in `App.tsx`.)

## Known caveats

- **Muya not yet integrated.** Editor uses a plain textarea. Muya 0.2.5 on npm is the latest published version and is flagged "not for production." Path forward: either pin to a known-good fork, run from the GitHub master branch, or swap to a maintained alternative (Milkdown / Lexical / CodeMirror+remark). The editor's open/save plumbing is independent of the editor surface, so swapping is mechanical.
- **First Rust compile is slow.** Tauri pulls a large dep graph. Expect 5–15 min on first `npm run tauri dev`; future incremental rebuilds are fast.
- **Default webview URL** is `http://lumen.local:8188` (ComfyUI on the RTX 3090). Edit the URL bar to point anywhere else.
- **Webview is an iframe**, not a native child webview. iframes can't observe HTTPS-only or X-Frame-Options-deny pages. For LAN HTTP services (ComfyUI, Open WebUI, Cockpit) this works fine. If you need one of those rejected, switch to Tauri's `WebviewWindow::new` for a native child surface.
- **Cross-platform compile** is tested on macOS only in this scaffold. The same source should `cargo tauri build` on Pop!_OS once `webkit2gtk-4.1` and friends are installed (see Tauri prerequisites).
