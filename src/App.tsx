import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
} from "dockview";
import { listen } from "@tauri-apps/api/event";
import ColoredTab from "./ColoredTab";
import Watermark from "./Watermark";
import {
  PrefixHeaderActions,
  LeftHeaderActions,
  RightHeaderActions,
} from "./HeaderActions";
import EditorPanel from "./panels/EditorPanel";
import TerminalPanel from "./panels/TerminalPanel";
import LanWebview from "./panels/LanWebview";
import TempoClockPanel from "./panels/tempo-clock/TempoClockPanel";
import SettingsPanel from "./panels/settings/SettingsPanel";
import PianoPanel from "./panels/piano/PianoPanel";
import JsonEditPanel from "./panels/json-edit/JsonEditPanel";
import JsonTreePanel from "./panels/json-tree/JsonTreePanel";
import JsonCirclesPanel from "./panels/json-circles/JsonCirclesPanel";
import JsonGraphPanel from "./panels/json-graph/JsonGraphPanel";
import StatusBarPanel from "./panels/StatusBarPanel";
import TextViewerPanel from "./panels/text-viewer/TextViewerPanel";
import { exoPanel } from "./PanelRoot";
import {
  addOrFocusPanel,
  applyWorkspaceState,
  buildDefaultLayout,
  buildPreset,
  migrateLayout,
  migrateSavedLayout,
  panelRegistry,
  repairLayout,
} from "./persistence/default-layout";
import { panelAccent, panelGlyph } from "./ColoredTab";
import {
  createWorkspace,
  deleteWorkspace,
  getActiveWorkspace,
  isCompatible,
  listWorkspaces,
  migrateToV8,
  renameWorkspace,
  switchWorkspace,
  updateActiveWorkspaceLayout,
  type AppStateV8,
} from "./persistence/storage";
import { appStorage } from "./persistence/app-storage";
import { createDebounce } from "./utils/debounce";
import { errorText, inTauri, saveTextFile } from "./utils/file-io";
import { DEFAULT_PRESET_ID } from "./persistence/presets";
import {
  parseWorkspaceDocument,
  serializeWorkspaceDocument,
} from "./persistence/workspace-file";
import "./App.css";

// Lazy-loaded heavy visualization panels for optimal initial startup performance
const JsonCytoscapePanel = lazy(() => import("./panels/json-cytoscape/JsonCytoscapePanel"));
const JsonGraph3DPanel = lazy(() => import("./panels/json-graph3d/JsonGraph3DPanel"));
const JsonGraph3DInspectPanel = lazy(() => import("./panels/json-graph3d-inspect/JsonGraph3DInspectPanel"));
const JsonDyadicPanel = lazy(() => import("./panels/json-dyadic/JsonDyadicPanel"));
const JsonMassPanel = lazy(() => import("./panels/json-mass/JsonMassPanel"));
const ScopePanel = lazy(() => import("./panels/scope/ScopePanel"));
const TopologyExtractPanel = lazy(() => import("./panels/topology-extract/TopologyExtractPanel"));
const ProceduralControlPanel = lazy(() => import("./panels/procedural-visuals-suite/ControlPanel"));
const BouncingBallsPanel = lazy(() => import("./panels/procedural-visuals-suite/BouncingBallsPanel"));
const FountainPanel = lazy(() => import("./panels/procedural-visuals-suite/FountainPanel"));
const RecursiveSubdivisionPanel = lazy(() => import("./panels/procedural-visuals-suite/RecursiveSubdivisionPanel"));
const ManifoldPanel = lazy(() => import("./panels/procedural-visuals-suite/ManifoldPanel"));

function lazyPanel(Component: React.ComponentType<any>, accent: string) {
  const Wrapped = exoPanel(Component, accent);
  return function LazyWrapper(props: any) {
    return (
      <Suspense fallback={<div className="panel-loading-fallback" />}>
        <Wrapped {...props} />
      </Suspense>
    );
  };
}

