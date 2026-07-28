# Ship review — 2026-07-28

A full-codebase review of `add-json-panels` (at `f93805d`) against the goal:
**a public GitHub release that a stranger can download, open, and not immediately break.**

Every finding below was verified against source — either this repo's, or the
dependency source in `node_modules/` and `~/.cargo/registry/`. Where a finding
needs a human to confirm behaviour by clicking, it says so explicitly.

Companion document: [ship-plan.md](ship-plan.md) is the sequenced work plan
derived from this review. This file is the *evidence*; that file is the *orders*.

---

## Verdict

The architecture is sound and unusually well documented. The panel registry,
the manifest contract, the three-layer state model, the perf conventions, and
the self-healing layout code are all better than typical for a project this
age. Nothing here calls for a rewrite.

What's missing is the **shell around the architecture**: the app has no idea
what a "document" is. It has one implicit, unnamed, always-on state blob; it
opens fourteen panels at a stranger on first launch; there is no visible way
back to a clean state; and three user-facing features (Monaco's editor, the
popout button, half the test suite) are silently broken in ways that only show
up outside the author's machine.

Ordered by what would embarrass a public release most:

| # | Finding | Severity | Confirmed by |
| --- | --- | --- | --- |
| 1 | Monaco is fetched from a CDN at runtime | **blocker** | string in built bundle |
| 2 | Popout (⤴) cannot work — two independent causes | **blocker** | wry + dockview source |
| 3 | First launch opens all 14 panels, including a PTY, WebGL, and Monaco | **blocker** (per your answer) | `buildDefaultLayout` |
| 4 | No workspace concept: one implicit blob, no reset in the UI | **blocker** (per your answer) | `persistence/` |
| 5 | Half the test suite never runs | high | `npm test` output |
| 6 | Terminal hardcodes `/bin/zsh` — dead on Pop!_OS | high | `TerminalPanel.tsx:7` |
| 7 | One panel throwing blanks the entire window | high | no error boundary anywhere |
| 8 | No LICENSE; no license metadata in either manifest | high (public release) | repo root, `Cargo.toml` |
| 9 | Settings "apply" is silently clobbered by the next autosave | medium | `SettingsPanel` + `App.tsx` save loop |
| 10 | `json-edit` forgets its open file on relaunch (editor doesn't) | medium | `JsonEditPanel.tsx:68` |
| 11 | Pending save is lost if the app quits within 400 ms | medium | `App.tsx` debounce |
| 12 | `migrateLayout` force-adds every new panel to every existing layout | medium | `default-layout.ts:288` |
| 13 | `csp: null` alongside recursive home read/write | medium | `tauri.conf.json`, `capabilities/default.json` |
| 14 | 2.9 MB single JS chunk, no code splitting | medium | build output |
| 15 | No CI; no signing/notarization story | medium (public release) | absent |
| 16 | `mainApiRef.current` read during render | low | `App.tsx:275` |

---

## 1. Monaco is fetched from a CDN at runtime — **blocker**

`@monaco-editor/react` does **not** bundle Monaco. Unless you call
`loader.config({ monaco })`, it injects a `<script>` at runtime pointing at
jsDelivr. Nothing in `src/` calls `loader.config` — the only import is the bare
component at [JsonEditPanel.tsx:3](../src/panels/json-edit/JsonEditPanel.tsx#L3).

Confirmed in the production bundle:

```
$ grep -o "https://cdn[^\"']*" dist/assets/*.js | sort -u
https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs
```

Three separate problems, any one of which is disqualifying:

- **It violates your standing rule** that code must never reach the internet
  without asking ("using CDN for d3 instead of localhost is forbidden"). This
  is exactly that, in the shipped artifact.
- **`json-edit` is dead without a network.** It is the producer for all seven
  viewers and the anchor of the entire JSON suite — and of the TopoThink fork.
  Offline, on a plane, on an air-gapped LAN, or on the day jsDelivr has an
  outage, the app's centre of gravity is a blank rectangle.
- **The version is wrong.** `package.json` pins `monaco-editor@0.55.0`; the CDN
  is asked for `0.55.1`. The locally installed copy is dead weight in
  `node_modules` while a different build executes.

Fix is small and mechanical — see WP-1. The local `monaco-editor` dependency is
already present, so this is wiring, not a new dependency.

## 2. The popout button cannot work — **blocker**, two independent causes

`RightHeaderActions` calls `containerApi.addPopoutGroup(group)`
([HeaderActions.tsx:72](../src/HeaderActions.tsx#L72)). Two things break it,
and fixing either one alone still leaves it broken.

**Cause A — `window.open` returns `null` inside Tauri.** Dockview opens popouts
with `window.open(url, target, features)`
(`dockview-core/dist/cjs/popoutWindow.js:145`), and treats a `null` return as
"popup blocked": it bails and returns `null`, silently
(`popoutWindow.js:146-151`). In wry 0.55.1, WKWebView's
`createWebViewWithConfiguration:` handler returns `None` whenever
`new_window_req_handler` is unset
(`wry-0.55.1/src/wkwebview/class/wry_web_view_ui_delegate.rs:257-259`).
tauri-runtime-wry only installs that handler when the app supplies one —
`if let Some(new_window_handler) = pending.new_window_handler`
(`tauri-runtime-wry-2.11.1/src/lib.rs:4908`) — and `on_new_window` is a
*builder* method (`tauri-2.11.1/src/webview/webview_window.rs:315`). Exoskeleton
declares its window in `tauri.conf.json` and never touches a builder, so the
handler is `None`, so `window.open` yields `null`, so the button does nothing.

**Cause B — the popout document doesn't exist.** Dockview's default popout URL
is `'/popout.html'` (`dockviewComponent.js:540`). There is no `popout.html` in
`public/` or `dist/`. Even with cause A fixed, the new window would request a
file the app doesn't serve.

Note the correction this forces on the docs: because Dockview popouts are
`window.open` + DOM portal, a popped-out panel **stays in the same JS heap** as
its opener. The claim in [README.md](../README.md) and
[SESSIONS.md](SESSIONS.md) that "each popout is its own React tree" is wrong,
and the hazard recorded in [AGENTS-FAQ.md](AGENTS-FAQ.md) — that json-bus can't
reach a popout — is **not true for popouts**. It *is* true for Tauri
`WebviewWindow`s, which are a genuinely separate heap. Those are two different
mechanisms that the docs currently blur into one; the plan names them
separately and keeps them separate.

## 3. First launch opens all fourteen panels — **blocker**

`buildDefaultLayout` iterates the entire registry
([default-layout.ts:274](../src/persistence/default-layout.ts#L274)). A stranger's
first launch therefore spawns, simultaneously: a real login shell via PTY, a
Monaco instance (currently a CDN fetch), a WebGL force-graph, a Cytoscape
canvas, a Web Audio context, an iframe to dockview.dev, and six more viewers.

This is the "mess of apps panels" you named. Note it is *not* the same thing as
the wide registry, which is deliberate and stays: sixteen panels remain
available, one click away in the ⊞ menu and the watermark. Only the **default
layout** shrinks.

Two knock-on effects worth naming: first launch is the slowest moment in the
app's life for no benefit, and a stranger has no idea which of fourteen tabs to
look at first.

## 4. There is no workspace concept — **blocker**

State is a single unnamed blob at key `"state"` in `exoskeleton.json`
([tauri-storage.ts:9-13](../src/persistence/tauri-storage.ts#L9-L13)). Everything
follows from that:

- No New / Open / Save As / Duplicate / Rename. You have exactly one layout,
  forever, and every change edits it in place.
- **No visible reset.** The README's instruction is "delete `exoskeleton.json`
  and relaunch" — a Finder expedition into `~/Library/Application Support/`.
  The watermark's "restore default layout" only appears once the grid is
  *already* empty, which is the one state a stuck user can't reliably reach.
- No way to share a layout, commit one to git, or ship one with a fork. The
  TopoThink fork currently has to be a code change.

Grep confirms: no occurrence of "workspace" in `src/` outside a manifest
description string.

## 5. Half the test suite never runs — high

`npm test` runs `node --experimental-strip-types --test src/**/*.test.ts`. npm
executes scripts under `sh`, where `**` is not recursive — it behaves as a
single `*`:

```
$ sh -c 'echo src/**/*.test.ts'
src/persistence/storage.test.ts
```

`src/panels/json-dyadic/parse.test.ts` is three levels deep and is silently
skipped. The run reports "5 pass / 0 fail" and looks green, which is worse than
looking red: the 171-line parse suite has never gated a commit.

## 6. Terminal hardcodes `/bin/zsh` — high

```ts
const SHELL = navigator.platform.includes("Win") ? "powershell.exe" : "/bin/zsh";
```
[TerminalPanel.tsx:7](../src/panels/TerminalPanel.tsx#L7)

Pop!_OS is a stated target and does not ship zsh by default; the panel would
print `failed to spawn pty` on a stock install. `navigator.platform` is also
deprecated. The correct source is the `SHELL` environment variable, with a
per-platform fallback.

## 7. No error boundary — high

A single panel throwing during render unmounts the whole React tree: black
window, no tabs, no watermark, no way back except deleting the state file. With
sixteen panels — several of them parsing arbitrary user JSON and feeding it to
d3, Cytoscape, and three.js — this will happen to a stranger.

`PanelRoot` ([src/PanelRoot.tsx](../src/PanelRoot.tsx)) already wraps every
panel at registration time. It is the natural and nearly free place to catch.

## 8. No LICENSE — high, and blocking for a public release

No `LICENSE` file; no `license` field in `package.json`; no `license` in
`Cargo.toml`. Without one, "public GitHub release" means every visitor is
legally in default-copyright territory — they may read the code but not use,
fork, or redistribute it. This also blocks the TopoThink fork from being a
clean, separately-licensed artifact.

## 9. Settings "apply" is silently clobbered — medium

`SettingsPanel.apply()` writes the edited JSON straight to disk
([SettingsPanel.tsx:42-54](../src/panels/settings/SettingsPanel.tsx#L42-L54)) and
tells the user "layout changes apply on next launch." But the live Dockview API
is the real source of truth, and *any* subsequent layout change re-serializes
over the file — including `updateParameters` calls that panels fire on mount
(`dockviewComponent.js:2782` routes parameter changes into `onDidLayoutChange`,
which is wired to `save()`). So editing the layout in Settings and pressing
apply is lost unless the user quits instantly and touches nothing.

Under the new workspace model this panel becomes a workspace inspector; the
apply path should either drive `api.fromJSON()` live or refuse to pretend.

## 10. `json-edit` forgets its file — medium

`EditorPanel` persists its open path in panel params and reopens on mount
([EditorPanel.tsx:25-39](../src/panels/EditorPanel.tsx#L25-L39)). `JsonEditPanel`
holds `filePath` in plain `useState`
([JsonEditPanel.tsx:68](../src/panels/json-edit/JsonEditPanel.tsx#L68)) and drops
it on relaunch, along with the buffer. So the app restores your *arrangement*
but not the document you were looking at — and since the json-bus is
memory-only, every viewer is blank until you re-open the file by hand.

For the JSON suite this is the difference between "restores my session" and
"restores the frame around my session," and it matters more, not less, in the
TopoThink fork.

## 11. Pending saves are lost on quit — medium

`save` is debounced 400 ms ([App.tsx:108-118](../src/App.tsx#L108-L118)) and
nothing flushes it on window close. Drag a panel, press ⌘Q inside 400 ms, lose
the change. Rare per-instance, but it silently undermines the one guarantee
persistence makes.

## 12. `migrateLayout` force-adds new panels — medium

Every panel whose `introducedAt` exceeds the user's saved version is injected
into their layout on next launch
([default-layout.ts:288](../src/persistence/default-layout.ts#L288)). That was
right when the default was "everything" and the audience was you. Once the
default is minimal and layouts are user-authored workspaces, an update that
silently inserts new tabs into someone's arranged workspace is an intrusion.

Availability (the ⊞ menu, the watermark) is the right channel for new panels;
auto-insertion should become opt-in per registry entry.

Care is needed here: this interacts directly with the *accumulate, don't
replace* principle. The panel stays available and nothing is removed — what
changes is only whether it is force-mounted into an existing arrangement.

## 13. Security posture — medium

`"csp": null` ([tauri.conf.json:24](../src-tauri/tauri.conf.json#L24)) disables
content-security-policy entirely, while capabilities grant
`fs:allow-home-read-recursive` and `fs:allow-home-write-recursive`
([capabilities/default.json](../src-tauri/capabilities/default.json)). Any script
injection in the main origin reaches the whole home directory through the fs
plugin.

The iframe panel does not itself breach this — cross-origin iframes cannot
touch the parent's Tauri IPC — and it should stay permissive, because
embedding LAN services is the panel's entire purpose. The fix is a real CSP on
the app origin (`script-src 'self'` with a permissive `frame-src`), not
restricting the iframe.

## 14. Bundle size — medium

One 2.93 MB chunk (813 kB gzipped), and that's *without* Monaco, which is
currently fetched separately. three.js, Cytoscape, d3, and xterm all load
eagerly even for a user who never opens those panels. With a minimal default
layout, lazy panel imports would cut first paint substantially.

## 15. No CI, no signing story — medium, public-release scope

No GitHub Actions workflow. `tsc`, the tests, and a Linux build are never
exercised outside your Mac — which is exactly how finding 6 survives. And an
unsigned, un-notarized `.dmg` gives macOS users the "damaged and can't be
opened" dialog, which reads as *broken*, not as *unsigned*. That needs either
notarization or a prominently documented workaround.

## 16. Ref read during render — low

[App.tsx:275](../src/App.tsx#L275) and 284 gate button rendering on
`mainApiRef.current`, a ref. Refs don't trigger re-renders; those buttons
currently appear only because `mountStatusBar` happens to call
`setIsStatusBarVisible(true)` right after `onReady` assigns the ref. Change the
status-bar logic and the ⊞ button silently vanishes. A one-line `useState`
holding the api makes it explicit.

---

## What is already right (do not "fix" these)

Reviewed and deliberately left alone. Several look odd out of context and have
earned their shape:

- **`addRegistryPanel` never passes a positionless `addPanel`.** That's the fix
  for the absorbed-into-the-status-bar catastrophe. Keep the invariant.
- **`ColoredTab` wraps `DockviewDefaultTab`** rather than replacing it — a
  from-scratch tab broke drag-and-drop once already.
- **`dragDropEnabled: false`** in `tauri.conf.json` is load-bearing for
  Dockview's HTML5 drag on WKWebView.
- **Perf conventions** — gate before the transform, `bypassPerf` session-only,
  `useJsonDoc` for subscriptions, `docStats` WeakMap cache. All correct and all
  recently paid for.
- **The in-process buses.** OSC-for-events / json-bus-for-snapshots is the
  right distinction, and staying dependency-free fits the project.
- **The wide registry.** Sixteen panels available is intentional posture, not
  clutter.
</content>
