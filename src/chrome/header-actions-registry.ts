// Registry of declared header actions, keyed by component key. Same
// exact-then-longest-prefix lookup as panes-registry.ts. No React imports.

import type { HeaderActionItem } from "../panel-manifest.ts";

const actions = new Map<string, HeaderActionItem[]>();

export function registerHeaderActions(componentKey: string, items: HeaderActionItem[] | undefined): void {
  if (items && items.length > 0) actions.set(componentKey, items);
}

export function getHeaderActions(id: string): HeaderActionItem[] | undefined {
  if (actions.has(id)) return actions.get(id);
  let best: string | undefined;
  for (const key of actions.keys()) {
    if (id.startsWith(`${key}-`) && (!best || key.length > best.length)) best = key;
  }
  return best ? actions.get(best) : undefined;
}