// SCHEMA — what panels exist and which React components fill them.
// Each entry is wrapped with `exoPanel(Component, accent)` or `lazyPanel` so the host
// (not the panel) owns positioning and the accent stripe.
const components = {
  editor:          exoPanel(EditorPanel,        "var(--accent-editor)"),
  terminal:        exoPanel(TerminalPanel,      "var(--accent-terminal)"),
  webview:         exoPanel(LanWebview,         "var(--accent-webview)"),
  "tempo-clock":   exoPanel(TempoClockPanel,    "var(--accent-tempo-clock)"),
  settings:        exoPanel(SettingsPanel,      "var(--accent-settings)"),
  piano:           exoPanel(PianoPanel,         "var(--accent-piano)"),
  scope:           lazyPanel(ScopePanel,        "var(--accent-scope)"),
  "json-edit":     exoPanel(JsonEditPanel,      "var(--accent-json-edit)"),
  "json-tree":     exoPanel(JsonTreePanel,      "var(--accent-json-tree)"),
  "json-circles":  exoPanel(JsonCirclesPanel,   "var(--accent-json-circles)"),
  "json-mass":     lazyPanel(JsonMassPanel,     "var(--accent-json-mass)"),
  "json-cytoscape":lazyPanel(JsonCytoscapePanel, "var(--accent-json-cytoscape)"),
  "json-graph":    exoPanel(JsonGraphPanel,     "var(--accent-json-graph)"),
  "json-graph3d":  lazyPanel(JsonGraph3DPanel,  "var(--accent-json-graph3d)"),
  "json-graph3d-inspect": lazyPanel(JsonGraph3DInspectPanel, "var(--accent-json-graph3d-inspect)"),
  "json-dyadic":   lazyPanel(JsonDyadicPanel,   "var(--accent-json-dyadic)"),
  "text-viewer":   exoPanel(TextViewerPanel,    "var(--accent-editor)"),
  "topology-extract": lazyPanel(TopologyExtractPanel, "var(--accent-topology-extract)"),
  "procedural-visuals-control":     lazyPanel(ProceduralControlPanel,    "var(--accent-procedural-control)"),
  "procedural-visuals-balls":       lazyPanel(BouncingBallsPanel,        "var(--accent-procedural-balls)"),
  "procedural-visuals-fountain":    lazyPanel(FountainPanel,             "var(--accent-procedural-fountain)"),
  "procedural-visuals-recursive":   lazyPanel(RecursiveSubdivisionPanel, "var(--accent-procedural-recursive)"),
  "procedural-visuals-manifold": lazyPanel(ManifoldPanel,  "var(--accent-procedural-manifold)"),
  // Registered raw (no exoPanel wrapper) on purpose: the status bar owns
  // its full-width chrome and doesn't take the accent-stripe convention.
  "status-bar-panel": StatusBarPanel,
};

// Persistence backend for this runtime: the Tauri store in the desktop app,
// localStorage in a browser tab (where the Tauri store doesn't exist and
// every reload used to fall back to the default layout).
const storage = appStorage;

// The Cmd+B-summoned settings panel lives in a Dockview 6 edge group on
// the left side of the main grid. Same constant used by toggleSettings,
// the auto-cleanup hook, and (implicitly) the serialized layout.
const SIDE_EDGE = "left" as const;
const SIDE_GROUP_ID = "side-grid";

