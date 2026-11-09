# Exoskeleton: notes for AI coding agents

Public, project-only guidance for agents (and the people running them) who work in this repository. Maintainers may keep a private `AGENTS.md` beside this file; git ignores it.

## What this is

A workspace you work inside: one window of docked panels (Dockview) for writing, a JSON document with many views of it, instruments, a whiteboard, and a webview for local HTTP services. It is web-first: the Vite build runs in a browser on desktop and phone. A Tauri 2 desktop shell exists but is not tested for the current version; don't use it to verify changes.

## Stack

- React 19 + TypeScript, built with Vite 7
- Dockview 8 for panels, groups, tabs and edge groups
- CodeMirror 6 (the JSON document), d3, Cytoscape.js, three.js, cosmos.gl (GPU graph), tldraw (whiteboard)
- Tauri 2 shell with `@xterm/xterm` + a PTY plugin for the terminal (desktop only)

## Run and check

```
npm install
npm run dev          # http://localhost:3805, bound to all interfaces
npx tsc --noEmit
npm test             # node:test over src/**/*.test.ts
npm run build        # static site in dist/
```

The dev server uses a fixed port (`strictPort`). If 3805 is taken, start a second server with `npx vite --port <free port> --strictPort`.

Verify UI changes in a real browser, including a phone-sized viewport (about 400px wide). Headless Chrome through `playwright-core` works well for this.

## How the app is put together

- **Panels** live in `src/panels/<id>/`, each with a manifest (`PanelManifest`, [src/panel-manifest.ts](src/panel-manifest.ts)) and a short README.
- **Registration:** a panel appears once it is in the `components` map in [src/App.tsx](src/App.tsx) and in `panelRegistry` in [src/persistence/default-layout.ts](src/persistence/default-layout.ts). The registry feeds the ⊞ menu, the + picker and the Everything preset.
- **Controls panes and header actions** are declared in `src/chrome/panes/<id>.panes.ts` and imported in [src/chrome/panes/index.ts](src/chrome/panes/index.ts).
- **The document:** `json-edit` lives in the left edge group, not in the grid. Viewers read the current document from the json-bus ([src/data/json-bus.ts](src/data/json-bus.ts)) through `useJsonDoc`, which holds updates back while a tab is hidden.
- **Graph viewers** share one cached detector (`getDetectedGraph` in [src/data/json-utils/docStats.ts](src/data/json-utils/docStats.ts)). It fills only `id`, `label`, `kind`, `attrs` and `data` on each node, so read colors, sizes and categories from `attrs` and `data`.
- **Selection and focus** go between viewers over the channels in `src/osc/channels/` (`broadcastNodeSelection`, `broadcastNodeFocus`). The status bar shows the selected node.

### Adding a panel

1. Create a folder `src/panels/<id>/` with the component, CSS, `manifest.ts` and `README.md`.
2. Load heavy panels lazily: in `App.tsx`, add a `lazy(() => import(...))` and wrap it with `lazyPanel(...)`.
3. Add a `panelRegistry` entry with `introducedAt` set to the current `CURRENT_VERSION` ([src/persistence/storage.ts](src/persistence/storage.ts)). Don't bump `CURRENT_VERSION` for a panel that is not auto-added: a bump makes saved layouts unreadable to older builds.
4. Give the tab an accent and a glyph: `accents` and `glyphs` in [src/ColoredTab.tsx](src/ColoredTab.tsx), and `--accent-<id>` in [src/App.css](src/App.css).
5. Optionally add a panes file, imported in `src/chrome/panes/index.ts`.
6. Pin new npm dependencies to exact versions, and list them in the manifest's `npmDependencies`.

The `tldraw` and `json-cosmos` panels are recent, complete examples.

## Conventions

- **Add beside, don't replace.** A new way of seeing something becomes a new panel or option next to the existing ones. Don't silently change defaults or remove a view.
- **No runtime calls to third-party hosts.** Bundle fonts, icons and other assets; for example, the tldraw panel serves tldraw's assets through `@tldraw/assets/imports.vite` instead of its CDN.
- **GPU-heavy panels** pause and stop their render loop while their tab is hidden, and release their WebGL context on unmount.
- **Keep the invariants** listed in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ship-plan.md](docs/ship-plan.md); each fixes a real bug.
- **Use Dockview's own vocabulary** (panel, group, tab, edge group, sash, header actions). When something has no name there, describe it plainly and ask a maintainer before inventing one.
- **Ask a maintainer before** changing the Dockview composition in `App.tsx`, renaming files, adding UI that is not Dockview, or adding new backend technology.
- **Leave a handoff.** At the end of a working session, append a dated entry to [docs/SESSIONS.md](docs/SESSIONS.md): state, what was done, what is next.

## Where to read first

1. [docs/SESSIONS.md](docs/SESSIONS.md): the bottom entry is the current state.
2. [README.md](README.md)
3. [docs/AGENTS-FAQ.md](docs/AGENTS-FAQ.md): recurring design questions, answered in test-case shape.
4. [docs/panel-capability-map.md](docs/panel-capability-map.md): what each panel needs from its host.

## Licenses

Exoskeleton is AGPL-3.0-or-later. Third-party panels keep their own licenses: cosmos.gl is MIT, and tldraw is source-available (production deployments need a tldraw license key; see [src/panels/tldraw/README.md](src/panels/tldraw/README.md)).
