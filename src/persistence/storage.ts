// Persistence interface — environment-agnostic.
// Adapters: tauri-storage.ts (today), web-storage.ts / vscode-storage.ts (later).
//
// The schema/state split:
//   - Schema  = the components map + onReady defaults in App.tsx (code).
//   - State   = the JSON on disk this module reads/writes (runtime).
// State is always a delta on top of schema; never a replacement.

import type { SerializedDockview } from "dockview";

// Schema version history:
//   1 — initial (editor / terminal / webview, separate sideGrid field)
//   2 — added tempo-clock panel; migrateLayout handles auto-add for v1 users
//   3 — side-grid migrated to a Dockview 6 edge group inside `layout`;
//       the standalone `sideGrid` field is gone (silently dropped from
//       legacy state on next save). Same for preferences.sideGridVisible.
export const CURRENT_VERSION = 3;

export interface Preferences {
  // Empty for now; reserved for theme, tab-position, etc. when those land.
  // Removed in v3: sideGridVisible (now implicit in the edge group's presence
  // within `layout`).
}

export interface AppState {
  version: number;
  /** Main grid layout (editor / terminal / webview / tempo-clock / settings
   *  edge group / ...). Settings + the left edge group are part of this
   *  blob since v3 — no longer a separate field. */
  layout: SerializedDockview;
  /** User preferences. Merged on top of schema defaults at load time. */
  preferences?: Preferences;
}

export interface Storage {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Decide if a loaded blob is usable in this code version. Accepts any
 * known schema version from 1 through CURRENT_VERSION — older states get
 * migrated at load time by `migrateLayout` in default-layout.ts.
 * Future versions are rejected (downgrade is not supported).
 */
export function isCompatible(state: unknown): state is AppState {
  if (!state || typeof state !== "object") return false;
  const v = (state as AppState).version;
  return typeof v === "number" && v >= 1 && v <= CURRENT_VERSION;
}
