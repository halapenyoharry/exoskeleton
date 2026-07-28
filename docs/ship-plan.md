# Ship plan

**Audience: the agent executing this plan (Gemini 3.6 Flash — High).**
**Author: review pass of 2026-07-28. Evidence for every claim here lives in
[ship-review-2026-07-28.md](ship-review-2026-07-28.md) — read that first.**

Goal: take `add-json-panels` from "works on Harold's Mac" to **a public GitHub
release a stranger can download, open, and use** — plus the workspace and
window model that makes the TopoThink fork a configuration change rather than
surgery.

Decisions already made by Harold (do not re-litigate, do not ask again):

| Question | Decision |
| --- | --- |
| Ship target | **Public GitHub release.** Strangers clone or download a build. |
| First launch | **Minimal preset**, with all 16 panels one click away in the ⊞ menu and watermark. |
| Saving | **Both** — app-managed named workspaces *and* export/import to a file. |
| New window | **Both, in order** — repair popout first, then independent workspace windows. |

---

## Rules of engagement

These are Harold's standing rules. Violating one costs more than the work
package is worth.

1. **Never delete files with `rm`.** Use `trash <path>`. Never delete anything
   without asking first.
2. **Never rename a file Harold named.** Not `App.tsx`, not `LanWebview.tsx`,
   not anything. Add alongside.
3. **No code that reaches the internet without explicit permission.** No CDNs,
   no remote fonts, no telemetry. WP-1 exists because this rule was broken.
   The one sanctioned network surface is the webview panel's iframe, because
   loading URLs is its purpose.
4. **Never create standalone scripts** without asking. Prefer npm scripts,
   Makefile targets, or one-liners.
5. **Commit as `halapenyoharry`.** Never attribute commits to an AI. Commit and
   push after each work package — Harold has aphantasia and ADHD, and an
   uncommitted tree is work that can evaporate. Stay on `add-json-panels` or a
   branch off it; **do not commit to `main` without asking.**
6. **Append a dated entry to [SESSIONS.md](SESSIONS.md)** before ending a
   session, in the existing format: State / Last / Next / Open.
7. **Read before you invent.** [AGENTS-FAQ.md](AGENTS-FAQ.md) already answers
   the recurring design questions. Add an entry when you resolve a new one.
8. **Ask when a decision is genuinely ambiguous.** Do not guess at product
   behaviour and do not silently pick a default that changes UX.

## Invariants — breaking these regresses fixed bugs

Each of these was paid for with a debugging session. They look arbitrary. They
are not.

- `addRegistryPanel` must **never** call `addPanel` without a `position`.
  Positionless adds target the *active* group, which can be an edge group —
  that's how every panel once got absorbed into the 118 px status bar.
- `ColoredTab` must keep wrapping `DockviewDefaultTab`. A hand-rolled tab broke
  drag-and-drop.
- `dragDropEnabled: false` stays in `tauri.conf.json`. Tauri's native file-drop
  listener eats Dockview's HTML5 drag on WKWebView.
- Large-document conventions stay: gate **before** the transform, `bypassPerf`
  is session-only `useState` (never a persisted param), subscribe via
  `useJsonDoc`, read counts from `docStats`, never re-walk the document.
- The **registry stays wide**. Sixteen panels remain available. This plan
  changes only which panels are *mounted by default*, never which exist.
- Two *different* multi-window mechanisms exist. Keep them named separately and
  never blur them:
  - **Popout group** — Dockview `window.open` + DOM portal. **Same JS heap.**
    json-bus and the OSC bus work across it.
  - **Workspace window** — Tauri `WebviewWindow`. **Separate JS heap.** No bus
    reaches it; only Tauri events cross.

## Working rhythm

One work package per commit. For each: make the change, run the verification
block, commit, push. If a package's acceptance criteria can't be met, stop and
report — do not proceed to the next package on a broken foundation.

Baseline verification, run after every package:

```bash
npm run build && npm test
```

---

# Phase 0 — Correctness blockers

Nothing else ships until these are done. Each is small and independently
verifiable.

