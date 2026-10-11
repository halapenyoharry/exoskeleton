# Declarative pane controls — decision memo (2026-10-11)

Harold's requirement: a panel *declares* its controls; the host *renders* them on the pane drawer's fixed grid (cells spanning 1×1, 2×1, 2×2, 3×1) or as a stack of rows. Touch-friendly, our theme, npm only, AGPL-compatible. "Surely someone has this already."

Survey (npm metadata as of 2026-10-11; layout/theming notes from prior knowledge, not re-read docs — verify before adopting anything):

| Library | Last release | React 19 | Size | Declares how | Fits our grid? | License |
| --- | --- | --- | --- | --- | --- | --- |
| Leva | 0.10.1 (2025-10) | yes | 677 KB + stitches/radix/zustand | `useControls({...})` hooks | No: own floating panel, label/input rows, no spans, small targets | MIT |
| Tweakpane | 4.0.5 (2024-11) | no React wrapper for 19 | 448 KB | imperative `addBinding` | No: own DOM | MIT |
| lil-gui | 0.21 (2025-10) | vanilla | 226 KB | imperative | No | MIT |
| dat.GUI | 0.7.9 (stale) | vanilla | 1 MB | imperative | No | Apache-2.0 |
| react-jsonschema-form | 6.11 (2026-09) | yes | 2.5 MB | JSON Schema + uiSchema | Partly, with custom templates | Apache-2.0 |
| Radix / Base UI | current | yes | small, tree-shakeable | none (headless primitives) | Yes, they are just components | MIT |

Nothing found that does "panel declares cells, host lays them on a fixed grid." The tweak-panel family owns its layout; the form generators carry two format layers.

**Decision: keep our primitives and our own small schema.** `PaneCell` / `PaneStripItem` in `src/panel-manifest.ts` are that schema; `src/chrome/PaneDrawer.tsx` is the renderer; `src/components/toolbar/` holds the control vocabulary (segmented, toggle, swatch, stepper, dial). Radix or Base UI can be swapped in *under* a cell type later for accessibility and gestures without touching the schema.

**Risk:** owning the schema means owning its growth. Freeze v1 at the five cell kinds; add a kind only when a real panel asks.
