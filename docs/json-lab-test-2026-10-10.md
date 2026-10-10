# JSON lab run-through — 2026-10-10

Browser build (Vite dev, Chromium pane, desktop width unless noted). Document under test is named per row. Status: ✅ works · ⚠️ works with a caveat · ❌ broken · ⏳ not yet checked.

| Panel | Document | Status | Finding / fix |
| --- | --- | --- | --- |
| json-edit | Les Misérables (Library) | ✅ | Library submenu loads, editor text + document selector update. |
| json-graph | Les Misérables | ❌→✅ | Rendered nothing: `useElementSize` attached its observer once on mount, but the canvas div only mounts after a document is detected, so size stayed 0×0 and the draw effect never ran. Fixed in `src/useElementSize.ts` (re-attach when target changes). |
| json-cytoscape | Les Misérables | ❌→✅ | Same root cause and fix as json-graph. |
| json-graph3d | Les Misérables, State chain | ⚠️ | Follows active document and renders. On document switch the console logs an uncaught `Cannot read properties of undefined (reading 'tick')` from react-force-graph-3d's animation loop (non-fatal, repeats). Likely a pending frame after the graph data is replaced. |
| json-graph3d-inspect | Les Misérables | ✅ | Opened via blank-pane picker; renders. Very large labels in a small pane (expected at that size). |
| json-tree | Les Misérables | ⚠️ | Does **not** follow the active document: uses a fixed `params.documentId` ("default"). Shows "Waiting for JSON…" while every other viewer shows the library doc. Design gap, not a crash. Same for json-mass (fixed id). Decide: follow active like the graph viewers, or keep pinned-to-document semantics with a visible document selector in the header. |
| json-circles | ⏳ | | |
| json-mass | ⏳ | | |
| json-dyadic | State chain (Library) | ⚠️ | Follows active document; renders state_change layer correctly. Needs a layer picked before anything draws ("Pick a layer to start"); should default to the first layer. |
| text-viewer | State chain, Star hub | ❌ | "No nodes found in graph" on both a TopoThink topology and a plain nodes/links graph that every other viewer reads. Detection path differs from `getDetectedGraph`. |
| topology-extract | ⏳ | | |
| selection round-trip (graph → status bar, cyto, json-edit) | Star hub | ✅ | Clicking a force-graph node updates the status bar, highlights it in cytoscape, and scrolls json-edit to the node's line. |
| decouple / reconnect | ⏳ | | |
| mobile width (375px) | Star hub, 5-group JSON Lab | ❌ | (1) Five groups at phone width are unusable (~175px panes); multi-tab groups push their tabs into Dockview's "∨ 2" overflow chevron, so the tab controls disappear — the exact failure the pill was meant to prevent. Needs a mobile layout mode (plan item 6c). (2) Status bar wraps to three lines (~90px). (3) Uppercase letter-spaced panel-header labels wrap to two lines. Single-tab pills themselves are fine (glyph-only, 44px). |
| pop-out (desktop only) | ⏳ | | |
| floating ⊞ menu | — | ✅ | Opens as a floating Dockview group with the pill; About → GitHub; not persisted. |
| blank-pane "+" | — | ✅ | Adds a picker tab; chosen component replaces it in place. |
| pill menu (manifest items) | json-edit | ✅ | Library children open documents; Move to… lists target groups. |

Notes
- Service worker registration fails inside the Claude browser pane ("unknown error fetching the script"); `sw.js` serves 200 with the right MIME type and parses. Needs a real Chrome/Safari check after deploy.
