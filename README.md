# HUD

A bare-bones opinionated app shell. Modules are self-contained things that float on a HUD layer over a scene/viewport — like Mark Text or Typora's calm chrome, but with a positionable widget overlay instead of an editor surface.

## Run

```
npm install
npm run dev
```

Vite dev server: http://localhost:5808

## Shape

```
+------------------------- Titlebar -------------------------+
| Sidepane |  Viewport                                       |
| (toggle) |  +-- SceneLayer (z=0, dark background) -------+ |
|          |  |                                            | |
|          |  +-- HudLayer (z=1, transparent) ------------+| |
|          |  |   [HudWidget: a module, x/y from center]  || |
|          |  +-------------------------------------------+| |
|          |  +-- Hotbar (placeholder) -------------------+| |
+----------+--------------------------------------------------+
```

## Module contract

```
modules/<name>/
  manifest.ts   // default-exports { id, title, x, y, w, h }
  index.tsx     // default-exports a React component
```

`x` and `y` are pixel offsets from the viewport center. `w` and `h` are pixel sizes. The shell wraps your component in a `HudWidget` frame (title bar + close button) and positions it on the HUD layer.

A starter lives at `modules/_template/`.

## Strict isolation rule

Modules import only `@shell/types` (for type definitions). Modules do **not** import from each other or from any other shell internals. This keeps modules independent — changing one can't break siblings.

## Assumptions that will change

These are deliberate first-pass guesses, isolated so they're cheap to swap:

- Modules positioned via manifest only (no drag yet).
- Mount order = z-order (no bring-to-front).
- No position persistence across reloads.
- Sidepane and Hotbar are placeholder chrome (no real pickers yet).
- HUD-only mounting (no scene-layer modules path).
- No module-to-module communication.
- Single-window only.
- Theme hardcoded cyan/dark (tokens in `shell/theme.css`).
- `pointer-events: none` on `HudLayer`, `auto` on each `HudWidget`.

## Layout

- `shell/` — the chrome. Module authors should not edit anything here.
- `modules/<name>/` — one folder per module. Self-contained.
- `index.html`, `package.json`, `vite.config.ts`, `tsconfig.json` — repo root.