## WP-1 — Bundle Monaco locally, kill the CDN fetch

**Why:** the shipped bundle fetches Monaco from `cdn.jsdelivr.net` at runtime.
Violates rule 3, breaks `json-edit` offline, and loads a different version
(0.55.1) than the one pinned in `package.json` (0.55.0).

**Files:** new `src/monaco-setup.ts`; edit `src/main.tsx`.

**Steps:**

1. Create `src/monaco-setup.ts`:

```ts
// Monaco must be bundled, never fetched. @monaco-editor/react defaults to a
// jsDelivr <script> injection unless loader.config() is given a local monaco.
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    return label === "json" ? new jsonWorker() : new editorWorker();
  },
};

loader.config({ monaco });
```

2. In `src/main.tsx`, import it **before** `App`:
   `import "./monaco-setup";`
3. Align the pin: set `"monaco-editor": "0.55.1"` in `package.json` (exact, no
   caret — a floating Monaco is how versions drift), then `npm install`.

**Acceptance:**

```bash
npm run build
grep -r "jsdelivr\|unpkg\|cdn\." dist/assets/ ; echo "exit=$?"   # must find nothing (exit=1)
```

Then launch and confirm `json-edit` renders with syntax highlighting, and that
the Network tab shows no external requests. **Turn Wi-Fi off and relaunch** —
this is the real test.

**Risk:** Monaco's worker imports need Vite's `?worker` suffix; if the build
errors on the worker imports, check that `vite.config.ts` has no `worker`
overrides (it currently has none) before improvising.

## WP-2 — Repair the popout button

**Why:** ⤴ silently does nothing. Two independent causes; both must be fixed.

**Files:** new `public/popout.html`; edit `src-tauri/src/lib.rs`,
`src-tauri/tauri.conf.json`.

**Cause A — Tauri never allows `window.open`.** wry's WKWebView delegate
returns `None` when `new_window_req_handler` is unset, and Tauri only installs
that handler if the app supplies one via the *builder*. The window is currently
declared in `tauri.conf.json`, so no builder runs.

**Cause B — no popout document.** Dockview's default popout URL is
`/popout.html`, which does not exist in `public/`.

**Steps:**

1. Create `public/popout.html` — an empty shell; Dockview injects the DOM and
   copies stylesheets from the opener:

```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Exoskeleton</title></head>
  <body style="margin:0;background:#0d1326"></body>
</html>
```

2. In `src-tauri/src/lib.rs` `setup()`, build the main window in Rust so the
   handler can be attached. Keep `tauri.conf.json` as the source of window
   config — read it with `WebviewWindowBuilder::from_config`, which exists at
   `tauri-2.11.1/src/webview/webview_window.rs:150`:

```rust
use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};

// inside setup(), BEFORE the get_webview_window("main") block:
let main_config = app
    .config()
    .app
    .windows
    .iter()
    .find(|w| w.label == "main")
    .cloned();
if let Some(cfg) = main_config {
    WebviewWindowBuilder::from_config(app.handle(), &cfg)?
        // Dockview pops out groups via window.open(). Without this handler
        // WKWebView returns nil and the popout silently no-ops.
        .on_new_window(|_url, _features| NewWindowResponse::Allow)
        .build()?;
}
```

   Then **remove the `"main"` entry from `app.windows` in `tauri.conf.json`**
   (replace the array with `[]`) so the window isn't created twice. Keep every
   other property (`dragDropEnabled: false`, sizes, title) in the config object
   you pass to `from_config` — do not retype them as builder calls.

**Acceptance:** click ⤴ on a group. A separate OS window appears containing
those panels. Drag a json viewer out, edit JSON in the main window, and confirm
the popped-out viewer still updates — that proves the shared-heap claim. Close
the popout; panels return to the main grid.

**Fallback if `NewWindowResponse::Allow` yields an unusable window:** stop and
report rather than improvising. The plan-B design (intercept ⤴ ourselves and
open a Tauri `WebviewWindow` on a dedicated route) is a Phase-3-sized change
with different state semantics, and Harold should choose it deliberately.

