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
| License | **AGPL-3.0-or-later**, with commercial licenses offered separately. See WP-15. |
| macOS signing | **Unsigned for now.** Document the quarantine workaround. See WP-19. |

---

## Rules of engagement

Two kinds of rule follow, and the difference matters.

**Hard constraints (1–4) are about trust and irreversibility.** Follow them.
They are not optimization targets, and no cleverness justifies working around
one.

**Strong defaults (5–8, plus the scope rules further down) encode a reason.**
Follow them by default — but if you can see a genuinely better way, *say so and
ask*. Harold's explicit instruction on this, 2026-07-28: a constraint he set
shouldn't be honoured past the point where another approach is clearly better.
What he doesn't want is either failure mode — rigidly complying into a worse
outcome because a rule said so, or quietly deviating because you decided you
knew better. Name the tension, propose the alternative, and let him choose. A
one-line "this rule says X, but Y is better here because Z — which do you want?"
costs almost nothing and is usually welcome.

### Hard constraints

1. **Never delete files with `rm`.** Use `trash <path>`. Never delete anything
   without asking first.
2. **Never rename a file Harold named.** Not `App.tsx`, not `LanWebview.tsx`,
   not anything. Add alongside.
3. **No code that reaches the internet without explicit permission.** No CDNs,
   no remote fonts, no telemetry. WP-1 exists because this rule was broken.
   The one sanctioned network surface is the webview panel's iframe, because
   loading URLs is its purpose.
4. **Never attribute a commit to an AI.** Commits are authored as
   `halapenyoharry`.

### Strong defaults

5. **Don't create standalone scripts** without asking. Prefer npm scripts,
   Makefile targets, or one-liners — scattered scripts rot and get forgotten.
6. **Commit as `halapenyoharry`.** Never attribute commits to an AI. Commit and
   push after every work package, without exception — an uncommitted tree is
   the single most common way progress gets lost on this project. Stay on
   `add-json-panels` or a branch off it; **do not commit to `main` without
   asking.**
7. **Append a dated entry to [SESSIONS.md](SESSIONS.md)** before ending a
   session, in the existing format: State / Last / Next / Open.
8. **Read before you invent.** [AGENTS-FAQ.md](AGENTS-FAQ.md) already answers
   the recurring design questions. Add an entry when you resolve a new one.
9. **Ask when a decision is genuinely ambiguous.** Do not guess at product
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

## Working rhythm — test-driven, one package per context window

**Each work package is sized to be started and finished in one sitting.** Start
it, finish it, commit it, push it, and let the next one start clean. If a
package feels too large to complete in one pass, it says so and names its own
split (WP-10, WP-11, and WP-14 are already split for this reason). Never carry
half a package across a summarization boundary — **the plan document is the
handoff, not your memory of the conversation.**

### What your actual limits are, and what follows from them

Running as Gemini 3.6 Flash (High) in Antigravity you have a 1,048,576-token
input window, a 65,536-token output cap per response, and the IDE summarizes
conversation history at a 7,500-token threshold. Each of those implies
something concrete:

- **Input is not your constraint — use it.** This entire repo is roughly 11,000
  lines of source. You can afford to *read the actual files* before editing
  them, and you should. Do not pattern-match from a filename or infer an API
  from its name. Every wrong guess in this codebase has a comment above it
  explaining why it was wrong.
- **Output is capped at 64k per response, so prefer targeted edits over
  rewriting files.** If a package seems to require emitting more than a few
  hundred lines of new code in one go, you have mis-scoped it — re-read the
  package and find the split it names.
- **Your conversation memory is summarized aggressively.** This is the one that
  will actually bite you. Do not rely on "what I decided earlier" or "the file
  I looked at before" — that detail may already be gone. Therefore:
  - **Re-read this plan's package section at the start of every package**, plus
    the files it names. Treat each package as a cold start.
  - **Externalize state into the repo, not the chat.** Commit after every
    package with a message that explains *why*, and append to
    [SESSIONS.md](SESSIONS.md) at the end of a session. A future summarized
    you — or a different model entirely — recovers from those, not from
    scrollback.
  - **If you notice you're unsure what you already did, check `git log` and
    `git status` rather than guessing.** They are authoritative; your memory of
    the session is not.

