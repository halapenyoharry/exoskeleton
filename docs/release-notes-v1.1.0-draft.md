# Exoskeleton v1.1.0 — Dockview 8, the document edge, and a web build

Since v1.0.0 (2026-07-29) the app went from a desktop-only Tauri workspace to a web-first one that also builds for Tauri: it ships to exo-skeleton.org as a PWA, works on a phone, and keeps the desktop grid intact. The JSON document moved out of the grid into a left edge group that also holds Settings and the menu, and every panel's controls are now rendered with Dockview primitives (Paneview panes, a nested Dockview for control tabs, header actions) instead of custom chrome. Seven panels were added: text-viewer, topology-extract, json-graph3d-inspect, json-attention, and the five-panel procedural-visuals suite (control, manifold, balls, fountain, recursive). A bundled library of twelve graph documents, including two books, ships with the app. Dockview was upgraded from 6.0.5 to 8.6.0 and the package version now reads 1.1.0 (it was still 0.1.0 under the v1.0.0 tag).

## Highlights

- Dockview 6.0.5 → 8.6.0; React bindings move to `dockview-react`; GitHub Dark via the `theme` prop (e5f997f).
- The JSON document is a left edge group, not a grid panel: `document-edge`, ⌘J, collapses to a vertical strip (7730801); the same edge group now holds Settings and the menu as tabs, opened with ⌘B / ⊞ (c7bb4ef).
- All custom pane chrome (capsule tab, pull-down drawer, slim toolbar row) removed; declared controls render as a Paneview inside a Splitview, with a "Controls" pane whose body is a nested locked Dockview, one tab per declared control set (b163c14, 6933037).
- Web-first runtime: web storage parity with exo-skeleton.org, PWA manifest, icons and service worker, `npm run ship:web` plus a GitHub Action deploying to exo-skeleton.org (d5db440, 16b1069).
- Phone layout (≤600px, web): grid by default with tap-to-maximize, an opt-in deck mode (one panel full screen, panels as a scrollable tab row), two layouts per workspace reconciled on width change, back gesture absorbed (33987d7, 02d5660).
- New panels: text-viewer (f40113e), topology-extract (1c68831), procedural-visuals suite (b91ec7a), json-graph3d-inspect (694ff7f), json-attention (7f2abda).
- The two in-process buses are unified: json-bus is now OSC + a retainer, with typed channels (selection, focus, active-doc, connected) and the document as the only exception (0d63925).
- Bundled graph library: ten fixture documents (5783be1) plus two books from the information2topology pipeline (69aa086, 3bea1a4) and the Exoskeleton system map as a TopoDocument (0dcae49).

## Panels

### New panels

- **text-viewer** — read-only document flow for the loaded graph with Markdown rendering (`react-markdown`), two-way selection sync with the 2D/3D graph panels (f40113e). Follows the active document (4f0fe88).
- **topology-extract** — entry point of the i2t funnel: sends text to a model (OpenRouter wired; Ollama and iterative extraction added later) and pushes the resulting TopoDocument onto the bus; editable system prompt persisted in panel params (1c68831, 27f4276, f0d703f). Schema v9.
- **procedural-visuals suite** — five OSC-driven panels: `procedural-visuals-control` (Eurorack-style controls), `procedural-visuals-manifold` (3D surfaces with GLSL shaders), `-balls`, `-fountain`, `-recursive`; `SuiteManifest` engine for multi-panel suites; `procedural-lab` preset (b91ec7a). Schema v10. The manifold panel was rebuilt without its iframe and CDN imports, renamed from `topological`, and its emoji glyphs replaced (78cec9c).
- **json-graph3d-inspect** ("3D-Inspect") — a copy of json-graph3d built for reading: text-sprite nodes, colors per i2t category, transparent containment hulls, degree-driven size, inline edge labels (694ff7f). Round two: along-edge labels, predicate labels on relation nodes, hub size exaggeration, legend off by default, hulls refit from a rAF loop so they no longer vanish on zoom (9a47acf). Schema v11.
- **json-attention** — Rapier 2D rigid-body field over the loaded graph: mass from incident edge weight, an attention token walking edges and making the paths it takes heavier; canvas renderer with pan/zoom/drag; selection and focus synced over the bus (7f2abda; merged 33d8ae2).

