# HUD

A calm opinionated app shell. The frame stays out of the way; modules build inside.

Idiom: Typora / Mark Text — soft chrome, no borders, two background shades, rounded outer. Module is a *view* with three slots it owns: a main pane, an optional side pane, and an optional HUD overlay layer.

## Run

```
npm install
npm run dev      # http://localhost:5808
```

## Shape

```
+ rounded outer ----------------------------------+
|                                                  |
|   side    |   main                               |
| (shade A) |   (shade B)                          |
|           |   + optional HUD overlay layer +     |
|           |                                      |
+-----------+--------------------------------------+
| viewname                                   side  |  <- thin dim status edge
+--------------------------------------------------+
```

When the side is hidden, the main fills corner-to-corner. There are no borders anywhere; regions are distinguished by background shade only.

## Module contract

```
modules/<name>/
  manifest.ts   // default-exports { id, title }
  index.tsx     // named exports: Main (required), Side?, Provider?, Hud?
```

- **Main** — required. The viewport content. Fills the main pane.
- **Side** — optional. Sidepane content. The sidepane appears only when this is exported.
- **Provider** — optional. Wraps the whole view; use it to share state between Main and Side via React context.
- **Hud** — optional. Renders on a `pointer-events: none` overlay layer above Main; widgets inside opt in to `pointer-events: auto`.

A starter lives at [modules/_template/](modules/_template/).

## Strict isolation rule

Modules import only `@shell/types` from the shell. Modules do **not** import from each other or from any other shell internals. A module's folder is its blast radius.

## Keyboard

- `Cmd+B` (or `Ctrl+B`) — toggle the side pane.

## Theme tokens

Defined in [shell/theme.css](shell/theme.css). Two shades, dim chrome text, a single accent color reserved for live signal inside modules:

- `--bg-side`, `--bg-main`, `--bg-bottom` — region shades
- `--text`, `--text-dim`, `--text-faint` — content / chrome / chrome-secondary
- `--accent` — used by modules to signal live state, not by chrome

## Deployment targets

The same source runs in three places without code changes:

- **web** — `npm run dev` / `npm run build`, host the `dist/` anywhere
- **vscode** — wrap `dist/` in a tiny extension that opens it in a Webview panel
- **app** — wrap with [Tauri](https://tauri.app) (much smaller than Electron, same web build inside)

The web target is what `npm run dev` gives you today.

## Assumptions that will change

- Single active view. View switching is a click on the bottom-left view name (cycles through registered modules; only patchbay registered today).
- No persistence of side-open state across reloads.
- Side and Main are separate React subtrees; share state via the module's `Provider`.
- HUD overlay is per-module opt-in; absent for calm viewers like patchbay.
- No drag-resize on the side pane (fixed width via `--side-w`).
- Outer rounded corners come from CSS — when wrapped in Tauri/Electron, the OS window will provide its own.

## Layout

- [shell/](shell/) — the chrome. Module authors don't edit anything here.
- [modules/<name>/](modules/) — one folder per module. Self-contained.