**Every package is test-driven.** The cycle, without exception:

1. **Red.** Write the failing test first, from the package's *Test first*
   block. Run it. Watch it fail for the reason you expect — a test that passes
   before the implementation exists is testing nothing.
2. **Green.** Write the smallest implementation that passes.
3. **Verify.** Run `npm run build && npm test`, then the package's manual
   acceptance steps in the running app.
4. **Commit and push.** One package, one commit.

**The constraint that shapes all of this:** the project uses node's built-in
test runner with no DOM environment, and per the scope rules you may not add
one. So you can unit-test **pure functions only** — no React components, no
Dockview, no Tauri APIs.

Treat that as design pressure rather than a limitation. It means: **extract the
logic out of the component before you write it.** Preset resolution, workspace
migration, workspace-file validation, shell selection, debounce flushing — each
becomes a pure module with a test, and the component becomes a thin caller.
That is better code than the alternative, and it is why this plan keeps
splitting "the logic" from "the wiring."

Where a package genuinely can't be unit-tested — an error boundary, a Rust
window handler, a CSP — its *Test first* block says **manual** and gives an
exact click-path instead. Follow it literally and report what you saw. "Seems
to work" is not a result.

**Run this after every package:**

```bash
npm run build && npm test
```

Both must be green before you commit. If a test you didn't touch starts
failing, stop and report — do not "fix" it by changing the assertion.

## Operating notes — traps this environment actually sets

Read these before your first command. Each has bitten a previous session.

**Running the app is your job, not Harold's.** Never hand him a command and ask
what happened. Launch it yourself in the background, drive it, read the logs,
and only report once it works. Three places to look when it doesn't: the
auto-opened WebKit Inspector, `~/Library/Logs/dev.harold.exoskeleton/`, and the
`npm run tauri dev` terminal output.

**Port 1420 orphans.** A stale dev server holding 1420 has broken the launch
twice. `strictPort: true` means Vite fails rather than picking another port.
Check with `lsof -i :1420` and kill the orphan before assuming a real failure.

**The first Rust compile takes 5–15 minutes.** Subsequent builds are seconds. A
long first build is not a hang — do not kill it and do not "fix" it.

**HMR does not preserve bus state.** The json-bus is in-memory, so any code
reload empties every viewer. When verifying JSON work, re-open a document after
each reload; a blank viewer after HMR is expected, not a regression.

**A dev server and an app instance may already be running** when you start.
Check before launching a second one.

**Cross-repo coupling.** Panels are developed in
`~/Projects/exoskeleton-component-library/` against the `PanelManifest`
contract in [src/panel-manifest.ts](../src/panel-manifest.ts). If you add a
field to `RegistryEntry` that mirrors a manifest field — WP-8's `autoAdd` is
exactly this — add it to `PanelManifest` too and tell Harold, so the library
README stays truthful. A silent divergence between the two breaks every future
panel install.

**Scope discipline.** Gemini-class models tend to over-deliver here, and it
costs more than it gives:

- No refactors beyond the work package you're on.
- No reformatting files you're otherwise editing. Diff noise makes review
  expensive and hides the real change.
- No dependency upgrades that a package doesn't name.
- No new test framework *by default*. The project deliberately uses node's
  built-in test runner, and the TDD protocol is built around that constraint.
  But if you hit a package where the only honest verification needs a DOM — and
  you can show which package and why manual verification isn't enough — propose
  it rather than either silently adding jsdom or shipping an untested change.
  Harold decides; don't decide for him in either direction.
- No new documentation files unless a package asks for one. Extend
  [AGENTS-FAQ.md](AGENTS-FAQ.md) instead.

