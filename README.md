# HUD

Cross-platform desktop workspace built on Tauri. One window with three docked panels — a Markdown editor, a terminal that runs a real shell, and a webview for local-network services like ComfyUI on the lumen RTX 3090. Targets macOS (Apple Silicon) and Pop!_OS.

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
hud/
├── src/                       <- React frontend
│   ├── App.tsx                   Dockview composition
│   ├── main.tsx                  React mount + global CSS
│   ├── theme.css                 dark cyan-tinted base
│   └── panels/
│       ├── EditorPanel.tsx       textarea + open/save via Tauri fs/dialog
│       ├── TerminalPanel.tsx     xterm wired to a real PTY
│       └── WebviewPanel.tsx      iframe with URL toolbar
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

## Known caveats

- **Muya not yet integrated.** Editor uses a plain textarea. Muya 0.2.5 on npm is the latest published version and is flagged "not for production." Path forward: either pin to a known-good fork, run from the GitHub master branch, or swap to a maintained alternative (Milkdown / Lexical / CodeMirror+remark). The editor's open/save plumbing is independent of the editor surface, so swapping is mechanical.
- **First Rust compile is slow.** Tauri pulls a large dep graph. Expect 5–15 min on first `npm run tauri dev`; future incremental rebuilds are fast.
- **Default webview URL** is `http://lumen.local:8188` (ComfyUI on the RTX 3090). Edit the URL bar to point anywhere else.
- **Webview is an iframe**, not a native child webview. iframes can't observe HTTPS-only or X-Frame-Options-deny pages. For LAN HTTP services (ComfyUI, Open WebUI, Cockpit) this works fine. If you need one of those rejected, switch to Tauri's `WebviewWindow::new` for a native child surface.
- **Cross-platform compile** is tested on macOS only in this scaffold. The same source should `cargo tauri build` on Pop!_OS once `webkit2gtk-4.1` and friends are installed (see Tauri prerequisites).
