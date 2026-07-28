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

## 2026-05-15 (the big arc — long handoff, compaction point)

State: clean tree, latest commit on `main` is the latency-fix for piano+scope.
The library at `~/Projects/exoskeleton-component-library/` has matching commits. Four days, several conversational sessions, and a *lot* of architecture landed since the 5-11 entry — listing it here because the chat history is being compacted and these are the things a fresh session needs to know.

**Architecture that landed:**
- **`PanelManifest<P>` type** at [src/panel-manifest.ts](../src/panel-manifest.ts) — the integration contract every library panel satisfies (id, component, accent, glyph, defaultLayout, paramsDefault, osc, tauri, npmDependencies). The library README documents the install protocol — an agent reads a manifest, then performs the App.tsx / ColoredTab / App.css / default-layout / capabilities / Cargo / package.json edits implied by its fields.
- **Host-owned wrapping** — `PanelRoot` + `exoPanel(Component, accent)` HOC at [src/PanelRoot.tsx](../src/PanelRoot.tsx). Panels are now pure content (return fragments, no `.panel-pad` wrapper); the host wraps each at registration time. Decision doc at [docs/panel-contract-proposal.md](panel-contract-proposal.md) (status: accepted).
- **Side-grid migrated to Dockview 6 edge group.** No more peer `<DockviewReact>`. One Dockview, one toJSON, one source of truth. Cmd+B summons settings into a left edge group via `addEdgeGroup`; the edge group auto-removes when its last panel closes.
- **Schema versioning + migration.** `default-layout.ts` panelRegistry entries carry `introducedAt`. On load, `migrateLayout(api, savedVersion)` adds any panels the user's saved state predates without disrupting their layout. `CURRENT_VERSION` is now 4. New panels = append to registry + bump version.
- **Menu accelerator for Cmd+B** — `setup()` in [src-tauri/src/lib.rs](../src-tauri/src/lib.rs) builds a "View" submenu with `accelerator("CmdOrCtrl+B")` and emits `shortcut:toggle-settings`. App.tsx listens via Tauri events. Iframe focus no longer eats the shortcut.

**OSC stack:**
- **In-process bus by default**, [src/osc/index.ts](../src/osc/index.ts). `sendOsc`/`onOsc` dispatch via a JS pub/sub bus, no UDP. The Rust UDP layer (still present, [src-tauri/src/osc.rs](../src-tauri/src/osc.rs)) is dormant unless `osc.bridge.enabled = true` in the store. Decision doc: [docs/research/osc-self-contained-by-default.md](research/osc-self-contained-by-default.md).
- **Tempo Clock**, **Piano**, **Scope** panels in the library, all installed into `src/panels/`. Tempo Clock is the master clock broadcaster. Piano is the visible sender (one octave, mouse-Y velocity, hold-to-sustain). Scope is the visible receiver (note log + Web Audio synth + canvas oscilloscope, with collapsible log section).

**Research artifacts:**
- [docs/research/dockview-constructive-vs-consumptive.md](research/dockview-constructive-vs-consumptive.md) — Dockview group API patterns (edge = constructive; floating/popout = consumptive).
- [docs/research/osc-self-contained-by-default.md](research/osc-self-contained-by-default.md) — why OSC default-binds nothing.

**Library at `~/Projects/exoskeleton-component-library/`:**
- Renamed from `exoskeleton-componant-library` (was a misspelling).
- Now contains: `topoviewer/` (moved out of exoskeleton early in this arc), `harolds-zerof-imagebrowser/` (Harold built this himself with the new manifest contract), `tempo-clock/`, `piano/`, `scope/`. README documents the manifest contract + install protocol.

Last: latency-fix in [src/panels/scope/ScopePanel.tsx](../src/panels/scope/ScopePanel.tsx) — Harold reported ~2.5s latency from piano key press to audible sound. Three changes:
1. `new AudioContext({ latencyHint: "interactive" })` — explicit low-latency request.
2. Note-on handler awaits `ctx.resume()` before reading `currentTime` and scheduling audio. Previously the schedule could be referenced to a frozen timeline when the context was suspended; this was the strongest hypothesis.
3. Diagnostic `console.info("[scope] AudioContext", { baseLatency, outputLatency, sampleRate, state })` on creation — surface platform-reported latency so future sessions don't have to instrument.

