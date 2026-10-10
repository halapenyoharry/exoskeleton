# JSON lab run-through — 2026-10-10

Browser build (Vite dev, Chromium pane, desktop width unless noted). Document under test is named per row. Status: ✅ works · ⚠️ works with a caveat · ❌ broken · ⏳ not yet checked.

| Panel | Document | Status | Finding / fix |
| --- | --- | --- | --- |
| json-edit | Les Misérables (Library) | ✅ | Library submenu loads, editor text + document selector update. |
| json-graph | Les Misérables | ❌→✅ | Rendered nothing: `useElementSize` attached its observer once on mount, but the canvas div only mounts after a document is detected, so size stayed 0×0 and the draw effect never ran. Fixed in `src/useElementSize.ts` (re-attach when target changes). |
| json-cytoscape | Les Misérables | ❌→✅ | Same root cause and fix as json-graph. |
| json-graph3d | Les Misérables, State chain, Dense mesh | ⚠️→✅ | `d3ReheatSimulation` ran on every data change before the library built its layout → `reading 'tick'` every frame. Reheat only on unfreeze; ForceGraph3D keyed by document. Verified: no new tick errors across a document switch. |
| json-graph3d-inspect | Les Misérables | ✅ | Opened via blank-pane picker; renders. Very large labels in a small pane (expected at that size). |
| json-tree | Les Misérables, Dense mesh | ⚠️→✅/⚠️ | Did not follow the active document (fixed `params.documentId`); fixed, same for json-mass. Second issue found afterwards: a tab hidden at mount stayed 0×0 because Chromium delivered no ResizeObserver entry when Dockview re-attached its DOM; `useElementSize` now re-measures per render and polls while zero. Remaining caveat: no fit-to-view, so a graph-shaped document (605 nodes as hierarchy, 8400px tall) shows only a slice. Add fitOnLoad like json-graph. |
| json-circles | — | ⏳ | Already follows active document (code); not yet exercised in the browser. |
| json-mass | — | ⚠️ | Follow-active fix applied (same as tree); not yet exercised in the browser. |
| json-dyadic | State chain (Library) | ⚠️→✅ | Renders the state layer; now defaults to the first layer instead of "Pick a layer to start". |
| text-viewer | State chain, Star hub, Dense mesh | ❌→✅ | Read a fixed documentId and dropped nodes without `attrs`. Now follows the active document and falls back to raw node fields. Renders one block per node. |
| topology-extract | ⏳ | | |
| selection round-trip (graph → status bar, cyto, json-edit) | Star hub | ✅ | Clicking a force-graph node updates the status bar, highlights it in cytoscape, and scrolls json-edit to the node's line. |
| decouple / reconnect | ⏳ | | |
| mobile width (375px) | Star hub, 5-group JSON Lab | ❌ | (1) Five groups at phone width are unusable (~175px panes); multi-tab groups push their tabs into Dockview's "∨ 2" overflow chevron, so the tab controls disappear — the exact failure the pill was meant to prevent. Needs a mobile layout mode (plan item 6c). (2) Status bar wrapped to three lines — fixed (single row under 600px). (3) Panel-header labels wrapped — fixed (ellipsis). Single-tab pills themselves are fine (glyph-only, 44px). |
| pop-out (desktop only) | ⏳ | | |
| floating ⊞ menu | — | ✅ | Opens as a floating Dockview group with the pill; About → GitHub; not persisted. |
| blank-pane "+" | — | ✅ | Adds a picker tab; chosen component replaces it in place. |
| pill menu (manifest items) | json-edit | ✅ | Library children open documents; Move to… lists target groups. |

Notes
- Service worker registration fails inside the Claude browser pane ("unknown error fetching the script"); `sw.js` serves 200 with the right MIME type and parses. Needs a real Chrome/Safari check after deploy.
