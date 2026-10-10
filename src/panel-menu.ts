// Panel menu plumbing. A manifest *declares* menu items (PanelMenuItem[]);
// the pill's ☰ menu renders them; a click calls emitPanelMenu(panelId, itemId);
// the panel *handles* the item by subscribing with onPanelMenu(panelId, ...).
// In-process only, same style as data/json-bus.ts.

import type { PanelMenuItem } from "./panel-manifest";

type Handler = (itemId: string) => void;
const handlers = new Map<string, Set<Handler>>();

export function emitPanelMenu(panelId: string, itemId: string): void {
  const set = handlers.get(panelId);
  if (!set) return;
  for (const h of [...set]) h(itemId);
}

export function onPanelMenu(panelId: string, handler: Handler): () => void {
  let set = handlers.get(panelId);
  if (!set) handlers.set(panelId, (set = new Set()));
  set.add(handler);
  return () => {
    set!.delete(handler);
    if (set!.size === 0) handlers.delete(panelId);
  };
}

// Registry of declared menus, keyed by component key (manifest id).
const menus = new Map<string, PanelMenuItem[]>();

export function registerPanelMenu(componentKey: string, menu: PanelMenuItem[] | undefined): void {
  if (menu && menu.length > 0) menus.set(componentKey, menu);
}

/** Resolve a panel id (exact, or a spawned clone like "json-edit-ab12")
 *  to its declared menu. Same exact-then-longest-prefix rule as
 *  resolveComponentKey in ColoredTab.tsx (kept local so this module stays
 *  free of React/CSS imports and is testable under node). */
export function getPanelMenu(id: string): PanelMenuItem[] | undefined {
  if (menus.has(id)) return menus.get(id);
  let best: string | undefined;
  for (const key of menus.keys()) {
    if (id.startsWith(`${key}-`) && (!best || key.length > best.length)) best = key;
  }
  return best ? menus.get(best) : undefined;
}
