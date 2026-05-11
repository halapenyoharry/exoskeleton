# SESSIONS

Append-only handoff log. Newest entry at the bottom. Read the bottom entry first.

## Format

```
## YYYY-MM-DD

State: <what's true on disk right now, 1 line>
Last: <what we just did, 1 line>
Next: <the next concrete move, 1 line>
Open: <unresolved question or assumption — optional>
```

If an entry runs longer than 6 lines, the work-in-progress should probably be a commit instead. Keep it tight — this is a handoff, not a journal.

---

## 2026-05-09

State: clean tree at 6de2850. Tauri 2 + React + Dockview scaffold with three panels (editor textarea, xterm+pty terminal, iframe webview), color-coded cyan/amber/mint.
Last: added CLAUDE.md + this SESSIONS.md to externalize project state — fix for context-decay across sessions.
Next: Harold's call. Likely candidate per README caveat is the muya editor swap (textarea → real Markdown surface).
Open: muya 0.2.5 is flagged not-for-prod — pin a fork, run from master, or switch to Milkdown / Lexical / CodeMirror+remark? Decide before swapping.

## 2026-05-09 (later)

State: project renamed `hud` → `exoskeleton`. New paths: repo dir `~/Projects/exoskeleton/`, GitHub `halapenyoharry/exoskeleton`, auto-memory `~/.claude/projects/-Users-harold-Projects-exoskeleton/`. Webview panel renamed `WebviewPanel` → `LanWebview` to label its purpose (LAN HTTP services); panel id `webview` and the mint color identity kept.
Last: full rename pass — package.json, Cargo.toml, tauri.conf.json, capabilities, main.rs, README, CLAUDE.md, dir, GitHub repo, git remote. Cargo will rebuild target/ from scratch on next `npm run tauri dev` (5–15 min) because the crate name changed.
Next: still Harold's call. Muya editor swap is the open caveat. Or push on the next module.
Open: should `target/` get a `cargo clean` to drop stale `hud`-named artifacts, or just let cargo handle it?

## 2026-05-10

State: clean tree at d242634 + this entry. Workspace file consolidated to `exoskeleton.code-workspace` (tracked). Old hud-era auto-memory archived at `~/.claude/projects/-Users-harold-Projects-hud.archived/`. Empty `~/Projects/hud/` shell trashed. Build verified: `npm run tauri dev` brings up the **Exoskeleton** window.
Last: rename hygiene. The earlier open question — "should `target/` get a `cargo clean`?" — answered yes: the first post-rename build failed because cargo's incremental state had `/Users/harold/Projects/hud/...` absolute paths baked into tauri plugin permissions output. `cargo clean` fixed it.
Next: Harold's call. Top of the queue per the muya caveat in README. Or pick a different module to push on.
Open: VS Code keeps offering to recreate `xos.code-workspace` if its workspace identity is reset. Watch for it; trash if it reappears.

## 2026-05-10 (later — chrome demos)

State: clean tree at 3341c9c. All Dockview chrome slots demoed live in the running app: custom ColoredTab (glyph + title + close ×), Watermark (centered card with restore buttons, only visible when grid is fully empty), PrefixHeaderActions (glowing accent dot before tabs), LeftHeaderActions (+ tab button), RightHeaderActions (⨯ close-group button). README and CLAUDE.md not yet updated to document the chrome layer — they still only mention `ColoredTab`.
Last: built chrome demos in response to Harold wanting to *see* each slot before adding layout persistence.
Next: layout persistence — Dockview's `api.toJSON()` / `api.fromJSON()` + Tauri's `tauri-plugin-store` (or just `tauri-plugin-fs` to a JSON file). Save layout on `onDidLayoutChange`, restore on app startup.
Open: I overstated earlier when I told Harold about a `headerComponent` slot — it doesn't exist. A "full custom header" is built by combining prefix/left/right actions + custom tabComponents. The commit message acknowledges this; my conversational message did too.

## 2026-05-11

