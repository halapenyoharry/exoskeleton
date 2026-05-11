A Quick Tip on Canvas Performance:
When using Dockview to frame a heavy WebGL canvas, be mindful of the onDidDimensionsChange event provided by the Dockview API. Tie your canvas engine's engine.resize() method directly to this event so the scene updates smoothly as the user drags the dock splitters around.

---

Tauri + WKWebView intercepts Dockview's drag-and-drop:
By default Tauri's window enables a native OS file-drop listener (`dragDropEnabled: true` in Tauri 2 / `fileDropEnabled` in Tauri 1). On macOS WKWebView, that listener hijacks internal HTML5 drag events — even briefly firing the file-drop pathway makes WebKit stick the cursor on "copy" (the green plus) and refuse to switch back, so Dockview's drop indicators never appear and panels can't be reorganized by drag.

If the app doesn't need to drag external files from Finder into the window, set `dragDropEnabled: false` in the window config in `src-tauri/tauri.conf.json`:

```json
"windows": [
  { "title": "...", "dragDropEnabled": false, ... }
]
```

That returns full control of HTML5 drag-and-drop to Dockview and panel reordering starts working. If you DO want OS file-drop into the window later, the alternative is to keep it enabled and intercept `dragover` at a high React level to force `dataTransfer.dropEffect = "move"` when the drag originates from a Dockview tab — more work, more places to break.

Found in this project 2026-05-11 via Harold's research.