export default function App() {
  // Initial-load gate. `undefined` = loading; null = no saved state; an
  // AppStateV8 = restored from disk or initialized with default workspace.
  const [appState, setAppState] = useState<AppStateV8 | null | undefined>(undefined);
  const appStateRef = useRef<AppStateV8 | null>(null);

  useEffect(() => {
    if (appState !== undefined) {
      appStateRef.current = appState;
    }
  }, [appState]);

  const mainApiRef = useRef<DockviewApi | null>(null);
  const [isStatusBarVisible, setIsStatusBarVisible] = useState(false);
  // Floating ⊞ add-panel menu (bottom-right, next to the astromech
  // summoner). The roster is read fresh from the registry on each open,
  // so open/closed markers stay accurate without extra subscriptions.
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Preferences state. Currently empty (see Preferences interface in
  // storage.ts); included in the save so future fields persist automatically.
  const prefsRef = useRef<AppStateV8["preferences"]>({});

  // Single debounced save. Reads the live api ref + current AppStateV8 each tick.
  const save = useRef(
    createDebounce(() => {
      const main = mainApiRef.current?.toJSON();
      const current = appStateRef.current;
      if (!main || !current) return;
      const next = updateActiveWorkspaceLayout(current, main);
      appStateRef.current = next;
      storage.save(next);
    }, 400),
  ).current;

  // Flush pending save immediately on window unload or Tauri window close.
  useEffect(() => {
    const handleUnload = () => {
      save.flush();
    };
    window.addEventListener("beforeunload", handleUnload);

    let unlistenClose: (() => void) | undefined;
    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        getCurrentWindow()
          .onCloseRequested(() => {
            save.flush();
          })
          .then((unlisten) => {
            unlistenClose = unlisten;
          })
          .catch(() => {
            /* ignore window error */
          });
      })
      .catch(() => {
        /* off-Tauri context */
      });

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      if (unlistenClose) unlistenClose();
    };
  }, [save]);

  // Initial load: inspect URL search params for ?workspace=<id> override
  useEffect(() => {
    storage.load().then((loaded) => {
      if (loaded) {
        const searchParams = new URLSearchParams(window.location.search);
        const wsParam = searchParams.get("workspace");
        if (wsParam && loaded.workspaces && loaded.workspaces[wsParam]) {
          setAppState({
            ...loaded,
            activeWorkspaceId: wsParam,
          });
          return;
        }
      }
      setAppState(loaded);
    });
  }, []);

  // Listen for raw JSON state applications from SettingsPanel or file imports
  useEffect(() => {
    const handleStateApplied = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && isCompatible(detail)) {
        const v8 = migrateToV8(detail);
        setAppState(v8);
        const activeWs = getActiveWorkspace(v8);
        if (mainApiRef.current && activeWs) {
          applyWorkspaceState(mainApiRef.current, activeWs.layout, v8.version);
        }
      }
    };
    window.addEventListener("exoskeleton:state-applied", handleStateApplied);
    return () => {
      window.removeEventListener("exoskeleton:state-applied", handleStateApplied);
    };
  }, []);

  function mountStatusBar(api: DockviewApi) {
    let bottom = api.getEdgeGroup("bottom");
    if (!bottom) {
      bottom = api.addEdgeGroup("bottom", {
        id: "status-bar-group",
        initialSize: 40,
        minimumSize: 40,
      });
    }
    let panel = api.getPanel("status-bar");
    if (!panel) {
      panel = api.addPanel({
        id: "status-bar",
        component: "status-bar-panel",
        position: { referenceGroup: bottom.id },
      });
    }
    if (panel) {
      panel.group.header.hidden = true;
    }
    setIsStatusBarVisible(true);
  }

  // Toggle the settings panel. Extracted as a stable named function so the
  // menu-event handler below can invoke it; future header-action buttons or
  // programmatic invocations can call it the same way. Settings lives in a
  // left edge group that's created on demand and torn down when its last
  // panel closes (see onDidLayoutChange cleanup in onMainReady).
  function toggleSettings() {
    const api = mainApiRef.current;
    if (!api) return;

    const existing = api.getPanel("settings");
    if (existing) {
      api.removePanel(existing);
      return;
    }

    let edge = api.getEdgeGroup(SIDE_EDGE);
    if (!edge) {
      edge = api.addEdgeGroup(SIDE_EDGE, {
        id: SIDE_GROUP_ID,
        initialSize: 320,
        minimumSize: 200,
      });
    }
    api.addPanel({
      id: "settings",
      component: "settings",
      title: "settings",
      position: { referenceGroup: edge.id },
    });
  }

  // Cmd+B / Ctrl+B is wired via a Tauri Menu accelerator on the Rust side
  // (see src-tauri/src/lib.rs setup()). Menu accelerators fire at the OS
  // level *before* keys reach any subview, so the shortcut works even when
  // focus is inside the webview iframe — a window.keydown listener never
  // sees those (events don't cross the iframe boundary, and cross-origin
  // pages block injection of our own listener).
  useEffect(() => {
    if (!inTauri()) return; // no native menu in a browser tab
    const unlistenP = listen("shortcut:toggle-settings", () => toggleSettings());
    return () => {
      void unlistenP.then((fn) => fn()).catch(() => {});
    };
  }, []);

  function onMainReady(event: DockviewReadyEvent) {
    mainApiRef.current = event.api;
    if (appState) {
      const activeWs = getActiveWorkspace(appState);
      // Restore preferences so the first auto-save round-trips them.
      if (appState.preferences) prefsRef.current = appState.preferences;
      try {
        const layout = migrateSavedLayout(activeWs.layout, appState.version);
        event.api.fromJSON(layout);
        // Add any panels the user's saved state predates. No-op when the
        // saved version is already current. Without this, panels installed
        // after the user's last save would never appear unless they
        // cleared state — a real UX trap for library-panel installs.
        migrateLayout(event.api, appState.version);
      } catch (e) {
        console.warn(
          "[exoskeleton] main fromJSON failed, falling back to defaults:",
          e,
        );
        // fromJSON can partially apply before throwing; clear the wreckage
        // so buildDefaultLayout starts from a clean grid.
        event.api.clear();
        buildDefaultLayout(event.api);
      }
    } else {
      buildDefaultLayout(event.api);
      // First run (nothing saved yet): start a state so the debounced save
      // has something to write. Without this a first run never persisted,
      // which is every run in a fresh browser tab.
      const fresh: AppStateV8 = {
        version: 8,
        activeWorkspaceId: "default",
        workspaces: {
          default: {
            id: "default",
            name: "Default Workspace",
            layout: event.api.toJSON(),
            updatedAt: Date.now(),
          },
        },
        preferences: {},
      };
      appStateRef.current = fresh;
      setAppState(fresh);
    }

    // Rescue pathological saved layouts (panels absorbed into an edge
    // group, empty main grid). No-op when the layout is healthy; the
    // repaired arrangement is persisted by the next debounced save.
    repairLayout(event.api);

    // Check if status bar is in the restored panel list; if not, mount it.
    const statusBarPanel = event.api.getPanel("status-bar");
    if (!statusBarPanel) {
      mountStatusBar(event.api);
    } else {
      statusBarPanel.group.header.hidden = true;
      setIsStatusBarVisible(true);
    }

    // Auto-cleanup: when the left edge group empties (e.g. user closes the
    // settings tab), remove the edge group entirely. Mirrors the old
    // "auto-hide side-grid when empty" UX from the peer-grid era.
    event.api.onDidLayoutChange(() => {
      const edge = event.api.getEdgeGroup(SIDE_EDGE);
      if (edge) {
        const group = event.api.groups.find((g) => g.id === edge.id);
        if (group && group.panels.length === 0) {
          event.api.removeEdgeGroup(SIDE_EDGE);
        }
      }

      const bottom = event.api.getEdgeGroup("bottom");
      if (bottom) {
        const group = event.api.groups.find((g) => g.id === bottom.id);
        if (group && group.panels.length === 0) {
          event.api.removeEdgeGroup("bottom");
        }
      }
      setIsStatusBarVisible(!!event.api.getPanel("status-bar"));

      save();
    });
    event.api.onDidActivePanelChange(save);
  }

  function handleSwitchWorkspace(id: string) {
    if (!appState || id === appState.activeWorkspaceId) return;
    save.flush();
    const next = switchWorkspace(appState, id);
    setAppState(next);
    const targetWs = next.workspaces[id];
    if (targetWs && mainApiRef.current) {
      applyWorkspaceState(mainApiRef.current, targetWs.layout, next.version);
    }
    setIsAddMenuOpen(false);
  }

  function handleCreateWorkspace() {
    if (!appState) return;
    const name = window.prompt("New Workspace Name:", "New Workspace");
    if (!name || !name.trim()) return;
    save.flush();
    const { state: next, workspace: newWs } = createWorkspace(appState, name);
    setAppState(next);
    if (mainApiRef.current) {
      applyWorkspaceState(mainApiRef.current, newWs.layout, next.version);
    }
    setIsAddMenuOpen(false);
  }

  function handleRenameWorkspace() {
    if (!appState) return;
    const activeWs = getActiveWorkspace(appState);
    const name = window.prompt("Rename Workspace:", activeWs.name);
    if (!name || !name.trim() || name.trim() === activeWs.name) return;
    const next = renameWorkspace(appState, activeWs.id, name);
    setAppState(next);
  }

  function handleDeleteWorkspace() {
    if (!appState) return;
    const activeWs = getActiveWorkspace(appState);
    const all = listWorkspaces(appState);
    if (all.length <= 1) {
      alert("Cannot delete the only remaining workspace.");
      return;
    }
    if (window.confirm(`Delete workspace "${activeWs.name}"?`)) {
      save.flush();
      const next = deleteWorkspace(appState, activeWs.id);
      setAppState(next);
      const nextActiveWs = getActiveWorkspace(next);
      if (nextActiveWs && mainApiRef.current) {
        applyWorkspaceState(mainApiRef.current, nextActiveWs.layout, next.version);
      }
    }
  }

  async function handleExportWorkspace() {
    if (!appState) return;
    save.flush();
    setIsAddMenuOpen(false);
    const activeWs = getActiveWorkspace(appState);
    const jsonStr = serializeWorkspaceDocument(activeWs);
    const safeName = activeWs.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    try {
      await saveTextFile(jsonStr, `${safeName || "workspace"}.exo.json`, [
        { name: "Exoskeleton workspace", extensions: ["json"] },
      ]);
    } catch (err) {
      alert(`Failed to export workspace: ${errorText(err)}`);
    }
  }

  function handleImportWorkspace() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.exo.json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const raw = event.target?.result as string;
          const importedWs = parseWorkspaceDocument(raw);
          if (!appState) return;
          save.flush();
          const newId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const workspaceToInsert = { ...importedWs, id: newId, updatedAt: Date.now() };
          const { state: next } = createWorkspace(appState, workspaceToInsert.name, workspaceToInsert.layout);
          setAppState(next);
          if (mainApiRef.current) {
            applyWorkspaceState(mainApiRef.current, workspaceToInsert.layout, next.version);
          }
        } catch (err) {
          alert(`Failed to import workspace: ${(err as Error).message}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
    setIsAddMenuOpen(false);
  }

  function handleOpenWorkspaceInNewWindow(workspaceId: string, e: React.MouseEvent) {
    e.stopPropagation();
    save.flush();
    invoke("open_workspace_window", { workspaceId }).catch((err) => {
      console.error("[exoskeleton] failed to open workspace window:", err);
    });
    setIsAddMenuOpen(false);
  }

  if (appState === undefined) {
    return <div className="app-frame app-frame--loading" />;
  }

  return (
    <div className="dockview-theme-abyss app-frame">
      <DockviewReact
        components={components}
        // — chrome slots: see ColoredTab.tsx, Watermark.tsx, HeaderActions.tsx —
        defaultTabComponent={ColoredTab}
        watermarkComponent={Watermark}
        prefixHeaderActionsComponent={PrefixHeaderActions}
        leftHeaderActionsComponent={LeftHeaderActions}
        rightHeaderActionsComponent={RightHeaderActions}
        onReady={onMainReady}
      />
      {!isStatusBarVisible && mainApiRef.current && (
        <button
          className="status-bar-summoner-btn"
          onClick={() => mountStatusBar(mainApiRef.current!)}
          title="Summon Astromech Status Bar"
        >
          ⌬
        </button>
      )}
      {mainApiRef.current && (
        <button
          className="add-panel-btn"
          onClick={() => setIsAddMenuOpen((v) => !v)}
          title="add a panel or manage workspaces"
        >
          ⊞
        </button>
      )}
      {isAddMenuOpen && mainApiRef.current && (
        <>
          <div
            className="add-panel-backdrop"
            onClick={() => setIsAddMenuOpen(false)}
          />
          <div className="add-panel-menu">
            {appState && (
              <div className="workspace-menu-section">
                <div className="workspace-menu-header">
                  <span className="workspace-menu-title">Workspaces</span>
                  <div className="workspace-menu-actions">
                    <button
                      className="workspace-action-btn"
                      onClick={handleCreateWorkspace}
                      title="Create new workspace"
                    >
                      + New
                    </button>
                    <button
                      className="workspace-action-btn"
                      onClick={handleExportWorkspace}
                      title="Export active workspace (.exo.json)"
                    >
                      Export
                    </button>
                    <button
                      className="workspace-action-btn"
                      onClick={handleImportWorkspace}
                      title="Import workspace document (.exo.json)"
                    >
                      Import
                    </button>
                    <button
                      className="workspace-action-btn"
                      onClick={handleRenameWorkspace}
                      title="Rename active workspace"
                    >
                      ✎
                    </button>
                    <button
                      className="workspace-action-btn workspace-action-btn--danger"
                      onClick={handleDeleteWorkspace}
                      title="Delete active workspace"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <div className="workspace-list">
                  {listWorkspaces(appState).map((ws) => {
                    const isActive = ws.id === appState.activeWorkspaceId;
                    return (
                      <button
                        key={ws.id}
                        className={`workspace-item ${isActive ? "workspace-item--active" : ""}`}
                        onClick={() => handleSwitchWorkspace(ws.id)}
                      >
                        <span className="workspace-name">{ws.name}</span>
                        <div className="workspace-item-controls">
                          <button
                            className="workspace-popout-btn"
                            onClick={(e) => handleOpenWorkspaceInNewWindow(ws.id, e)}
                            title="Open workspace in new window"
                          >
                            ❐
                          </button>
                          {isActive && <span className="workspace-indicator">●</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="add-panel-divider" />
              </div>
            )}
            {panelRegistry.map((entry) => {
              const open = !!mainApiRef.current?.getPanel(entry.id);
              return (
                <button
                  key={entry.id}
                  className="add-panel-item"
                  onClick={() => {
                    addOrFocusPanel(mainApiRef.current!, entry.id);
                    setIsAddMenuOpen(false);
                  }}
                >
                  <span
                    className="add-panel-glyph"
                    style={{ color: panelAccent(entry.id) }}
                  >
                    {panelGlyph(entry.id)}
                  </span>
                  <span className="add-panel-name">{entry.id}</span>
                  <span className="add-panel-state">
                    {open ? "●" : "+"}
                  </span>
                </button>
              );
            })}
            <div className="add-panel-divider" />
            <button
              className="add-panel-item add-panel-reset"
              onClick={() => {
                if (
                  window.confirm(
                    "Reset layout to default (Minimal)? Any unsaved panel position changes will be cleared.",
                  )
                ) {
                  mainApiRef.current?.clear();
                  buildPreset(mainApiRef.current!, DEFAULT_PRESET_ID);
                  setIsAddMenuOpen(false);
                }
              }}
            >
              <span className="add-panel-glyph" style={{ color: "#ff5252" }}>
                ↺
              </span>
              <span className="add-panel-name">Reset layout...</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
