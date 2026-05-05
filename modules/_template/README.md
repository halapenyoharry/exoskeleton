# Module template

Copy this folder to `modules/<your-module-name>/` and:

1. Edit `manifest.ts` — set `id` (must match the folder name), `title`, and `x`/`y`/`w`/`h`. `x` and `y` are pixel offsets from viewport center.
2. Edit `index.tsx` — replace the body with your component.

That's it. The shell will discover and mount it automatically.

## Rules

- Import only `@shell/types` from the shell. Nothing else.
- Don't import from sibling modules.
- Keep all your code inside this folder. The whole folder is the module's blast radius.