## WP-3 — Make the whole test suite run

**Why:** `sh` doesn't expand `**` recursively, so only
`src/persistence/storage.test.ts` runs. `src/panels/json-dyadic/parse.test.ts`
has never executed, while the run reports green.

**File:** `package.json`.

**Step:** replace the test script with node's own recursive discovery:

```json
"test": "node --experimental-strip-types --test --test-reporter=spec \"src/**/*.test.ts\""
```

Quoting hands the glob to node instead of `sh`. If node's version balks, use
`--test src` (directory recursion) instead.

**Acceptance:** `npm test` reports tests from **both** files. Confirm the
dyadic parse tests actually pass — they've never been gated, so treat a failure
as a real finding, not as a broken command.

## WP-4 — Cross-platform shell

**Why:** `/bin/zsh` is hardcoded; Pop!_OS is a stated target and doesn't ship
it. `navigator.platform` is deprecated.

**File:** `src/panels/TerminalPanel.tsx`.

**Step:** resolve the shell from the environment, with per-platform fallback.
Use `@tauri-apps/plugin-os` (`platform()`) if you add the dependency, or keep it
dependency-free by reading `SHELL` via the existing pty env. Minimum viable:
prefer the `SHELL` env var; fall back to `/bin/bash` on Unix and
`powershell.exe` on Windows; **never** hardcode zsh.

**Acceptance:** terminal spawns on macOS. If a Pop!_OS box is reachable, verify
there too; otherwise note it as untested in the SESSIONS entry.

## WP-5 — Per-panel error boundary

**Why:** one throwing panel currently blanks the entire window, and the only
recovery is deleting the state file from Finder.

**File:** `src/PanelRoot.tsx`.

**Steps:** add a class-based `PanelErrorBoundary` in that file and have
`exoPanel` wrap the component inside `PanelRoot`. The fallback UI must:

- name the panel and show the error message,
- offer a **Retry** button that resets the boundary's state,
- offer a **Close panel** button (`props.api.close()`),
- keep the accent stripe so the user can tell which panel died.

Log via `console.error` with an `[exoskeleton]` prefix, matching the codebase's
existing convention.

**Acceptance:** temporarily make one panel `throw new Error("boom")` on render.
The other panels stay alive and interactive; the broken one shows the fallback;
Retry and Close both work. Remove the temporary throw before committing.

## WP-6 — Flush pending saves on quit

**Why:** a 400 ms debounce with no flush loses the last change if the user
quits immediately.

**File:** `src/App.tsx`.

**Steps:** give the debounce helper a `.flush()` that runs any pending call
immediately, and call it from a `beforeunload` listener plus Tauri's
`onCloseRequested` on the current window.

**Acceptance:** drag a panel and quit within ~200 ms; relaunch shows the moved
panel.

---

# Phase 1 — First open

## WP-7 — Layout presets, minimal by default

**Why:** first launch currently mounts all fourteen registry panels — PTY,
WebGL, Cytoscape, Monaco, Web Audio, iframe, all at once. Per Harold's
decision: minimal default, everything still discoverable.

**Files:** new `src/persistence/presets.ts`; edit
`src/persistence/default-layout.ts`.

**Steps:**

1. Create `presets.ts`:

```ts
export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  /** Registry panel ids to mount, applied in registry order. */
  panelIds: string[];
}

export const DEFAULT_PRESET_ID = "minimal";

export const presets: LayoutPreset[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Editor, terminal, and a webview. Everything else is one click away.",
    panelIds: ["editor", "terminal", "webview"],
  },
  {
    id: "json-lab",
    name: "JSON Lab",
    description: "Monaco JSON editor feeding the tree, graph, and 3D viewers.",
    panelIds: ["json-edit", "json-tree", "json-graph3d"],
  },
  {
    id: "av-lab",
    name: "AV Lab",
    description: "Tempo clock, piano, and oscilloscope over the OSC bus.",
    panelIds: ["tempo-clock", "piano", "scope"],
  },
  {
    id: "everything",
    name: "Everything",
    description: "The full omni-workshop — every panel in the registry.",
    panelIds: [], // empty means "all of them"; see buildPreset
  },
];
```

