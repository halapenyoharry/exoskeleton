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
//   4 — added piano + scope panels (the OSC demo pair). migrateLayout
//       auto-adds them for existing users on next launch.
//   5 — added the seven json-* panels (json-edit + six viewers wired via
//       json-bus). migrateLayout auto-adds them for existing users.
//   6 — added dyadicProjection: the first viewer in the json-* group that
//       renders edges per their i2t:edge_category rather than as uniform
//       connector lines. migrateLayout auto-adds it for existing users.
//   7 — renamed dyadicProjection → json-dyadic to match the json-* family
//       naming pattern. Saved layouts from v6 get rewritten in-place by
//       migrateSavedLayout (default-layout.ts) before fromJSON runs.
//   8 — multi-workspace support. Saved layout is encapsulated within named
//       `workspaces` objects; `activeWorkspaceId` selects the active grid.
//   9 — topology-extract panel: ingestion furnace for the info2topo
//       pipeline. Pushes normalized-dyadic topology JSON to json-bus.
//  10 — procedural-visuals suite: OSC-controlled generative canvases and
//       3D topological manifolds.
//  11 — json-graph3d-inspect: text-sprite 3D graph with category colors
//       and containment hulls.
export const CURRENT_VERSION = 11;

export interface Preferences {
  // Empty for now; reserved for theme, tab-position, etc. when those land.
}

export interface Workspace {
  id: string;
  name: string;
  layout: SerializedDockview;
  updatedAt: number; // Date.now()
}

export interface AppStateV7 {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  layout: SerializedDockview;
  preferences?: Preferences;
}

export interface AppStateV8 {
  version: 8;
  activeWorkspaceId: string;
  workspaces: Record<string, Workspace>;
  preferences: Preferences;
}

export type AppState = AppStateV8 | AppStateV7;

export interface Storage {
  load(): Promise<AppStateV8 | null>;
  save(state: AppStateV8): Promise<void>;
  clear(): Promise<void>;
}

export function isAppStateV8(state: unknown): state is AppStateV8 {
  if (!state || typeof state !== "object") return false;
  const s = state as AppStateV8;
  return (
    s.version === 8 &&
    typeof s.activeWorkspaceId === "string" &&
    typeof s.workspaces === "object" &&
    s.workspaces !== null &&
    s.activeWorkspaceId in s.workspaces
  );
}

/**
 * Migrates any legacy AppState (v1-v7 or partial v8) to a valid AppStateV8 object.
 */
export function migrateToV8(state: AppState): AppStateV8 {
  if (isAppStateV8(state)) {
    return state;
  }

  const legacyLayout = (state as AppStateV7).layout || {
    grid: { root: { type: "branch", data: [] } },
    panels: {},
  };

  const defaultWorkspace: Workspace = {
    id: "default",
    name: "Default Workspace",
    layout: legacyLayout,
    updatedAt: Date.now(),
  };

  return {
    version: 8,
    activeWorkspaceId: "default",
    workspaces: {
      default: defaultWorkspace,
    },
    preferences: state.preferences || {},
  };
}

/**
 * Decide if a loaded blob is usable in this code version. Accepts any
 * known schema version from 1 through CURRENT_VERSION. Older states get
 * migrated at load time by `migrateToV8`.
 * Future versions or malformed v8 objects are rejected.
 */
export function isCompatible(state: unknown): state is AppState {
  if (!state || typeof state !== "object") return false;
  const v = (state as { version?: unknown }).version;
  if (typeof v !== "number" || v < 1 || v > CURRENT_VERSION) return false;
  if (v === 8) {
    return isAppStateV8(state);
  }
  return true;
}

// ─── Pure Workspace CRUD Helpers ───────────────────────────────────────────

export function listWorkspaces(state: AppStateV8): Workspace[] {
  return Object.values(state.workspaces).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActiveWorkspace(state: AppStateV8): Workspace {
  return state.workspaces[state.activeWorkspaceId] || Object.values(state.workspaces)[0];
}

export function updateActiveWorkspaceLayout(
  state: AppStateV8,
  layout: SerializedDockview,
): AppStateV8 {
  const activeId = state.activeWorkspaceId;
  const active = state.workspaces[activeId];
  if (!active) return state;

  return {
    ...state,
    workspaces: {
      ...state.workspaces,
      [activeId]: {
        ...active,
        layout,
        updatedAt: Date.now(),
      },
    },
  };
}

export function switchWorkspace(state: AppStateV8, id: string): AppStateV8 {
  if (!state.workspaces[id]) return state;
  return {
    ...state,
    activeWorkspaceId: id,
  };
}

export function createWorkspace(
  state: AppStateV8,
  name: string,
  initialLayout?: SerializedDockview,
): { state: AppStateV8; workspace: Workspace } {
  const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const activeLayout = getActiveWorkspace(state)?.layout || {
    grid: { root: { type: "branch", data: [] } },
    panels: {},
  };
  const workspace: Workspace = {
    id,
    name: name.trim() || "Untitled Workspace",
    layout: initialLayout || activeLayout,
    updatedAt: Date.now(),
  };

  const nextState: AppStateV8 = {
    ...state,
    activeWorkspaceId: id,
    workspaces: {
      ...state.workspaces,
      [id]: workspace,
    },
  };

  return { state: nextState, workspace };
}

export function deleteWorkspace(state: AppStateV8, id: string): AppStateV8 {
  const ids = Object.keys(state.workspaces);
  if (ids.length <= 1 || !state.workspaces[id]) {
    return state; // Prevent deleting the last workspace
  }

  const { [id]: _deleted, ...remainingWorkspaces } = state.workspaces;
  let nextActiveId = state.activeWorkspaceId;
  if (id === state.activeWorkspaceId) {
    nextActiveId = Object.keys(remainingWorkspaces)[0];
  }

  return {
    ...state,
    activeWorkspaceId: nextActiveId,
    workspaces: remainingWorkspaces,
  };
}

export function renameWorkspace(
  state: AppStateV8,
  id: string,
  newName: string,
): AppStateV8 {
  const target = state.workspaces[id];
  if (!target) return state;

  return {
    ...state,
    workspaces: {
      ...state.workspaces,
      [id]: {
        ...target,
        name: newName.trim() || target.name,
        updatedAt: Date.now(),
      },
    },
  };
}