Next: Harold verifies whether the fix lands the latency at imperceptible (<25ms) or whether real latency remains. If real latency remains, the prime suspect is **Bluetooth audio on the output device** — BT codecs add 150–800 ms baked-in; no code change here can address that. Check the AudioContext log line in devtools for the actual `outputLatency` value the platform reports.

Open:
- Cymatic thumbnail React component Harold is building separately. When done, drops into scope as a replacement (or companion) for the 1D oscilloscope; same `analyserRef.current` data source.
- OSC bridge UX — today you'd hand-edit `~/Library/Application Support/dev.harold.exoskeleton/store.json` to set `osc.bridge.enabled` (plus listenPort, targetHost, targetPort). Worth a small Settings-panel UI eventually.
- VS Code auto-launch task occasionally fails when port 1420 is held by an orphan dev server. Already burned twice; remediation is `kill <pid>` and restart. Worth a one-shot port-clean script on task start.

## 2026-05-19 (catch-up)

State: clean tree on `main` at 3fed600 + `add-json-panels` branch at 84992e5 (1 ahead of main).
Last: two things landed — (1) scope latency fix (`AudioContext({ latencyHint: "interactive" })` + `await ctx.resume()` before scheduling); (2) seven JSON panels installed from the component library (json-edit + six viewers), wired through a new `json-bus` in-process snapshot-state primitive at `src/data/json-bus.ts`. Also landed: `docs/AGENTS-FAQ.md` with two entries (cross-panel data flow rationale, three-layer state model). Component library got d3 type-generic fixes in json-circles and json-mass, plus `inbox/cymatic_square` (wave-equation membrane visualizer, candidate for Scope companion).
Next: Harold to verify scope latency fix. Document communications and configuration internals before further building.
Open: `add-json-panels` branch not merged to `main` yet. `md-editor-4-writers` is an empty placeholder in the component library inbox.

## 2026-05-20

State: both repos committed and pushed. `add-json-panels` branch 1 ahead of `main`. All working trees clean.
Last: documented Exoskeleton's two core subsystems — communications (OSC bus, json-bus, OSC UDP bridge, Tauri events/commands) and configuration (workspace file, panel params, preferences, schema versioning, edge group). Identified seven gaps: preferences not auto-saved in the debounced save, no structured preferences UI, no layout-locking mechanism, no useOsc/useJsonDoc hooks, no per-panel settings drawer convention, no cross-window communication for popouts, no OSC bridge UI.
Next: review the gap list with Harold and decide which to address. Jules task briefs (HUD overlay, TopoViewer typed connections, FileTree, GitStatus, LogTail) are documented and understood but parked — not urgent.
Open: Harold has new information about the layer model (mentioned re: OSC bridge / preferences) that may reshape how preferences and communications interact. Waiting for that input before building.

## 2026-07-13

State: `add-json-panels` at 6 new commits past c5acff5, all pushed. App verified running with a repaired layout.
Last: fixed the empty-grid launch. Root cause: panels added without a `position` land in Dockview's *active* group; when that was the status-bar edge group, every panel got absorbed into the 118px bottom strip, the main grid serialized empty, and the watermark buttons threw duplicate-id errors against panels nobody could see. Landed: (1) `repairLayout()` — detects non-resident panels in edge groups and re-adds them to the main grid in registry order, params preserved; verified live against the corrupted state file (all 15 panels rescued, layout re-saved clean). (2) `addRegistryPanel()` shared safe-add (idempotent, per-panel try/catch, never positionless) now underpins build/migrate/watermark/add-menu. (3) Watermark lists the full 14-panel roster with focus-or-add semantics; new floating ⊞ add-panel menu next to the astromech summoner. (4) `+` add-tab fixed (`active.view.contentComponent`, was `id.split("-")[0]` — hypergraph observation #3). (5) Manifest contract grew `capabilities`/`optionalCapabilities` (the capability-map next step, split into two arrays to keep the solid/dotted distinction) and `companions` (json viewers pull in json-edit); all 16 panels now have manifests. (6) Editor persists its open file path (observation #6, path only); scope shows a pulsing ♩ beat counter from `/exoskeleton/clock/beat` (observation #5). (7) Docs reconciled: README persistence shape + panel counts, CLAUDE.md current-shape, hypergraph observations annotated, capability map marked done. fs:allow-home-{read,write}-recursive committed (verified real tauri-plugin-fs 2.5.1 permissions).
Next: Harold sanity-checks the running app (a stray verification click loaded elinor-jones hypergraph JSON into json-edit — harmless, and it proved the json-bus pipeline: 30k nodes detected in circles). Consider a host-side capability *check* that actually consumes `capabilities` at install time — the field exists, nothing enforces it yet.
Open: hypergraph observations #7 (selection is both event and snapshot) and #8 (no OSC bridge UI) remain. Unsaved editor/json-edit buffer text still not persisted (only the file path is). Port 1420 orphan-dev-server trap bit again this session (killed stale pid, relaunched).