2. Add `buildPreset(api, presetId)` to `default-layout.ts`: resolve the preset,
   iterate `panelRegistry` **in registry order**, and call `addRegistryPanel`
   for entries whose id is in `panelIds` (or every entry when `panelIds` is
   empty). Registry order matters — later entries position relative to earlier
   ones.
3. Keep `buildDefaultLayout(api)` as a thin wrapper over
   `buildPreset(api, DEFAULT_PRESET_ID)` so existing call sites (`App.tsx`,
   `Watermark.tsx`) keep working unchanged.

**Note — this needs no new fallback logic.** When `json-tree` is in a preset
but its reference panel `json-edit` isn't, `addRegistryPanel` already anchors to
the main grid instead. That path exists; don't rebuild it.

**Acceptance:** delete the state file, relaunch, see exactly three panels. The
⊞ menu and watermark still list all sixteen. Launch is visibly faster.

## WP-8 — Stop force-adding new panels to existing layouts

**Why:** `migrateLayout` injects every newly-introduced panel into every saved
layout. Acceptable when the default was "everything"; an intrusion once layouts
are user-authored workspaces.

**File:** `src/persistence/default-layout.ts`.

**Steps:** add `autoAdd?: boolean` to `RegistryEntry`. `migrateLayout` adds a
version-newer panel **only** when `autoAdd === true`. Set `autoAdd` on no
existing entry.

**This does not remove anything.** Every panel stays in the registry, the ⊞
menu, the watermark, and every preset that names it. What changes is only
whether an app update reaches into an arrangement the user made and inserts
tabs. That distinction matters — read the *accumulate, don't replace* principle
before touching this file, and preserve it.

**Acceptance:** with a saved v7 layout, bumping `CURRENT_VERSION` and adding a
registry entry leaves the saved layout untouched, while the new panel is
present in the ⊞ menu.

## WP-9 — Visible reset and preset switching

**Why:** the only documented reset is "delete a file in
`~/Library/Application Support/`". The watermark's restore button only appears
once the grid is already empty.

**Files:** `src/Watermark.tsx`, `src/App.tsx`, `src/panels/settings/`.

**Steps:**

1. Watermark: replace the single "restore default layout" button with a preset
   chooser (name + description per preset), built on `buildPreset`.
2. Add "Reset layout to preset…" to the ⊞ menu, always reachable — not only
   from an empty grid. It must confirm before discarding the current
   arrangement, and it operates on the **active workspace only** (see Phase 2).

**Acceptance:** from a full, messy grid a user can return to a known-good state
without leaving the app or touching Finder.

---

# Phase 2 — Workspaces

Harold chose **both**: named workspaces managed by the app, plus export/import
to a file. Build the storage model first, then the UI, then the file bridge.

## WP-10 — Workspace storage model (schema v8)

**Files:** `src/persistence/storage.ts`, `src/persistence/tauri-storage.ts`,
`src/App.tsx`.

**Target shape:**

```ts
export interface WorkspaceDoc {
  id: string;              // stable slug
  name: string;            // user-visible, editable
  createdAt: string;       // ISO 8601 — absolute dates only
  updatedAt: string;       // ISO 8601
  presetId?: string;       // which preset it was created from, if any
  layout: SerializedDockview;
}

export interface AppState {
  version: number;                            // 8
  workspaces: Record<string, WorkspaceDoc>;
  activeWorkspaceId: string;
  preferences?: Preferences;
}
```

**Migration v7 → v8** (in `storage.ts`, alongside the existing version notes):
wrap the old top-level `layout` into
`workspaces["default"] = { id: "default", name: "Workspace 1", layout, createdAt: now, updatedAt: now }`
and set `activeWorkspaceId: "default"`. Nobody loses a layout. Add a comment
block to the version history exactly as versions 1–7 did — that history is a
deliberate artifact.