### Changed panels

- **json-edit** — Library submenu with the bundled documents (9feaf85); the ≡ menu is the first cell of its "Document" control set (db02db3); document name shown as a text cell / chip (02d5660, c7bb4ef); republishes restored text on load (426e307); republishes the system map when the bus is empty under JSON Lab (02d5660).
- **editor** — open/save/save as as a declared control set ("File" pane); status line moved into the content (c834e31, c7bb4ef).
- **json-graph3d** — root-cause fix for empty "always" labels: TopoThink spokes carry `role`, not `label` (694ff7f).
- **json-graph3d-inspect** and **json-dyadic** — `edge-as-node` rows are treated as relations for category, color and containment (ddb51be).
- **json-dyadic** — defaults to the first layer; layer select moved into declared controls (4f0fe88, 045b3e9).
- **json-tree**, **json-mass**, **text-viewer** — follow the active document; json-tree fits to view (4f0fe88, 02d5660).
- **json-graph**, **json-cytoscape**, **json-tree**, **json-circles**, **json-mass**, **json-graph3d(-inspect)** — fit/reset actions and parameter controls declared as panes (6afbdf1, c834e31).
- **menu** (⊞) — was a floating group (de549c1); now a tab in the left edge group titled "Exo-skeleton" (c7bb4ef, 536e102).
- **settings** — scrim sliders removed with the chrome they controlled (9755088); now a left edge tab (c7bb4ef).
- **blank** — the group "+" header action adds a blank picker panel that replaces itself in place; Alt-click keeps the old clone (9feaf85).
- **status-bar** — compact on phones; hidden in deck mode and restored with the grid (4f0fe88, ab242b5).

## Layout and chrome

- **Dockview 8.6.0** (e5f997f): `dockview` is a core re-export, React components come from `dockview-react`; `onDidActivePanelChange` now yields `{panel, origin}`; floating and popout entries may carry `grid` instead of `data`, tolerated in deck, document-edge and transient-strip code.
- **Tabs** are Dockview's default tab with accent and glyph; the capsule tab, pull-down controls, slim toolbar row, pane-chrome state and scrim settings are gone (b163c14, 9755088).
- **Controls as Paneview/nested Dockview**: declared controls render as a vertical Splitview whose top cell is a Paneview holding a title pane (edge panels) and a "Controls" pane; the Controls body is a nested locked Dockview (no dnd, no floating) with one tab per declared control set plus a "Pane" tab (window / move / follow / accent / about); tab-group chips when a declaration asks for one (none does yet); active tab and fold state persist in params (6933037, 7b83f6f, d4ab97c). Snapping the top cell away on the sash shows a ▤ "Show controls" button in the left header-actions slot (6933037).
- **Document edge group** (`document-edge`, left): holds `json-edit`; ⌘J, ⊞ → Document, or clicking the collapsed strip toggles it; size and collapsed state persist per grid and deck (7730801). Header is always Dockview's left vertical tab strip, read bottom-to-top, which also fixed the group shrinking to nothing on collapse under 8.x (d4ab97c, 0e411d4, d519236). Tab title follows the document via `api.setTitle` (ae7e708).
- **Settings and menu as edge tabs**: the left edge group holds JSON Edit, Settings and Exo-skeleton (menu); ⌘B and ⊞ toggle them; the right edge, the floating ⊞ button and the floating menu group are removed (c7bb4ef, 205adaa, 536e102, 68f83fd).
- **Header actions**: the ≡ menu and pane action buttons render in Dockview's left header-actions slot; the separate header-actions declaration machinery was removed in favour of panes (c7bb4ef).
- **Stacking**: every panel is its own stacking context (`isolation: isolate`) so panel-internal z-index can never cover the tab row (4d00479).
- **useElementSize** re-measures hidden-at-mount and late-mounted targets, which fixed viewers that never drew (c31cf93, 9feaf85).
- Intermediate chrome iterations between 2026-10-10 and 2026-10-13 (pill tabs a0aa378, drawer and strip registry 4394ad2, menu/toolbar/control-panel kinds e295a05, select cell 045b3e9) were superseded by the Dockview-primitive rewrite above; their declarations survive as `manifest.panes`.

