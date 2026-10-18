// Registry of declared panes, keyed by component key. Same
// exact-then-longest-prefix lookup as src/panel-menu.ts so spawned clones
// ("json-edit-ab12") resolve to their component's strip. No React imports.

import type { PanelPane } from "../panel-manifest.ts";

const strips = new Map<string, PanelPane[]>();

/** Max positions an author may declare; the host adds ⚙ and ⇅ on top. */
export const MAX_AUTHOR_POSITIONS = 4;

export function registerPanes(componentKey: string, strip: PanelPane[] | undefined): void {
  if (strip && strip.length > 0) strips.set(componentKey, strip.slice(0, MAX_AUTHOR_POSITIONS));
}

export function getPanes(id: string): PanelPane[] | undefined {
  if (strips.has(id)) return strips.get(id);
  let best: string | undefined;
  for (const key of strips.keys()) {
    if (id.startsWith(`${key}-`) && (!best || key.length > best.length)) best = key;
  }
  return best ? strips.get(best) : undefined;
}