**Critical: change the save path to read-modify-write.** Today `save()`
overwrites the entire `AppState`. With multiple windows (Phase 3) that means
window B's save erases window A's workspace. Replace the blanket `save(state)`
with targeted operations on the `Storage` interface:

```ts
saveWorkspace(doc: WorkspaceDoc): Promise<void>;   // get → merge one key → set
savePreferences(prefs: Preferences): Promise<void>;
setActiveWorkspace(id: string): Promise<void>;
listWorkspaces(): Promise<WorkspaceDoc[]>;
deleteWorkspace(id: string): Promise<void>;
```

Each does a `store.get` → mutate one key → `store.set` → `store.save`. Keep
`load()` for startup. Keep the existing adapter split intact — `storage.ts`
stays environment-agnostic, `tauri-storage.ts` stays the only Tauri-aware file.

**Acceptance:** launching with a v7 state file preserves the layout exactly and
rewrites it as v8 with one workspace. `isCompatible` accepts 1–8. Extend
`storage.test.ts` with a v7→v8 migration test — this is the highest-value new
test in the plan, because a bad migration destroys real user layouts.

## WP-11 — Workspace UI

**Files:** `src/panels/settings/SettingsPanel.tsx` (+ CSS),
`src-tauri/src/lib.rs`, `src/App.tsx`.

**Steps:**

1. Add a **Workspaces** section at the top of the settings panel, above the raw
   JSON: a list of workspaces with the active one marked, plus New (from
   preset), Switch, Rename, Duplicate, Delete, and Reset-to-preset. Deleting
   asks for confirmation and refuses to delete the last remaining workspace.
2. Switching workspaces calls `api.fromJSON(next.layout)` on the live Dockview
   after saving the current one. Run `repairLayout` after `fromJSON`, exactly
   as `onMainReady` does — same hazards apply.
3. Add a **File** menu in `lib.rs` mirroring the existing View menu, emitting
   Tauri events the frontend already knows how to listen for:
   `New Workspace ⇧⌘N`, `Switch Workspace…`, `Export Workspace… ⇧⌘S`,
   `Import Workspace…`.
4. **Fix the raw-JSON apply path** (review finding 9): it currently writes to
   disk and is clobbered by the next autosave. Either apply the edited layout
   live via `fromJSON`, or disable apply for the layout section and say so.
   Silently losing the user's edit is not an option.

**Menu-event gotcha:** `handle.emit(...)` broadcasts to *every* window. Once
Phase 3 lands, a menu action must reach only the focused window — use
`handle.get_focused_window()` and emit to that window specifically. Wire it
that way now so it doesn't need revisiting.

**Acceptance:** create a second workspace from a different preset, switch back
and forth, rename one, delete it. Relaunch restores the workspace that was
active. No layout is ever silently lost.

## WP-12 — Export / import workspace files

**Files:** new `src/persistence/workspace-file.ts`; wire into the settings
panel and File menu.

**Steps:** export writes a single `WorkspaceDoc` as pretty-printed JSON via
`@tauri-apps/plugin-dialog`'s `save()` + `fs.writeTextFile`, with a `.exo.json`
extension. Import reads a file, validates it (`version`, `layout`, `name`
present), assigns a **fresh id** to avoid colliding with an existing workspace,
and adds it to the store.

Include a small `exoFormat` field in the exported file (`{ exoFormat: 1, ... }`)
so a future format change is detectable rather than guessed.

**Acceptance:** export a workspace, delete it, import the file back, and get an
identical layout. Hand the file to another machine and confirm it opens — this
is the mechanism forks will use to ship starter workspaces.

## WP-13 — `json-edit` remembers its document

**Why:** `EditorPanel` persists its open file path and reopens on mount;
`json-edit` keeps its path in `useState` and forgets it. A restored workspace
therefore restores the frame but not the contents — and every viewer is blank
until the user re-opens the file by hand. This matters most in the fork.

**File:** `src/panels/json-edit/JsonEditPanel.tsx`.