## Web and mobile

- **Web-first pivot** (8fb55b7, d5db440): web storage key `exoskeleton_web_state_v8_1` for parity with exo-skeleton.org; blank web default and web presets; `VITE_WEB_DEFAULT_PRESET` picks the first-run preset per deploy (91b4a0d).
- **PWA**: `public/manifest.webmanifest`, icons, hand-written `sw.js`, safe-area padding (d5db440).
- **Ship**: `npm run ship:web` (wrangler pages deploy) and `.github/workflows/ship-web.yml`; `public/_headers` (16b1069). GitHub Pages landing page with Actions deploy and `.nojekyll` (6ffd4dd, 0a9ed7a). README points to exo-skeleton.org (d9ecc55).
- **Phone grid** (≤600px): grid by default, tap the active tab to maximize and again to restore, pop-out hidden, narrow JSON Lab arrangement (json-edit on top, viewers two per row) (02d5660).
- **Deck mode** (opt-in via ⊞): one panel full screen, all panels as a 44px scrollable tab row; `layout` and `mobileLayout` per workspace reconciled on width change (`src/persistence/deck.ts`); back gesture closes menus and open controls first, then returns to the previous panel (33987d7, ab242b5).
- **Document sheet on phones**: the document edge is a full-width sheet over the grid, collapsed to a 44px strip, closed first by the back gesture (7730801).
- **Watermark**: scrollable on phones, single-column presets, 44px targets (67ea996, 7d1cc60, fa659c1).
- Browser-safe file I/O (`src/utils/file-io.ts`) so open/save work outside Tauri (f0d703f).

## Library and content

- **Graph library**: ten fixture documents under `src/fixtures/graphs/` (deep-hierarchy, dense-mesh, karate-club, les-miserables, messy, package-deps, repo-file-tree, star-hub, state-chain, exoskeleton-system) via `src/data/library.ts`, reachable from json-edit's Library submenu (5783be1, 9feaf85).
- **Books**: *Berry Thief* (The Epic of Elinor Jones, Act 1 Ch 1; JSON Lab seeds it by default) (69aa086) and *The Scarlet Letter* (full book, information2topology pipeline) (3bea1a4).
- **System map**: `docs/exoskeleton-system.topology.json`, 63 nodes / 40 hyperedges in four layers, loadable in the JSON viewers (0dcae49).
- JSON document library with multiple loaded documents and an active-document channel (f0d703f, 0d63925).
- Design docs: pane-chrome blueprint and declarative-controls memo (0e3feb9, 0201423), layout-management.drawio zoning and stored-layout views (871b7c9, ac708d0).

## Fixes

- API keys are stripped from exported and imported workspace documents (36ffe33).
- Manifold panel no longer loads `three`, `lil-gui` or Google Fonts from a CDN at runtime; no iframe (78cec9c).
- json-graph3d "always" edge labels were empty on TopoThink spokes (694ff7f); 3D hulls vanished on zoom (9a47acf); `reading 'tick'` error on document switch (4f0fe88).
- Graph, cytoscape and tree panels drew nothing when mounted hidden (c31cf93).
- Document edge collapsed to zero width under Dockview 8 (d4ab97c); nested Dockview content measured as zero (7b83f6f).
- Procedural-visuals control pane could not be closed because its title bar covered the tab row (4d00479).
- Deck mode left the status-bar header visible after restoring the grid (ab242b5).
- Reified `edge-as-node` rows drew as category-less entities in 3D-Inspect and json-dyadic (ddb51be).
- Unmount promise rejections in the OSC panels; animation state scoped per instance (b91ec7a).
- Package, lockfile, `tauri.conf.json` and `Cargo.toml` versions were 0.1.0 under the v1.0.0 tag; now 1.1.0 (f39e967).

