// Persistence interface — environment-agnostic.
// Adapters: tauri-storage.ts (today), web-storage.ts / vscode-storage.ts (later).
//
// The schema/state split:
//   - Schema  = the components map + onReady defaults in App.tsx (code).
//   - State   = the JSON on disk this module reads/writes (runtime).
// State is always a delta on top of schema; never a replacement.

import type { SerializedDockview } from "dockview";

export const CURRENT_VERSION = 1;

export interface Preferences {
  /** Whether the side-grid is currently shown. Toggled by Cmd+B. */
  sideGridVisible?: boolean;
  // Room for: theme, tabPosition, tabsVisible, etc. — when those become real.
}

export interface AppState {
  version: number;
  /** Main grid layout (editor / terminal / webview / ...). */
  layout: SerializedDockview;
  /** Side-grid (secondary Dockview) layout. Optional — absent if the
   *  user has never opened the side-grid. */
  sideGrid?: SerializedDockview;
  /** User preferences. Merged on top of schema defaults at load time. */
  preferences?: Preferences;
}

export interface Storage {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Decide if a loaded blob is usable in this code version.
 * If the version is older we could migrate; for now we just accept v1 and
 * fall back to defaults for anything else. When v2 lands, write a migrate()
 * that returns a v1→v2 transformer.
 */
export function isCompatible(state: unknown): state is AppState {
  if (!state || typeof state !== "object") return false;
  const v = (state as AppState).version;
  return v === CURRENT_VERSION;
}
