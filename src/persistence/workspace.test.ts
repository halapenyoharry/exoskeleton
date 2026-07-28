import { test } from "node:test";
import assert from "node:assert";
import {
  isCompatible,
  isAppStateV8,
  migrateToV8,
  listWorkspaces,
  getActiveWorkspace,
  switchWorkspace,
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
  type AppStateV8,
  type AppStateV7,
} from "./storage.ts";
import type { SerializedDockview } from "dockview";

const dummyLayout = {
  grid: { root: { type: "branch", data: [] }, height: 100, width: 100, orientation: "HORIZONTAL" },
  panels: {},
} as unknown as SerializedDockview;

test("isCompatible accepts valid v8 state", () => {
  const v8State: AppStateV8 = {
    version: 8,
    activeWorkspaceId: "default",
    workspaces: {
      default: {
        id: "default",
        name: "Default Workspace",
        layout: dummyLayout,
        updatedAt: Date.now(),
      },
    },
    preferences: {},
  };
  assert.strictEqual(isCompatible(v8State), true);
  assert.strictEqual(isAppStateV8(v8State), true);
});

test("isCompatible rejects v8 missing activeWorkspaceId or workspaces dict", () => {
  assert.strictEqual(
    isCompatible({
      version: 8,
      workspaces: {},
    }),
    false,
  );
  assert.strictEqual(
    isCompatible({
      version: 8,
      activeWorkspaceId: "default",
    }),
    false,
  );
  assert.strictEqual(
    isCompatible({
      version: 8,
      activeWorkspaceId: "nonexistent",
      workspaces: { default: { id: "default", name: "D", layout: dummyLayout, updatedAt: 1 } },
    }),
    false,
  );
});

test("migrateToV8 converts legacy v7 state to v8 with default workspace", () => {
  const legacyV7: AppStateV7 = {
    version: 7,
    layout: dummyLayout,
    preferences: {},
  };
  const migrated = migrateToV8(legacyV7);
  assert.strictEqual(migrated.version, 8);
  assert.strictEqual(migrated.activeWorkspaceId, "default");
  assert.ok(migrated.workspaces.default);
  assert.strictEqual(migrated.workspaces.default.name, "Default Workspace");
  assert.deepStrictEqual(migrated.workspaces.default.layout, legacyV7.layout);
});

test("workspace CRUD helpers operating on AppStateV8", () => {
  let state: AppStateV8 = {
    version: 8,
    activeWorkspaceId: "default",
    workspaces: {
      default: {
        id: "default",
        name: "Default Workspace",
        layout: dummyLayout,
        updatedAt: 100,
      },
    },
    preferences: {},
  };

  // 1. List
  const list1 = listWorkspaces(state);
  assert.strictEqual(list1.length, 1);
  assert.strictEqual(list1[0].id, "default");

  // 2. Active
  const active1 = getActiveWorkspace(state);
  assert.strictEqual(active1.id, "default");

  // 3. Create
  const res = createWorkspace(state, "JSON Exploration");
  state = res.state;
  const newWs = res.workspace;
  assert.strictEqual(state.activeWorkspaceId, newWs.id);
  assert.strictEqual(newWs.name, "JSON Exploration");
  assert.strictEqual(listWorkspaces(state).length, 2);

  // 4. Switch
  state = switchWorkspace(state, "default");
  assert.strictEqual(state.activeWorkspaceId, "default");
  assert.strictEqual(getActiveWorkspace(state).name, "Default Workspace");

  // 5. Rename
  state = renameWorkspace(state, newWs.id, "Renamed JSON Lab");
  assert.strictEqual(state.workspaces[newWs.id].name, "Renamed JSON Lab");

  // 6. Delete inactive
  state = deleteWorkspace(state, newWs.id);
  assert.strictEqual(listWorkspaces(state).length, 1);
  assert.strictEqual(state.workspaces[newWs.id], undefined);

  // 7. Delete last workspace (should be prevented)
  const stateBeforeLastDelete = state;
  state = deleteWorkspace(state, "default");
  assert.strictEqual(state, stateBeforeLastDelete);
});