**Stop and ask Harold when:** a package's acceptance criteria can't be met; a
fix requires changing one of the invariants above; a migration might destroy
existing user layouts; a decision changes visible behaviour in a way this plan
doesn't specify; or you find yourself about to delete something. Report the
finding and wait. A blocked package that's clearly reported is a good outcome;
a guessed-at product decision is not.

---

# Phase 0 — Correctness blockers

Nothing else ships until these are done. Each is small and independently
verifiable.

## WP-0 — Make the test suite real (do this first)

**Why first:** every other package in this plan is test-driven, and right now
the test runner silently skips most of the suite. You cannot do TDD on top of a
runner that doesn't run your tests.

Two defects:

1. `npm test` runs `node --experimental-strip-types --test src/**/*.test.ts`.
   npm executes scripts under `sh`, where `**` is not recursive — it behaves as
   a single `*`. Only `src/persistence/storage.test.ts` is discovered;
   `src/panels/json-dyadic/parse.test.ts` (171 lines) has never executed, while
   the run reports green.
2. `parse.test.ts` reads fixtures from the hardcoded absolute path
   `/Users/harold/Projects/speak/topology` — another repo, on one machine. It
   skips gracefully when absent, so on any other machine (and in CI) those
   assertions are vacuous. A public repo must not carry a personal absolute
   path, and a test that silently tests nothing is worse than no test.

**Test first:** before changing anything, run `npm test` and record the count.
It should report 5 passing. That number is the "before" you're fixing.

**Steps:**

1. `package.json`: quote the glob so node expands it instead of `sh` —
   `"test": "node --experimental-strip-types --test --test-reporter=spec \"src/**/*.test.ts\""`.
   If node's version balks, use `--test src` for directory recursion.
2. **Build a synthetic fixture** at `src/panels/json-dyadic/__fixtures__/`,
   hand-written to exercise the edge cases the parser actually has to get
   right: a dyadic incidence, a three-member hyperedge, each of the four
   `i2t:edge_category` values, a dangling reference, and a malformed entry.
   Do **not** copy the real corpus in — decided 2026-07-28. A 500-node real
   document is a poor unit-test fixture (slow, and a failure tells you
   "something changed" rather than which case broke), and that content belongs
   to another project that isn't going public.
3. Replace the hardcoded `SPEAK_DIR` with the in-repo fixture path, keeping an
   optional `process.env.EXO_TOPOLOGY_DIR` override so Harold can still run the
   suite against the real corpus locally. The fixture is the default.
4. **Remove `"runOn": "folderOpen"` from `.vscode/tasks.json`.** Pulled forward
   from WP-21 deliberately: that trigger spawns a dev server every time the
   folder opens, which is what leaves orphans holding port 1420 — the trap
   documented in the operating notes. It will bite you repeatedly across a
   twenty-package run, so fix it in the first hour rather than the last. Keep
   the task itself; only the automatic trigger goes.

**Acceptance:** `npm test` reports tests from **both** files, and the dyadic
assertions actually execute rather than skipping. Verify by temporarily
breaking one assertion and confirming the suite goes red.

**Expect this to surface real failures.** The parse suite has never gated a
commit. If it fails, that is a genuine finding — report it, don't weaken the
assertion to get green.

## WP-1 — Bundle Monaco locally, kill the CDN fetch

**Test first (manual + CI guard):** there is no unit test for "did a bundler inline a dependency." Write the guard as a shell assertion you run after building, and hand it to WP-17 to put in CI:
`npm run build && ! grep -rq "jsdelivr\|unpkg" dist/assets/`
Run it before the fix and confirm it *fails*. That failing command is your red.

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

**Test first (manual):** click ⤴ on a group now and record exactly what happens (nothing). That is your red. Green is: a separate OS window appears, and a json viewer inside it still updates live when you edit JSON in the main window.

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


## WP-4 — Cross-platform shell

