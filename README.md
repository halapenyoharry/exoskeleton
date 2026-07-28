# Exoskeleton

A cross-platform desktop workspace built on Tauri 2 and Dockview — structure you operate inside while you work. Not a tool you switch to; a chassis your tools live in. Targets macOS Apple Silicon and Linux.

Licensed under the **GNU Affero General Public License v3.0 or later** ([AGPL-3.0-or-later](LICENSE)).

---

## What's in the Box

A running Exoskeleton gives you:

- **Dockable Workspace Grid**: Drag, dock, tab, split, resize, and pop out panels into separate OS windows.
- **Workspaces (Schema v8)**: Create, rename, delete, switch between multiple named workspaces, export/import standalone `.exo.json` workspace documents, and open independent workspaces in separate OS windows.
- **Layout Presets**: Instantly switch or reset to curated workspace layouts (**Minimal**, **JSON Lab**, **AV Lab**, **Everything**).
- **Sixteen Built-in Panels**:
  - **Editor**: Markdown text editor with native file save/open.
  - **Terminal**: Real-shell terminal powered by xterm.js + `tauri-plugin-pty` with shell auto-resolution.
  - **Web Viewport**: In-app web browser viewport with URL bar for LAN services and docs.
  - **JSON Suite**: CodeMirror 6 JSON editor (featuring Midnight Alaska theme and file path persistence) feeding visualizers over an in-process `json-bus`:
    - **JSON Tree**: Interactive node inspector.
    - **JSON Circles**: SVG radial cluster visualization.
    - **JSON Mass**: Physics particle gravity simulation.
    - **JSON Cytoscape**: Network graph layout.
    - **JSON Graph**: Force-directed 2D graph.
    - **JSON Graph 3D**: Three.js 3D force graph.
    - **JSON Dyadic**: Category & dyadic link topology graph parser.
  - **AV Suite**:
    - **Tempo Clock**: Visual tempo & beat ticker.
    - **Piano**: Interactive web audio synthesizer keyboard.
    - **Oscilloscope**: Real-time Web Audio API frequency/waveform scope.
  - **Settings & Status Bar**: Raw JSON state inspector/editor in side-grid and status bar.
- **Fault-Tolerant Panel Error Boundaries**: Any uncaught JS error in a panel is caught safely, preserving the main workspace grid and offering **Retry** and **Close Panel** options.
- **Persistence & Auto-Save**: Debounced flush on state changes, window close, and app unload. Stored as schema v8 JSON in `~/Library/Application Support/dev.harold.exoskeleton/`.

---

## Stack

| Concern | Choice |
| --- | --- |
| Shell / Window | [Tauri 2](https://v2.tauri.app/) (Rust) |
| UI Framework | React 19 + TypeScript |
| Layout / Docking | [Dockview 6](https://dockview.dev) |
| Code Editor | [CodeMirror 6](https://codemirror.net/) (`@codemirror/lang-json`) |
| Terminal Frontend | [`@xterm/xterm`](https://www.npmjs.com/package/@xterm/xterm) v6 |
| Terminal Backend | [`tauri-plugin-pty`](https://github.com/Tnze/tauri-plugin-pty) via [`tauri-pty`](https://www.npmjs.com/package/tauri-pty) |
| Persistence | `@tauri-apps/plugin-store` + custom v8 schema migrator |
| Logging | `tauri-plugin-log` (unified Rust & JS logging) |
| License | GNU AGPL-3.0-or-later |

---

## Quick Start

### Prerequisites

- **Node.js**: 20+
- **Rust**: 1.77+
- **macOS**: Xcode Command Line Tools
- **Linux (Pop!_OS / Ubuntu)**: Tauri Linux dependencies (`libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`)

### Run Development Build

```bash
npm install
npm run tauri dev
```

### Build Production App

```bash
npm run build
npm test
npm run tauri build
```

---

## Workspaces & `.exo.json` Documents

Exoskeleton schema v8 introduces multi-workspace support and workspace document portable serialization.

- **Workspace Switcher**: Click the **⊞** button in the bottom floating toolbar to switch between saved workspaces, create new ones, rename, or delete.
- **Export / Import**: Save any workspace configuration as a portable `.exo.json` file to share or back up, and import `.exo.json` files seamlessly.
- **Multi-Window Workspaces**: Click **❐** next to any workspace to open it in a separate, independent OS window.

---

## Project Structure

```
exoskeleton/
├── .github/
│   └── workflows/ci.yml             GitHub Actions CI pipeline
├── src/                             React frontend
│   ├── App.tsx                      Main application manifest & workspace state coordinator
│   ├── PanelRoot.tsx                PanelErrorBoundary wrapper HOC
│   ├── ColoredTab.tsx               Tab glyph & accent stripe renderer
│   ├── Watermark.tsx                Empty workspace preset selector UI
│   ├── HeaderActions.tsx            Dockview tab header controls
│   ├── data/                        In-process data bus (json-bus)
│   ├── panels/                      Workspace panel implementations
│   │   ├── EditorPanel.tsx          Markdown editor
│   │   ├── TerminalPanel.tsx        xterm.js PTY terminal shell
│   │   ├── LanWebview.tsx           Web iframe viewport
│   │   ├── json-edit/               CodeMirror 6 JSON editor panel
│   │   ├── json-tree/               Tree view visualizer
│   │   ├── json-circles/            Radial cluster visualizer
│   │   ├── json-mass/               Physics mass visualizer
│   │   ├── json-cytoscape/          Cytoscape graph visualizer
│   │   ├── json-graph/              2D force graph visualizer
│   │   ├── json-graph3d/            3D Three.js graph visualizer
│   │   └── json-dyadic/             Category/dyadic topology graph visualizer
│   ├── persistence/                 Save/load, workspace storage v8 & presets
│   │   ├── storage.ts               AppStateV8 & Workspace schema definition
│   │   ├── workspace-file.ts        .exo.json document export/import validation
│   │   ├── presets.ts               Minimal, JSON Lab, AV Lab, Everything presets
│   │   ├── default-layout.ts        Default arrangement & applyWorkspaceState()
│   │   └── tauri-storage.ts         Tauri store adapter
│   └── utils/
│       └── debounce.ts              Debouncer with flush() & cancel()
├── src-tauri/                       Rust Tauri backend
│   ├── src/lib.rs                   Tauri plugins, open_workspace_window command
│   ├── capabilities/default.json    Tauri permissions (fs, dialog, pty, store, log)
│   ├── tauri.conf.json              Content Security Policy (CSP) & app config
│   └── Cargo.toml
├── docs/
│   ├── ship-plan.md                 Exoskeleton release plan
│   ├── SESSIONS.md                  Handoff & session execution log
│   └── signing.md                   macOS signing & notarization guide
├── LICENSE                          GNU AGPL-3.0-or-later license text
├── package.json
└── vite.config.ts
```

---

## Testing & Quality Assurance

Run the test suite locally:

```bash
npm test
```

This runs unit tests covering:
- Topology graph parsing & category mode determination
- Shell resolution (`resolveShell`)
- Auto-add panel migration rules (`panelsToAutoAdd`)
- Layout presets (`presets.ts`)
- Schema compatibility & v8 migration (`storage.ts`, `workspace.test.ts`)
- `.exo.json` workspace file serialization & parsing (`workspace-file.test.ts`)
- Debounce `.flush()` and `.cancel()` controls (`debounce.test.ts`)

---

## License

Exoskeleton is free software licensed under the **GNU Affero General Public License v3.0 or later** ([AGPL-3.0-or-later](LICENSE)).
