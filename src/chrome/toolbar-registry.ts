// Registry of declared slim toolbars, keyed by component key. Same
// exact-then-longest-prefix lookup as strip-registry.ts. No React imports.

import type { ToolbarItem } from "../panel-manifest.ts";

const toolbars = new Map<string, ToolbarItem[]>();

export function registerToolbar(componentKey: string, items: ToolbarItem[] | undefined): void {
  if (items && items.length > 0) toolbars.set(componentKey, items);
}

export function getToolbar(id: string): ToolbarItem[] | undefined {
  if (toolbars.has(id)) return toolbars.get(id);
  let best: string | undefined;
  for (const key of toolbars.keys()) {
    if (id.startsWith(`${key}-`) && (!best || key.length > best.length)) best = key;
  }
  return best ? toolbars.get(best) : undefined;
}
