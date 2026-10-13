import { useSyncExternalStore } from "react";

/**
 * Tiny shared store for per-pane drawer state. PillTab (the △ / pin buttons)
 * and PanelRoot (which mounts the drawer over the content) both live in
 * different React subtrees, so they meet here.
 *
 * `open` is session-only. `pinned` is mirrored to panel params
 * (`drawerPinned`) by `setPanePinned` so it survives reloads; a pinned pane
 * starts with its drawer open.
 */
export interface PaneChromeState {
  open: boolean;
  pinned: boolean;
}

const DEFAULT: PaneChromeState = { open: false, pinned: false };
const states = new Map<string, PaneChromeState>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribePaneChrome(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPaneChrome(id: string): PaneChromeState {
  return states.get(id) ?? DEFAULT;
}

/** Seed from persisted params the first time a pane is seen (idempotent). */
export function initPaneChrome(id: string, pinned: boolean): void {
  if (states.has(id)) return;
  // Silent on purpose: called during render; no subscriber can have a stale view of an unseen id.
  states.set(id, { open: pinned, pinned });
}

export function setPaneOpen(id: string, open: boolean): void {
  const cur = getPaneChrome(id);
  if (cur.open === open) return;
  states.set(id, { ...cur, open });
  emit();
}

/** Minimal slice of a Dockview panel api needed to persist the pin. */
interface ParamsApi {
  updateParameters(p: Record<string, unknown>): void;
}

export function setPanePinned(id: string, pinned: boolean, api?: ParamsApi): void {
  const cur = getPaneChrome(id);
  states.set(id, { open: pinned ? true : cur.open, pinned });
  api?.updateParameters({ drawerPinned: pinned });
  emit();
}

export function usePaneChrome(id: string): PaneChromeState {
  return useSyncExternalStore(
    subscribePaneChrome,
    () => getPaneChrome(id),
    () => DEFAULT,
  );
}

/** Close every open, unpinned drawer. Returns true if any was open.
 *  (Used by the deck's back-button absorption.) */
export function closeOpenDrawers(): boolean {
  let any = false;
  for (const [id, st] of states) {
    if (st.open && !st.pinned) {
      states.set(id, { ...st, open: false });
      any = true;
    }
  }
  if (any) emit();
  return any;
}

/** Transient popovers (the ≡ pill menu) register a closer while open so the
 *  deck's back gesture can dismiss them. Returns an unregister function. */
const backClosers = new Set<() => void>();
export function registerBackCloser(fn: () => void): () => void {
  backClosers.add(fn);
  return () => backClosers.delete(fn);
}
/** Run and clear all registered closers. Returns true if any existed. */
export function closeBackClosers(): boolean {
  if (backClosers.size === 0) return false;
  const fns = [...backClosers];
  backClosers.clear();
  fns.forEach((f) => f());
  return true;
}