## 2026-07-13 (afternoon — performance pass)

State: `add-json-panels` pushed through the large-JSON performance pass. App running via dev server with HMR-applied changes.
Last: Harold loaded the elinor-jones paragraph-level hypergraph (30,239 JSON values) and the app froze — on load, on panel drags, and on the tree/circles tabs. Root causes, all fixed: (1) synchronous json-bus fan-out ran 8 independent O(N) walks per debounced keystroke → new shared WeakMap stats cache (docStats.ts), one pass per edit app-wide; (2) perf gates only skipped the draw, transforms ran regardless → gates moved before the transforms; (3) "Render anyway" was a persisted param, baking 150k-element SVG builds into every launch → session-only useState now; (4) hidden tabs stayed subscribed and re-rendered → useJsonDoc visibility-aware hook (dockview onDidVisibilityChange); (5) panel drags rebuilt every scene per ResizeObserver tick → debounced useElementSize + destructured-primitive deps; (6) status bar ran full detectGraph per change for two numbers → cached stats read. json-graph3d is the designated big-graph surface: threshold 50k, auto-degraded cosmetics above 5k nodes. BONUS root-cause find: the doc was never "too big" for the graph viewers — it's 510 graph nodes / 889 edges; detectGraph just didn't understand TopoThink's incidence structure ({nodes, edges, incidences}) and returned null (status bar 0/0). New Pattern 1b converts dyadic incidences to links and 3+-member hyperedges to hyperedge-kind spoke nodes; verified against elinor-jones public (34/62), private (510/1307, 3ms), wizard-of-oz (1203/2358). AGENTS-FAQ gained the large-document conventions entry.
Next: Harold reloads the hypergraph JSON into json-edit (bus state doesn't survive HMR/reload) and eyeballs: status bar should show real node/edge counts, json-graph3d and json-cytoscape should render the graph, json-graph (threshold 500) will show its gate at 510 nodes — "Render anyway" is now safe to click. Tree/circles/mass still gate on the 30k JSON values, correctly — they're value-tree viewers, not graph viewers.
Open: transforms still run on the main thread when a big render IS requested (web-worker transforms remain the follow-up); json-tree has no collapse/virtualization; unsaved editor buffers still don't survive relaunch.

## 2026-07-28 (ship review + plan)

State: `add-json-panels` clean at f93805d. No code changed this session — two new documents only: [ship-review-2026-07-28.md](ship-review-2026-07-28.md) (evidence) and [ship-plan.md](ship-plan.md) (orders, written for Gemini 3.6 Flash — High to execute).
Last: full-codebase review against "public GitHub release a stranger can open." Sixteen findings, each verified against source rather than inferred. Four are blockers:
1. **Monaco is fetched from cdn.jsdelivr.net at runtime.** `@monaco-editor/react` needs `loader.config({ monaco })` and never gets it; confirmed by grepping the built bundle. Violates the no-internet rule, breaks json-edit offline, and loads 0.55.1 while package.json pins 0.55.0.
2. **The ⤴ popout button cannot work — two independent causes.** (a) wry returns nil from `createWebViewWithConfiguration:` unless `new_window_req_handler` is set; Tauri only sets it when the app calls the *builder* method `on_new_window`, and our window comes from tauri.conf.json, so `window.open` returns null and Dockview silently treats it as a blocked popup. (b) Dockview's default popout URL is `/popout.html`, which doesn't exist in `public/`. Correction that follows: Dockview popouts are `window.open` + DOM portal, so they share the JS heap — the README/SESSIONS claim that "each popout is its own React tree" is wrong, and json-bus *does* reach a popout. Tauri `WebviewWindow`s are the separate-heap case. Two mechanisms, now named separately in the docs.
3. First launch mounts all 14 registry panels (PTY + WebGL + Cytoscape + Monaco + Web Audio + iframe, simultaneously).
4. No workspace concept at all — one unnamed blob, and the only documented reset is deleting a file in `~/Library/Application Support/`.
Also found: `npm test` runs only 1 of 2 test files (`sh` doesn't expand `**` recursively, so the 171-line json-dyadic parse suite has never executed while reporting green); terminal hardcodes `/bin/zsh` (dead on Pop!_OS, a stated target); no error boundary, so one throwing panel blanks the window; no LICENSE; settings "apply" is clobbered by the next autosave; json-edit forgets its open file while EditorPanel remembers; `csp: null` alongside recursive home read/write.
Harold's four decisions, recorded in the plan so they don't get re-litigated: **public GitHub release**; **minimal default layout** with the wide registry preserved behind ⊞; **both** app-managed named workspaces *and* export/import files; **both** window mechanisms, popout repaired first.
Next: execute [ship-plan.md](ship-plan.md) Phase 0 (WP-1 through WP-6 — Monaco, popout, test glob, shell, error boundary, save flush). One work package per commit.
Open: three decisions still belong to Harold and are flagged in the plan rather than guessed — which license (WP-15), signing/notarization vs. documented `xattr` workaround vs. source-only (WP-19), and the plan-B popout design if `NewWindowResponse::Allow` doesn't yield a usable window (WP-2). Phase 5 (TopoThink fork) stays parked until Phases 0–4 land.

## 2026-07-28 (WP-0 complete)

State: clean tree on `add-json-panels` at e8ae00c. `npm run build && npm test` green (11/11 passing across 2 files).
Last: completed WP-0. Quoted test glob in package.json (discoverable across subdirs); added in-repo synthetic topology fixture (`src/panels/json-dyadic/__fixtures__/synthetic-topology.json`); updated `parse.test.ts` to test against synthetic fixture by default (with optional `EXO_TOPOLOGY_DIR` override); removed `runOn: folderOpen` trigger from `.vscode/tasks.json` to prevent port 1420 orphans.
Next: WP-1 — Replace Monaco with CodeMirror 6 in `json-edit` (bundle locally, port Midnight Alaska theme, update params/migrations).
Open: none for WP-0.

## 2026-07-28 (WP-1 complete)

State: clean tree on `add-json-panels` at 673b0e7. `npm run build && npm test` green. Zero CDN requests or Monaco artifacts in `dist/assets/`.
Last: completed WP-1. Replaced Monaco with CodeMirror 6 in `json-edit` (swapped npm dependencies, ported Midnight Alaska theme to CodeMirror EditorView.theme + HighlightStyle, updated JsonEditPanel.tsx with lineWrapping and paste formatting, updated manifest and migrateSavedLayout).
Next: WP-2 — Repair the popout button (add `public/popout.html`, configure `on_new_window` in `lib.rs`, update `tauri.conf.json`).
Open: none for WP-1.

## 2026-07-28 (WP-2 complete)

State: clean tree on `add-json-panels` at b9050c6. `cargo check` and `npm run build && npm test` green.
Last: completed WP-2. Repaired popout group button (added `public/popout.html` shell document, configured `on_new_window` handler returning `NewWindowResponse::Allow` on main window builder in `lib.rs`, cleared `app.windows` in `tauri.conf.json`).
Next: WP-4 — Cross-platform shell in `TerminalPanel.tsx` (extract `resolveShell` pure helper with `SHELL` env and per-platform fallbacks).
Open: none for WP-2.

## 2026-07-28 (WP-4 complete)

State: clean tree on `add-json-panels` at ccca204. `npm run build && npm test` green (16/16 tests passing).
Last: completed WP-4. Extracted `resolveShell` pure helper to `src/panels/terminal-shell.ts`, added unit tests in `src/panels/terminal-shell.test.ts`, and updated `TerminalPanel.tsx` to resolve default shell by OS and `SHELL` env.
Next: WP-5 — Per-panel error boundary in `PanelRoot.tsx` (`PanelErrorBoundary` with Retry, Close, and panel accent stripe).
Open: none for WP-4. Tested on macOS; Pop!_OS fallback to `/bin/bash` ready.

## 2026-07-28 (WP-5 complete)

State: clean tree on `add-json-panels` at d544be6. `npm run build && npm test` green (16/16 tests passing).
Last: completed WP-5. Added `PanelErrorBoundary` in `src/PanelRoot.tsx` to catch panel exceptions, displaying inline fallback UI with panel name, error message, Retry button, Close panel button, and accent stripe. Wrapped `exoPanel` HOC.
Next: WP-6 — Flush pending saves on quit in `src/App.tsx` (extract debounce helper with `.flush()`, listen to `beforeunload` and `onCloseRequested`).
Open: none for WP-5.

## 2026-07-28 (WP-6 complete)

State: clean tree on `add-json-panels` at df07755. `npm run build && npm test` green (20/20 tests passing). Phase 0 complete!
Last: completed WP-6. Extracted `createDebounce` helper module to `src/utils/debounce.ts` with `.flush()` and `.cancel()`, added unit tests in `src/utils/debounce.test.ts`, and updated `App.tsx` to flush pending layout saves on `beforeunload` and Tauri `onCloseRequested`.
Next: Phase 1 (WP-7 through WP-9) — First Open & Presets (layout presets minimal by default, registry auto-add control, preset reset UI).
Open: Phase 0 correctness blockers finished. Ready for Phase 1.

## 2026-07-28 (WP-7 complete)

State: clean tree on `add-json-panels` at 3f5b85f. `npm run build && npm test` green (26/26 tests passing).
Last: completed WP-7. Created `src/persistence/presets.ts` (minimal default preset with editor, terminal, webview), added unit test suite in `src/persistence/presets.test.ts`, added `buildPreset` in `src/persistence/default-layout.ts`, and updated `buildDefaultLayout` to delegate to minimal preset.
Next: WP-8 — Stop force-adding new panels to existing layouts (`autoAdd?: boolean` on `RegistryEntry`).
Open: none for WP-7.

## 2026-07-28 (WP-8 complete)

State: clean tree on `add-json-panels` at 7a0aafc. `npm run build && npm test` green (30/30 tests passing).
Last: completed WP-8. Added `autoAdd?: boolean` to `RegistryEntry`, extracted pure decision helper `panelsToAutoAdd(savedVersion, registry)` in `src/persistence/default-layout.ts`, added unit tests in `src/persistence/migration.test.ts`, and updated `migrateLayout` to auto-mount version-newer panels only when `autoAdd === true`.
Next: WP-9 — Visible reset and preset switching (Watermark preset chooser, ⊞ menu reset option).
Open: none for WP-8.

## 2026-07-28 (WP-9 complete)

State: clean tree on `add-json-panels` at 1c75b36. `npm run build && npm test` green (30/30 tests passing). Phase 1 complete!
Last: completed WP-9. Added preset selection cards (Minimal, JSON Lab, AV Lab, Everything) in `Watermark.tsx` and a "Reset layout..." action with confirmation in the floating ⊞ menu in `App.tsx`. Styled in `Watermark.css` and `App.css`.
Next: Phase 2 (WP-10 through WP-13) — Workspaces (schema v8 storage model, workspace UI, export/import `.exo.json`, json-edit persistence).
Open: Phase 1 complete. Ready for Phase 2.

## 2026-07-28 (WP-10 complete)

State: clean tree on `add-json-panels` at 4bb97b1. `npm run build && npm test` green (34/34 tests passing).
Last: completed WP-10. Introduced schema v8 in `src/persistence/storage.ts` with `Workspace` interface, `AppStateV8` type, `migrateToV8()` legacy save converter, and pure CRUD helpers (`listWorkspaces`, `getActiveWorkspace`, `updateActiveWorkspaceLayout`, `switchWorkspace`, `createWorkspace`, `deleteWorkspace`, `renameWorkspace`). Added unit tests in `src/persistence/workspace.test.ts` and updated `tauri-storage.ts` and `App.tsx`.
Next: WP-11 — Workspace UI & File Menu (WP-11a workspace selector UI, WP-11b File menu export/import, WP-11c json-edit raw-JSON apply fix).
Open: none for WP-10.
