# JSON lab run-through — 2026-10-10

Browser build (Vite dev, Chromium pane, desktop width unless noted). Document under test is named per row. Status: ✅ works · ⚠️ works with a caveat · ❌ broken · ⏳ not yet checked.

| Panel | Document | Status | Finding / fix |
| --- | --- | --- | --- |
| json-edit | Les Misérables (Library) | ✅ | Library submenu loads, editor text + document selector update. |
| json-graph | Les Misérables | ❌→✅ | Rendered nothing: `useElementSize` attached its observer once on mount, but the canvas div only mounts after a document is detected, so size stayed 0×0 and the draw effect never ran. Fixed in `src/useElementSize.ts` (re-attach when target changes). |
| json-cytoscape | Les Misérables | ❌→✅ | Same root cause and fix as json-graph. |
| json-graph3d | Les Misérables | ✅ | Follows active document. |
| json-graph3d-inspect | Les Misérables | ✅ | Opened via blank-pane picker; renders. Very large labels in a small pane (expected at that size). |
| json-tree | Les Misérables | ⚠️ | Does **not** follow the active document: uses a fixed `params.documentId` ("default"). Shows "Waiting for JSON…" while every other viewer shows the library doc. Design gap, not a crash. Same for json-mass (fixed id). Decide: follow active like the graph viewers, or keep pinned-to-document semantics with a visible document selector in the header. |
| json-circles | ⏳ | | |
| json-mass | ⏳ | | |
| json-dyadic | ⏳ | | |
| text-viewer | ⏳ | | |
| topology-extract | ⏳ | | |
| selection round-trip (graph ↔ 3d ↔ cyto) | ⏳ | | |
| decouple / reconnect | ⏳ | | |
| mobile width (375px) | ⏳ | | |
| pop-out (desktop only) | ⏳ | | |

Notes
- Service worker registration fails inside the Claude browser pane ("unknown error fetching the script"); `sw.js` serves 200 with the right MIME type and parses. Needs a real Chrome/Safari check after deploy.