**Test first:** extract a pure `resolveShell(platform: string, env: Record<string,string|undefined>): string` into its own module and test it *before* wiring it into the panel. Cases: `SHELL` set on darwin returns it; `SHELL` unset on darwin returns `/bin/zsh`; `SHELL` unset on linux returns `/bin/bash`; win32 returns `powershell.exe`; empty-string `SHELL` is treated as unset. The panel then does nothing but call it.

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

**Test first (manual):** temporarily add `throw new Error("boom")` to one panel's render. Before the fix, the whole window goes blank — that is your red. After, the other panels stay interactive and the broken one shows a fallback with working Retry and Close. Remove the throw before committing.

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

**Test first:** the debounce helper in `App.tsx` is pure and currently untestable only because it is inline. Extract it to its own module with a `flush()` method and test it: a call inside the window then `flush()` invokes the function exactly once, immediately; `flush()` with nothing pending is a no-op; a second `flush()` does not double-invoke. Use fake timers or a small sleep — no DOM needed.

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

**Test first:** `presets.ts` is pure. Test before building any UI: every preset id is unique; every `panelIds` entry names a real `panelRegistry` id (this catches typos permanently); `minimal` contains exactly editor, terminal, webview; the `everything` preset resolves to the full registry. Add a `resolvePresetPanelIds(id)` helper so the empty-array-means-all rule is tested rather than duplicated at call sites.

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
    // The status bar is JSON-aware (node/edge counts, selection), so it earns
    // its place here and nowhere else. In Minimal it would sit showing zeros.
    panelIds: ["json-edit", "json-tree", "json-graph3d", "status-bar"],
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

**Test first:** extract the decision as a pure `panelsToAutoAdd(savedVersion: number)` returning registry entries, and test it before touching `migrateLayout`. Cases: a version-newer entry *without* `autoAdd` is excluded; one *with* `autoAdd` is included; entries at or below the saved version are always excluded; an empty result for a current-version save.

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

**Test first (manual):** from a deliberately messy grid, confirm you can reach a known-good layout without leaving the app or touching Finder. Check the confirmation step actually protects — cancel it and verify nothing changed.

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

**Split into three context windows. Do not attempt in one pass:**

- **WP-10a — types and migration.** `WorkspaceDoc`/`AppState` types plus `migrateState`. Test-only; no UI, no wiring.
- **WP-10b — storage operations.** The read-modify-write ops, with the merge logic extracted pure and tested.
- **WP-10c — wiring.** `App.tsx` reads and writes through the new operations. Manual verification.

**Test first (WP-10a — the highest-value tests in this plan, because a bad migration destroys real layouts):** extend `storage.test.ts` before writing the migration. Cases: a v7 state produces one workspace named `Workspace 1` whose `layout` is byte-identical to the v7 `layout`; `activeWorkspaceId` points at a workspace that exists; a v8 state passes through unchanged; `isCompatible` accepts 1–8 and rejects 9 and non-numbers; preferences survive the migration. Then write the migration.

**Test first (WP-10b):** extract the merge as a pure `mergeWorkspace(state, doc)` and test that it replaces exactly one workspace, leaves every sibling untouched, and updates `updatedAt`. That last property is what prevents one window erasing another's workspace in Phase 3 — test it now, before the bug can exist.

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

**Split into three context windows:**

- **WP-11a** — the workspace list, switching, rename, duplicate, delete.
- **WP-11b** — the File menu in `lib.rs` plus focused-window event emission.
- **WP-11c** — fixing the raw-JSON apply path.

**Test first:** the pure part is the guard logic — extract `canDeleteWorkspace(state, id)` and test that deleting the last workspace is refused and that deleting the active one is allowed only when another exists. Everything else is manual: create a second workspace, switch back and forth, rename, delete, relaunch, and confirm the active one is restored.

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

**Test first:** both halves are pure and belong in `workspace-file.test.ts` before any dialog code. Validation cases: a well-formed doc passes; missing `layout`, missing `name`, wrong `exoFormat`, and non-object input each fail with a distinct message. Import cases: `prepareImport(doc, existingIds)` always assigns an id not present in `existingIds`, preserves the name, and does not mutate its input.

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