**Steps:** add `filePath?: string` to `JsonEditParams`; persist it through
`props.api.updateParameters` on open/save-as, exactly as
[EditorPanel.tsx:41-44](../src/panels/EditorPanel.tsx#L41-L44) does; re-read the
file on mount and publish to the json-bus. If the file is gone, warn to the
console, clear the param, and leave the buffer empty — mirror `EditorPanel`'s
error path.

**Persist the path only, never the buffer.** A 30k-node document in panel
params would bloat the state file and load eagerly at every launch — that is
precisely the anti-pattern AGENTS-FAQ records.

**Acceptance:** open a JSON file in `json-edit`, relaunch, and the document
reloads with every viewer populated.

---

# Phase 3 — Workspace windows

Only after Phase 2. WP-2 has already repaired the *popout* mechanism; this adds
the genuinely separate one.

## WP-14 — New Window opens an independent workspace

**Semantics** (Harold's choice — "a new window that isn't the same"): a new
window runs a **different workspace**, with its own JS heap and no shared live
state. This deliberately avoids cross-window IPC.

**Files:** `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`,
`src/App.tsx`, `src/persistence/tauri-storage.ts`.

**Steps:**

1. Rust command `open_workspace_window(workspace_id: String)` that creates a
   `WebviewWindow` labelled `exo-<workspace_id>` at
   `index.html?workspace=<id>`. If a window with that label exists, focus it
   instead of creating a duplicate. Attach the same
   `.on_new_window(|_, _| NewWindowResponse::Allow)` from WP-2 so popouts work
   in secondary windows too.
2. **Grant capabilities to the new windows.** `capabilities/default.json`
   currently reads `"windows": ["main"]`. New windows get **no permissions** —
   fs, store, pty, dialog all fail silently. Change it to
   `"windows": ["main", "exo-*"]`. This is the single most likely thing to be
   missed in this package; verify it explicitly by opening a file from a
   secondary window.
3. `App.tsx` reads `?workspace=` from `window.location.search` at startup and
   binds to that workspace; absent the parameter, it uses `activeWorkspaceId`.
4. Each window saves **only its own workspace**, through the read-modify-write
   operations from WP-10. Never write the whole `AppState` from a window.
5. Guard against the same workspace being open in two windows — either focus
   the existing window (preferred) or open read-only. Two windows autosaving
   one workspace will fight.
6. Add `New Window ⌘N` to the File menu, and a per-workspace "Open in new
   window" action in the workspace list.

**Acceptance:** open workspace B in a second window; rearrange panels in each;
close and relaunch; both workspaces retain their own arrangement. Opening a
file from the second window's editor works (proves capabilities). A ⤴ popout
from the second window works (proves the handler is attached there too).

**Do not** attempt to sync json-bus or OSC across windows. That is explicitly
out of scope; the buses are in-process by design. If a future need arises,
[AGENTS-FAQ.md](AGENTS-FAQ.md) and the hypergraph doc already sketch the
revision-gated IPC approach — that's a separate project.

---

# Phase 4 — Public-release hygiene

## WP-15 — LICENSE and metadata

Without a license, a public repo grants nobody any rights. **Ask Harold which
license** (MIT and Apache-2.0 are the usual choices; MIT is simplest, Apache-2.0
adds a patent grant) — do not pick one unilaterally, it's not a reversible
technical detail.

Then: add `LICENSE` at the repo root, `"license"` in `package.json`, `license`
in `Cargo.toml`, and a Tauri bundle `copyright` string. Add a `publisher` and a
`shortDescription`/`longDescription` to the bundle config while you're there.

## WP-16 — Content Security Policy

Set a real CSP in `tauri.conf.json` instead of `null`. It must allow the
webview panel to keep embedding arbitrary LAN and web pages while locking down
the app origin. Starting point, to be tested against every panel:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self' data:;
connect-src 'self' ipc: http://ipc.localhost;
frame-src *; worker-src 'self' blob:
```

`frame-src *` is deliberate — the iframe panel exists to load whatever the user
points it at, and cross-origin iframes cannot reach Tauri IPC. `worker-src
blob:` is required by Monaco after WP-1. **Test all sixteen panels** after this
change; a CSP that breaks Cytoscape or three.js is worse than none, because it
fails at runtime in ways the build won't catch.

## WP-17 — CI

Add `.github/workflows/ci.yml`: on push and PR, run `npm ci`, `npm run build`,
`npm test` on `ubuntu-latest` and `macos-latest`, plus `cargo check` in
`src-tauri`. The Linux leg is what would have caught the hardcoded `/bin/zsh`.

Add a `tauri build` job on tag push producing `.dmg` and `.AppImage` artifacts.

## WP-18 — Code splitting

One 2.93 MB chunk today. With a minimal default layout, the heavy panels
(`json-graph3d` → three.js, `json-cytoscape` → cytoscape, `json-edit` → Monaco,
`terminal` → xterm) should load on demand. Wrap those four in `React.lazy` with
a `Suspense` fallback inside `exoPanel`, and confirm Vite emits separate chunks.

Do not lazy-load panels in the minimal preset — they're needed at first paint
and lazying them just adds a flash.

## WP-19 — Signing and notarization

**Decided 2026-07-28: ship unsigned.** No Apple Developer Program for now.

An unsigned `.dmg` shows macOS users a "damaged and can't be opened" dialog,
which reads as *broken* rather than *unsigned*. So the README must document the
`xattr -dr com.apple.quarantine /Applications/Exoskeleton.app` step
prominently, at the install instructions themselves — not buried in a
troubleshooting section — with one plain sentence explaining why it's needed.
Do the same for the Linux `.AppImage` chmod step.

This is cheap to reverse later: notarization is a CI-and-secrets change, not an
architecture change. Nothing in the plan depends on staying unsigned.

## WP-20 — README for strangers

The README is currently an excellent *fork-and-build* guide and a poor *install
and use* guide. Add, above the existing content: what the app is in two
sentences, a screenshot, install instructions per platform, the first-run
experience, how workspaces work, and how to reset. Keep the fork guide — move
it below, under a clear heading. **Do not delete existing sections**; the
self-similar/fractal section in particular is Harold's writing and stays
verbatim.

Also correct the popout description: popouts share a JS heap with the main
window (they're `window.open` + portal). The current "each popout is its own
React tree" claim is wrong and misleads anyone reasoning about state.

---

# Phase 5 — Fork preparation (TopoThink graph viewer)

Not part of shipping Exoskeleton; this is what shipping *enables*. Do not start
it until Phases 0–4 are done and Harold says go.

Once presets and workspaces exist, the fork is configuration rather than
surgery:

1. Fork the repo; change `identifier`, `productName`, and the bundle metadata
   in `tauri.conf.json` (a different identifier means a separate state file, so
   both apps coexist cleanly).
2. Set the default preset to a TopoThink-shaped one (`json-edit` +
   `json-graph3d` + `json-dyadic` + status bar).
3. Prune the registry to the panels that fork needs — **in the fork only.**
   Exoskeleton's own registry stays wide.
4. Ship a starter workspace as an importable `.exo.json` (WP-12).

Write this procedure into the fork's own README as it's executed, and add an
AGENTS-FAQ entry here recording what the first real fork revealed about the
contract.

---

# Definition of done

Shipping is a state, not a feeling. It's reached when all of these hold:

- [ ] `npm run build && npm test` green, with **both** test files running.
- [ ] No external network request at runtime except the webview panel's iframe.
- [ ] Airplane-mode launch: every panel works.
- [ ] Fresh state file → minimal layout, fast launch, all 16 panels discoverable.
- [ ] A stranger can reset to a known-good layout without leaving the app.
- [ ] Workspaces: create, switch, rename, duplicate, delete, export, import.
- [ ] ⤴ popout opens a real window and stays live on the buses.
- [ ] ⌘N opens a second window running a different workspace, with working
      file access.
- [ ] A panel that throws does not take the window down.
- [ ] LICENSE present; CI green on macOS and Linux.
- [ ] README opens with install-and-use, not fork-and-build.
- [ ] SESSIONS.md has an entry per session; every package committed and pushed
      as `halapenyoharry`.
</content>
