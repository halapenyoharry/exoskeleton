import type { Storage, AppState, AppStateV8 } from "./storage";
import { isCompatible, migrateToV8 } from "./storage";

// Browser-tab backend for app state (workspaces and layouts), used when the
// app runs outside Tauri, e.g. the dev server opened from another machine.
// localStorage is per origin and per browser, so each machine keeps its own
// layout. Same contract as tauri-storage.ts.

// Key kept identical to exo-skeleton.org's so existing visitors keep their
// saved layouts. "exoskeleton.state" was this repo's earlier key; it is read
// as a fallback and never written.
const KEY = "exoskeleton_web_state_v8_1";
const LEGACY_KEY = "exoskeleton.state";

export const webStorage: Storage = {
  async load(): Promise<AppStateV8 | null> {
    try {
      const text =
        window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
      if (text === null) return null;
      const raw = JSON.parse(text);
      if (!isCompatible(raw)) {
        console.warn("[exoskeleton] saved state has incompatible version, falling back to defaults", raw);
        return null;
      }
      return migrateToV8(raw as AppState);
    } catch (e) {
      console.warn("[exoskeleton] failed to load state:", e);
      return null;
    }
  },
  async save(state: AppStateV8) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("[exoskeleton] failed to save state:", e);
    }
  },
  async clear() {
    try {
      window.localStorage.removeItem(KEY);
      window.localStorage.removeItem(LEGACY_KEY);
    } catch (e) {
      console.warn("[exoskeleton] failed to clear state:", e);
    }
  },
};