## Breaking or migration notes

- **Dependencies**: `dockview` ^6.0.5 → ^8.6.0 and new `dockview-react` ^8.6.0 (import React components from `dockview-react`) (e5f997f); new `@dimforge/rapier2d-compat` ^0.21.0 (WASM, lazy-loaded with json-attention; ~1.3 MB gzipped chunk) (7f2abda); new `react-markdown` (f40113e); new `@tauri-apps/plugin-shell` (de549c1). Run `npm install`.
- **Saved layout schema**: `CURRENT_VERSION` 8 → 11 (9 topology-extract, 10 procedural-visuals, 11 json-graph3d-inspect). Panels with `autoAdd` are added for older saves by `migrateLayout`; json-attention is registered at `introducedAt: 8` without autoAdd (1c68831, b91ec7a, 694ff7f, 7f2abda). The first-run stamp conflates layout shape v8 with the registry schema version; noted in App.tsx (9c0188d).
- **Edge migration** (`migrateEdgeLayout`, runs before `fromJSON`): a `json-edit` found in the grid, a floating group or a popout moves to the document edge; any other left edge group (the old `side-grid` Settings group) and any right edge group fold into it; `settings` and `menu` copies elsewhere are folded in; the saved `menu` tab is retitled on load (7730801, c7bb4ef, 68f83fd). On phones the document edge starts collapsed.
- **Per-workspace `mobileLayout`** added alongside `layout`; export/import carries both (33987d7).
- **Web storage key** `exoskeleton_web_state_v8_1` (d5db440); exported workspaces no longer carry `apiKey` (36ffe33).
- **Manifest contract**: `manifest.strip` → `manifest.panes` (kinds `pane` | `action` | `text`), `manifest.toolbar: Item[]` → removed (`toolbar: true` still means "has an inline row"), header-actions declarations removed; `src/chrome/strips/*.strip.ts` → `src/chrome/panes/*.panes.ts`; `publishToolbarText` → `publishHeaderActionText` → text cells (b163c14, c7bb4ef).
- **Panel rename**: `procedural-visuals-topological` → `procedural-visuals-manifold`; saved layouts referencing the old id need a preset reset (78cec9c).
- **Removed**: right settings edge, floating ⊞ button, floating menu group, scrim settings, capsule tab, pull-down controls, slim toolbar (b163c14, 9755088, c7bb4ef).
- Branches `osc-retainer-unification` and `json-attention` are fully absorbed into this release (33d8ae2, ab60b28).

## Known placeholders awaiting names

These titles are in the code as placeholders; Harold names them.

- "Controls" — the Paneview pane that holds the nested Dockview of control tabs (`CONTROLS_TITLE`, src/PanelPanes.tsx) (6933037).
- "Pane" — the settings tab inside Controls (window / move / follow / accent / about) (`SETTINGS_TITLE`, src/PanelPanes.tsx) (6933037).
- "Show controls" — the ▤ header-actions button that restores the snapped-away top cell (src/HeaderActions.tsx) (6933037).
- "Document" / "document" — json-edit's control set and its document-name text cell (src/chrome/panes/json-edit.panes.ts) (c7bb4ef).
- "File" / "file" — editor's control set (src/chrome/panes/editor.panes.ts) (c7bb4ef).
- Viewer control-set titles "look", "structure", "motion" (3D-Inspect), "layout", "labels", "physics" (tree, cytoscape, graph, graph3d, circles) — proposals from 2026-10-12 (6ad16bb, b163c14).
- Edge tab titles "JSON Edit", "Settings", "Exo-skeleton" — set 2026-10-18 pending review (536e102).
- The word for the loaded document itself (json / cartridge / set / document) is an open question noted in the plan (f4e1055).