**Test first (manual):** open a JSON file, relaunch, and confirm the document reloads with every viewer populated. Then delete the file on disk and relaunch again — it must warn to the console, clear the param, and leave an empty buffer rather than throwing. Mirror `EditorPanel`'s error path exactly.

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

**Split into two context windows:**

- **WP-14a** — the Rust command plus the capabilities change. Verify in isolation: a second window opens, and a file dialog inside it works (that proves capabilities).
- **WP-14b** — frontend workspace binding and save isolation.

**Test first (manual, and be literal):** open workspace B in a second window; rearrange panels in *both*; close both; relaunch. Each workspace must retain its own arrangement. The failure this is guarding against is one window silently overwriting the other, so verify both, not one.

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

**Decided 2026-07-28: AGPL-3.0-or-later, with commercial licenses available
separately.** `LICENSE` (canonical FSF text) and `CONTRIBUTING.md` are already
committed. What remains is the metadata and the README wording.

The reasoning, so nobody undoes it by accident: Harold wants genuine open
source *and* wants large businesses to have a reason to make contact. Those
only coexist through **copyleft plus dual licensing**. Anyone may use, study,
modify, and share Exoskeleton, including commercially; but distributing a
derived work — or running a modified version as a network service — obliges
them to release their source under the AGPL too. Companies that want to build
something proprietary on it therefore come and ask for commercial terms. This
is the MySQL / Qt / Grafana model.

Dependency compatibility was verified before choosing: every npm and Cargo
dependency is MIT, ISC, or Apache-2.0, and a scan found no GPL/AGPL/SSPL
anywhere in the tree. Apache-2.0 is compatible with GPLv3-family licenses
specifically, so AGPL-3.0 is clean here. **If you ever add a dependency, check
its license before adding it** — a GPLv2-only dependency would be incompatible
and would poison the dual-licensing model.

Remaining steps:

1. `package.json`: `"license": "AGPL-3.0-or-later"`.
2. `src-tauri/Cargo.toml`: `license = "AGPL-3.0-or-later"`.
3. `tauri.conf.json` bundle block: `"copyright": "© 2026 Harold Tajchman"`,
   plus `publisher`, `shortDescription`, and `longDescription`.
4. README gets a **License** section, in plain language: free and open source
   under AGPL-3.0; use it, fork it, study it; if you want to ship something
   proprietary built on it, email halapenyoharry@gmail.com. Do not write this
   as legal boilerplate — write it as an invitation.
5. Link `CONTRIBUTING.md` from the README.

**Do not add per-file AGPL headers** unless Harold asks. The license section
the AGPL recommends adding to every source file would add noise to sixteen
panels and every module, and the repo-root LICENSE is sufficient for a project
distributed whole.

**Why `CONTRIBUTING.md` is load-bearing, not paperwork:** dual licensing only
works while Harold holds the rights to the entire codebase. One merged pull
request without the inbound grant permanently blocks commercial licensing of
that file. If someone opens a pull request and declines the grant, do not merge
it — reimplement the idea or leave it.

## WP-16 — Content Security Policy

**Test first (manual, all sixteen panels):** a CSP that breaks Cytoscape or three.js fails at runtime in ways the build cannot catch. Open every panel with devtools console visible and confirm zero CSP violations logged. Pay particular attention to Monaco (needs `worker-src blob:`), the 3D graph, and the iframe.

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

## WP-21 — Pre-publication privacy sweep (the last gate)

**This is the final package before the repo goes public, and Harold flips that
switch himself — you never do.** Your job is to leave the tree in a state where
flipping it is safe and boring.

The repository has been private its whole life, so personal material has
accumulated in it that was never meant for strangers. Move it into a gitignored
`private/` folder rather than deleting it — every item here is still useful to
Harold, just not to the public.

**Steps:**

