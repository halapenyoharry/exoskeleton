// Runtime options for drawer `select` cells (PaneCell.optionsFrom). A panel
// publishes the choices it only knows at runtime (e.g. detected layers); the
// drawer reads and subscribes. In-process only, same style as panel-menu.ts.

export interface RuntimeOption {
  value: string;
  label: string;
  title?: string;
}

type Listener = (options: RuntimeOption[]) => void;

const store = new Map<string, RuntimeOption[]>();
const listeners = new Map<string, Set<Listener>>();
const EMPTY: RuntimeOption[] = [];
const k = (panelId: string, key: string) => `${panelId}\u0000${key}`;

export function publishOptions(panelId: string, key: string, options: RuntimeOption[]): void {
  const id = k(panelId, key);
  store.set(id, options);
  for (const cb of [...(listeners.get(id) ?? [])]) cb(options);
}

export function getOptions(panelId: string, key: string): RuntimeOption[] {
  return store.get(k(panelId, key)) ?? EMPTY;
}

export function onOptions(panelId: string, key: string, cb: Listener): () => void {
  const id = k(panelId, key);
  let set = listeners.get(id);
  if (!set) listeners.set(id, (set = new Set()));
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) listeners.delete(id);
  };
}

// Runtime text for toolbar chips (ToolbarItem.textFrom). Same shape as options.
type TextListener = (text: string) => void;
const texts = new Map<string, string>();
const textListeners = new Map<string, Set<TextListener>>();

export function publishToolbarText(panelId: string, key: string, text: string): void {
  const id = k(panelId, key);
  texts.set(id, text);
  for (const cb of [...(textListeners.get(id) ?? [])]) cb(text);
}

export function getToolbarText(panelId: string, key: string): string {
  return texts.get(k(panelId, key)) ?? "";
}

export function onToolbarText(panelId: string, key: string, cb: TextListener): () => void {
  const id = k(panelId, key);
  let set = textListeners.get(id);
  if (!set) textListeners.set(id, (set = new Set()));
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) textListeners.delete(id);
  };
}