State: clean tree at b2b9a49. Persistence is live. State JSON at `~/Library/Application Support/dev.harold.exoskeleton/exoskeleton.json` (schema `version: 1`). Layout + per-panel params saved on `onDidLayoutChange` / `onDidActivePanelChange` (debounced 400ms), restored on `onReady` via `api.fromJSON()`. LanWebview now reads its URL from `params` and writes back via `updateParameters` — so user URL changes persist. Persistence layer split into `src/persistence/{storage.ts, tauri-storage.ts, default-layout.ts}` so future web/vscode adapters slot in without rearchitecting. Also rolled in an earlier uncommitted App.css fix (`.panel-pad` was `position:absolute` and was painting over Dockview's tab bar).
Last: persistence layer, including the schema/state split documented in README's "Building with it" section (schema=code, state=JSON delta on top).
Next: discuss with Harold *where controls can be stored* for apps built on top of Exoskeleton — Tauri titlebar / floating window / Dockview panel / separate hidable grid. He's doing his own research in parallel. Also: a hidable floating window for raw JSON state editing was mentioned as a "could".
Open: undo/history is deferred — the JSON format leaves room (could add `history: AppState[]` later) but the UX trigger isn't decided. Color identity (cyan/amber/mint) was clarified earlier to NOT be load-bearing (commit 3ed2f5a relaxed CLAUDE.md).

## 2026-05-11 (later — drag fix + devtools)

State: clean tree at 33c9416. Tab drag-and-drop now works (Harold to confirm visually). Two real fixes plus one diagnostic:
- 4a45fa3: ColoredTab back to wrapping DockviewDefaultTab. The fully-custom version was eating dragstart somehow, leaving event.defaultPrevented true when abstractDragHandler.js ran, so PanelTransfer was never set. Glyph (◆/▸/◯) now comes from a CSS variable + ::before pseudo, color from the style prop — both flow through Object.assign in DockviewDefaultTab. lib.rs auto-opens WebKit Inspector in debug builds via `window.open_devtools()` in setup().
- 33c9416: `dragDropEnabled: false` on the main window in tauri.conf.json. Tauri's native OS file-drop listener was intercepting WKWebView's HTML5 drag events. Harold did this research himself and brought me the answer — saved a longer diagnostic dance. Tip written up in docs/dockviewtips1.md.
Last: drag fix.
Next: still the controls-storage discussion from earlier today's entry. Harold's research is on Tauri titlebar / floating window / Dockview panel / hidable Dockview grid as options for where controls live in apps built on top of Exoskeleton.
Open: if we ever want OS-level file-drop INTO Exoskeleton (e.g. drop an image onto the webview, drop a file onto the editor), we have to flip dragDropEnabled back to true and intercept dragover at the React level to set `dataTransfer.dropEffect = "move"` when the drag is from a Dockview tab. Noted in dockviewtips1.md.

## 2026-05-11 (later still — side-grid MVP)

State: clean tree at 7d53106. Side-grid landed — a peer DockviewReact instance on the left, toggleable with Cmd+B, hidden by default. Today holds one panel: `⚙ SETTINGS`, a raw JSON editor for the full app state on disk. Layout lives at flex: 0 0 320px when visible.
AppState extended with optional `sideGrid: SerializedDockview` and `preferences: { sideGridVisible }`. Forward-compatible — old state files load fine, just lack the new fields. App.tsx coordinates a single debounced save across both grids + prefs. sideApiRef cleared on hide so saves don't serialize a disposed Dockview. SideGrid takes savedLayout + onApiReady; App keeps sideGridLayout in state so content survives unmount cycles.
Harold also landed (untracked, rolled into 7d53106): TopoViewerPanel + src/topoviewer/ (parse / renderer / types). First real domain feature on top of Exoskeleton. Color slot `--accent-topoviewer: #b388ff` purple, glyph ⌬ via ColoredTab.
Last: side-grid MVP per Harold's specification, minimum scope (no custom titlebar, no tab polish, no breakout buttons — all deferred).
Next: Harold to confirm visual and decide what to add. Open candidates per his earlier list: custom Tauri titlebar with explicit settings/themes buttons; tab-position prefs (top/bottom/left/right); transparent-on-hover tabs; per-tab popout button via api.addPopoutGroup; new-tab-goes-left-of-active ordering.
Open: future README update — Harold wants README to become the all-in-one "how to fork Exoskeleton and build your own app" guide. Not yet doing that wholesale; "Building with it" section + the fractal observation + the schema/state split are scaffolding for it. Also: a future hypergraph diagram of Dockview-and-Tauri integration is on the wish list.

## 2026-05-11 (end of day — logging + popout + readme rewrite)

State: clean tree at d87f1ad (runtime) + this SESSIONS commit.
Three coherent landings this round:
- **tauri-plugin-log** wired with Stdout + LogDir + Webview targets. Log file at `~/Library/Logs/dev.harold.exoskeleton/Exoskeleton.log`. Global filter set to INFO (tao's TRACE was drowning the file). JS side: `import { info, ... } from "@tauri-apps/plugin-log"`. Unified Rust ↔ JS log stream, ready for "users report issues" workflows.
- **Popout button** (⤴) in `rightHeaderActionsComponent`. Calls `containerApi.addPopoutGroup(group)`. Spawns a Tauri WebviewWindow for the group; each popout is its own React tree. First step toward the multi-window architecture the hypergraph doc points at.
- **README full rewrite** as the all-in-one fork-and-build guide. New sections: What's in the box, side-grid, chrome customization, persistence (with the on-disk JSON shape documented), multi-window/popout, debugging, "what's not yet built." Schema/state split moved from conversation into permanent doc. Self-similar/fractal section preserved verbatim.
- Harold added `docs/Dockview Tauri Hypergraph JSON.md` (long-form research on HIF — Hypergraph Interchange Format — as the future unified schema for both Dockview layout AND Tauri OS-window topology). Referenced in README's multi-window section. Not implementing HIF today; doc captures direction for when multi-window state-sync is actually needed.
Last: logging + popout + readme rewrite.
Next: Harold's call. The "what's not yet built" list at the bottom of README is the runway.
Open: tao's pre-filter TRACE entries (43 lines) are still at the top of the log file from the brief window before LevelFilter::Info was applied. Harmless; will age out as the log rotates.