1. Add `private/` to `.gitignore` and create the folder.
2. Move each item below with `git mv` into `private/`, then `git rm --cached`
   anything that needs to leave the index while staying on disk. **Use `trash`,
   never `rm`, if something genuinely must go.**
3. Commit the move as its own change so the diff is reviewable.

**The inventory, as found on 2026-07-28** — re-scan before executing, since
this list ages:

| Item | Why it moves |
| --- | --- |
| `hud.pxd` | An 18 MB binary design file from the pre-rename era. Nothing builds from it, and it weighs on every clone forever. |
| `exoskeleton-ANTIGRAV.code-workspace` | Personal multi-root editor config pointing at a sibling checkout. The plain `exoskeleton.code-workspace` stays. |

**That is the whole move list. Deliberately short** — an earlier draft of this
package also moved `docs/SESSIONS.md` and the two ship documents, and that was
reconsidered on 2026-07-28. `SESSIONS.md` is the most valuable document in the
repository for anyone trying to understand or fork it: a real record of how a
workspace gets built, mistakes and reversals included. Hiding it to avoid a
handful of personal references trades a genuine asset for very little. Same for
the ship review — a project that publishes its own candid critique reads as
confident rather than sloppy.

**Redact instead of moving:**

- `docs/SESSIONS.md` — remove the references to `elinor-jones` (an unpublished
  novel's dataset) and the machine-specific absolute paths. Replace the dataset
  name with a neutral description like "a 30k-value hypergraph document"; the
  engineering content is what matters and it survives redaction intact. Leave
  the "Harold does X" phrasing — it's a lab notebook, and that reads fine.
- `CLAUDE.md` — drop the reference to the private agent-memory directory and the
  personal-working-style line; keep all the architectural guidance. Agent
  instruction files are normal in public repos now.
- Confirm WP-0 removed the hardcoded `/Users/harold/Projects/speak/topology`
  path from `parse.test.ts`. If it's still there, it must not ship.

**Then re-run the secret scan** and report the result verbatim:

```bash
git grep -nIE "(api[_-]?key|secret|password|token|BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})" -- . ':!package-lock.json'
git log --all --pretty=format: --name-only --diff-filter=A | sort -u | grep -iE "\.env|\.pem$|\.p12$|id_rsa|credential|\.key$"
```

A clean scan was recorded on 2026-07-28 — no keys, no `.env`, no credential
files in any commit. Verify it's still clean rather than assuming.

**The history question — decided 2026-07-28: rewrite, narrowly.** Moving a file
out of the index does not remove it from history; `hud.pxd` stays in the pack
files whether or not it's in the working tree, and every future clone pays for
it. Normally rewriting history is dangerous because it invalidates everyone's
existing clones — but this repository has never been public and has a single
contributor, so there are no clones to break. That objection doesn't apply here.

So: **use `git-filter-repo` to drop `hud.pxd` and nothing else.** Leave the
document history alone — it contains no credentials, and the engineering
narrative is an asset rather than a liability.

This is still a destructive, hash-rewriting operation. Before running it:

1. Take a full backup: `git clone --mirror` the repo to a bundle outside the
   working tree, and confirm the bundle is readable.
2. Tell Harold you are about to force-push and get an explicit go-ahead **for
   this specific run** — a decision recorded in a document is not the same as
   permission at the moment of execution.
3. Verify afterwards that `git log --all --diff-filter=A --name-only | grep
   hud.pxd` returns nothing, and report the new clone size.

**Acceptance:** `git ls-files` shows no personal material; `private/` exists,
is gitignored, and still contains both moved files on disk; the secret scan is
clean; a fresh clone into a temp directory produces a tree you would be
comfortable handing to a stranger. Report what a `du -sh` of that fresh clone
comes to, so Harold knows the download cost.

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
- [ ] Privacy sweep done: no personal material tracked, `private/` gitignored,
      secret scan clean, and the history question answered by Harold.
- [ ] SESSIONS.md has an entry per session; every package committed and pushed
      as `halapenyoharry`.
</content>
