# Module template

Copy this folder to `modules/<your-name>/` and:

1. Edit `manifest.ts` — set `id` (must match the folder name) and `title`.
2. Edit `index.tsx` — keep what you need:
   - `Main` — required. The viewport content. Fills the entire viewport.
   - `Side` — optional. Sidepane content. Slightly darker shade.
   - `Provider` — optional. Wrap state shared between Main and Side here (use a React context).
   - `Hud` — optional. Overlay layer on top of Main for live work.

The shell wires whatever you export into the right slots.

## Rules

- Import only `@shell/types` from the shell (for type definitions). Nothing else.
- Don't import from sibling modules.
- Keep all your code inside this folder. The whole folder is the module's blast radius.
- No emoji in UI. Keep text minimal.
