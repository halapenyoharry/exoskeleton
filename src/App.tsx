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
import BlankPanel from "./panels/BlankPanel";
import MenuPanel from "./panels/MenuPanel";
import { MenuContext, type MenuActions } from "./panels/menu-context";
import { stripTransientPanels } from "./persistence/strip-transient";
import { loadDeckOptIn, saveDeckOptIn } from "./chrome-settings";
import { DECK_QUERY, buildDeckLayout, reconcileLayouts } from "./persistence/deck";
import { closeBackClosers, closeOpenDrawers } from "./pane-chrome-state";
import { exoPanel } from "./PanelRoot";
import {
  addOrFocusPanel,
  applyWorkspaceState,
  buildDefaultLayout,
  buildPreset,
  migrateLayout,
  migrateSavedLayout,
  repairLayout,
} from "./persistence/default-layout";
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
  type Workspace,
} from "./persistence/storage";
import { appStorage } from "./persistence/app-storage";
import { createDebounce } from "./utils/debounce";
import { errorText, inTauri, saveTextFile } from "./utils/file-io";
import { defaultPresetId, isWebRuntime, presets } from "./persistence/presets";
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
  blank:           exoPanel(BlankPanel,         "var(--accent-settings)"),
  menu:            exoPanel(MenuPanel,          "var(--accent-settings)"),
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

/** Phone: web runtime and a viewport at or below DECK_QUERY. */
function isPhoneWidth(): boolean {
  return isWebRuntime() && typeof window.matchMedia === "function" && window.matchMedia(DECK_QUERY).matches;
}

/** Deck is opt-in: a phone shows the grid unless "One pane at a time" is on. */
function wantsDeck(): boolean {
  return isPhoneWidth() && loadDeckOptIn();
}

/** The layout to show for a workspace in deck mode: its saved deck
 *  reconciled with the grid (panels added/removed on desktop follow), or a
 *  fresh deck built from the grid. */
function deckLayoutFor(ws: Workspace) {
  return ws.mobileLayout ? reconcileLayouts(ws.mobileLayout, ws.layout) : buildDeckLayout(ws.layout);
}

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
  // Deck (phone) mode: single group of pills. Ref for handlers, state for render.
  const deckModeRef = useRef(false);
  const [deckMode, setDeckModeState] = useState(false);
  // Phone width (grid or deck) and the persisted deck opt-in.
  const [phone, setPhone] = useState(isPhoneWidth);
  const [deckOptIn, setDeckOptInState] = useState(loadDeckOptIn);
  const deckOptInRef = useRef(deckOptIn);
  // In deck mode the status bar is hidden until opened from the ⊞ menu.
  const deckStatusWantedRef = useRef(false);
  const collapsingRef = useRef(false);
  const mruRef = useRef<string[]>([]);
  // Floating ⊞ add-panel menu (bottom-right, next to the astromech
  // summoner). The roster is read fresh from the registry on each open,
  // so open/closed markers stay accurate without extra subscriptions.
  // The ⊞ button toggles a Dockview floating group holding the `menu`
  // panel (see toggleMenu). It is stripped from saved layouts.

  // Preferences state. Currently empty (see Preferences interface in
  // storage.ts); included in the save so future fields persist automatically.
  const prefsRef = useRef<AppStateV8["preferences"]>({});

  // Single debounced save. Reads the live api ref + current AppStateV8 each tick.
  const save = useRef(
    createDebounce(() => {
      const raw = mainApiRef.current?.toJSON();
      const main = raw && stripTransientPanels(raw);
      const current = appStateRef.current;
      if (!main || !current) return;
      const next = updateActiveWorkspaceLayout(
        current,
        main,
        deckModeRef.current ? "mobileLayout" : "layout",
      );
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
          applyWs(mainApiRef.current, activeWs, v8.version);
        }
      }
    };
    window.addEventListener("exoskeleton:state-applied", handleStateApplied);
    return () => {
      window.removeEventListener("exoskeleton:state-applied", handleStateApplied);
    };
  }, []);

  function setDeckMode(on: boolean) {
    deckModeRef.current = on;
    setDeckModeState(on);
  }

  function hideStatusBarInDeck(api: DockviewApi) {
    if (deckStatusWantedRef.current) return;
    const sb = api.getPanel("status-bar");
    if (sb) api.removePanel(sb);
    if (api.getEdgeGroup("bottom") && !api.getPanel("status-bar")) api.removeEdgeGroup("bottom");
    setIsStatusBarVisible(!!api.getPanel("status-bar"));
  }

  /** Apply a workspace to the dock in whichever mode we are in. */
  function applyWs(api: DockviewApi, ws: Workspace, version: number) {
    if (deckModeRef.current) {
      applyWorkspaceState(api, deckLayoutFor(ws), version);
      hideStatusBarInDeck(api);
    } else {
      applyWorkspaceState(api, ws.layout, version);
      ensureStatusBarChrome(api);
    }
  }

  /** The status bar is restored by fromJSON with a visible header; (re)hide it,
   *  or mount it if the saved grid lacked one. */
  function ensureStatusBarChrome(api: DockviewApi) {
    const sb = api.getPanel("status-bar");
    if (!sb) {
      mountStatusBar(api);
      return;
    }
    sb.group.header.hidden = true;
    setIsStatusBarVisible(true);
  }

  /** Width crossed the threshold: swap grid <-> deck, never flattening the grid. */
  function swapMode(toDeck: boolean) {
    const api = mainApiRef.current;
    if (!api || deckModeRef.current === toDeck) return;
    save.flush(); // writes the outgoing mode's slot
    const cur = appStateRef.current;
    if (!cur) return;
    const ws = getActiveWorkspace(cur);
    if (toDeck) {
      setDeckMode(true);
      const deck = deckLayoutFor(ws);
      applyWorkspaceState(api, deck, cur.version);
      hideStatusBarInDeck(api);
    } else {
      const deck = stripTransientPanels(api.toJSON());
      const withDeck = updateActiveWorkspaceLayout(cur, deck, "mobileLayout");
      const grid = reconcileLayouts(ws.layout, deck);
      const next = updateActiveWorkspaceLayout(withDeck, grid, "layout");
      appStateRef.current = next;
      setAppState(next);
      setDeckMode(false);
      applyWorkspaceState(api, grid, next.version);
      ensureStatusBarChrome(api);
    }
  }

  /** Deck keeps exactly one main group: anything that opened a second group
   *  (registry positions, drops) is folded back into it. */
  function collapseDeck(api: DockviewApi) {
    if (collapsingRef.current) return;
    const mains = api.groups.filter((g) => g.api.location.type === "grid");
    if (mains.length <= 1) return;
    collapsingRef.current = true;
    queueMicrotask(() => {
      try {
        const active = api.activePanel;
        const live = api.groups.filter((g) => g.api.location.type === "grid");
        const target = live.find((g) => g.panels.length > 0 && g === active?.group) ?? live[0];
        for (const g of live) {
          if (g === target) continue;
          for (const p of [...g.panels]) p.api.moveTo({ group: target, position: "center" });
        }
        active?.api.setActive();
      } catch (e) {
        console.warn("[exoskeleton] collapseDeck failed:", e);
      } finally {
        collapsingRef.current = false;
      }
    });
  }

  // Width threshold: swap between grid and deck as the viewport crosses it.
  useEffect(() => {
    if (!isWebRuntime() || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(DECK_QUERY);
    const onChange = () => {
      setPhone(mq.matches);
      swapMode(mq.matches && deckOptInRef.current);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Back absorption (deck, web only): the phone's back gesture dismisses
  // transient UI, then steps back through recently used panes. It never
  // leaves the page: the sentinel entry is re-pushed after every pop.
  useEffect(() => {
    if (!phone || !isWebRuntime()) return;
    const sentinel = { exo: "deck" };
    if ((history.state as { exo?: string } | null)?.exo !== "deck") {
      history.pushState(sentinel, "");
    }
    const onPop = () => {
      const api = mainApiRef.current;
      if (api) {
        if (api.getPanel("menu")) {
          api.getPanel("menu")?.api.close();
        } else if (closeBackClosers()) {
          /* ≡ menu dismissed */
        } else if (closeOpenDrawers()) {
          /* drawer dismissed */
        } else if (api.hasMaximizedGroup()) {
          api.exitMaximizedGroup();
        } else {
          const mru = mruRef.current;
          mru.pop(); // current pane
          while (mru.length) {
            const prev = api.getPanel(mru[mru.length - 1]);
            if (prev) {
              prev.api.setActive();
              break;
            }
            mru.pop();
          }
        }
      }
      history.pushState(sentinel, "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [phone]);

  function toggleDeckOptIn() {
    const on = !deckOptInRef.current;
    deckOptInRef.current = on;
    setDeckOptInState(on);
    saveDeckOptIn(on);
    swapMode(on && isPhoneWidth());
  }

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
    const startInDeck = wantsDeck();
    setDeckMode(startInDeck);
    let loadedDeck = false;
    if (appState) {
      const activeWs = getActiveWorkspace(appState);
      // Restore preferences so the first auto-save round-trips them.
      if (appState.preferences) prefsRef.current = appState.preferences;
      try {
        const layout = migrateSavedLayout(
          startInDeck ? deckLayoutFor(activeWs) : activeWs.layout,
          appState.version,
        );
        event.api.fromJSON(layout);
        loadedDeck = startInDeck;
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
            layout: stripTransientPanels(event.api.toJSON()),
            updatedAt: Date.now(),
          },
        },
        preferences: {},
      };
      appStateRef.current = fresh;
      setAppState(fresh);
    }

    // Phone with only a grid on hand (first run, or the fallback above):
    // fold it into the deck; the grid stays in `layout` as the workspace's
    // desktop arrangement.
    if (startInDeck && !loadedDeck) {
      const grid = stripTransientPanels(event.api.toJSON());
      const cur = appStateRef.current;
      if (cur && !appState) {
        appStateRef.current = updateActiveWorkspaceLayout(cur, grid, "layout");
      }
      event.api.clear();
      event.api.fromJSON(buildDeckLayout(grid));
    }

    // Rescue pathological saved layouts (panels absorbed into an edge
    // group, empty main grid). No-op when the layout is healthy; the
    // repaired arrangement is persisted by the next debounced save.
    repairLayout(event.api);

    // Check if status bar is in the restored panel list; if not, mount it.
    const statusBarPanel = event.api.getPanel("status-bar");
    if (startInDeck) {
      hideStatusBarInDeck(event.api);
    } else if (!statusBarPanel) {
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

      if (deckModeRef.current) collapseDeck(event.api);
      save();
    });
    event.api.onDidActivePanelChange((p) => {
      if (isPhoneWidth() && p && p.id !== "menu" && p.id !== "status-bar" && p.id !== "settings") {
        const mru = mruRef.current;
        if (mru[mru.length - 1] !== p.id) {
          const i = mru.indexOf(p.id);
          if (i >= 0) mru.splice(i, 1);
          mru.push(p.id);
          if (mru.length > 20) mru.shift();
        }
      }
      save();
    });
  }

  function closeMenu() {
    mainApiRef.current?.getPanel("menu")?.api.close();
  }

  function toggleMenu() {
    const api = mainApiRef.current;
    if (!api) return;
    const existing = api.getPanel("menu");
    if (existing) {
      existing.api.close();
      return;
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    const margin = 16;
    const narrow = W <= 600;
    const width = narrow ? W - margin * 2 : 320;
    const height = narrow ? H - margin * 2 : Math.min(480, H - 70);
    // Desktop: sit just above the ⊞ button (bottom-right).
    const x = narrow ? margin : Math.max(8, W - width - 12);
    const y = narrow ? margin : Math.max(8, H - height - 58);
    api.addPanel({
      id: "menu",
      component: "menu",
      title: "menu",
      floating: { width, height, x, y },
    });
  }

  function handleSwitchWorkspace(id: string) {
    if (!appState || id === appState.activeWorkspaceId) return;
    save.flush();
    const next = switchWorkspace(appState, id);
    setAppState(next);
    const targetWs = next.workspaces[id];
    if (targetWs && mainApiRef.current) {
      applyWs(mainApiRef.current, targetWs, next.version);
    }
    closeMenu();
  }

  function handleCreateWorkspace() {
    if (!appState) return;
    const name = window.prompt("New Workspace Name:", "New Workspace");
    if (!name || !name.trim()) return;
    save.flush();
    const { state: next, workspace: newWs } = createWorkspace(appState, name);
    setAppState(next);
    if (mainApiRef.current) {
      applyWs(mainApiRef.current, newWs, next.version);
    }
    closeMenu();
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
        applyWs(mainApiRef.current, nextActiveWs, next.version);
      }
    }
  }

  async function handleExportWorkspace() {
    if (!appState) return;
    save.flush();
    closeMenu();
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
          const { state: next, workspace: created } = createWorkspace(
            appState,
            workspaceToInsert.name,
            workspaceToInsert.layout,
            workspaceToInsert.mobileLayout,
          );
          setAppState(next);
          if (mainApiRef.current) {
            applyWs(mainApiRef.current, created, next.version);
          }
        } catch (err) {
          alert(`Failed to import workspace: ${(err as Error).message}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
    closeMenu();
  }

  function handleOpenWorkspaceInNewWindow(workspaceId: string, e: React.MouseEvent) {
    e.stopPropagation();
    save.flush();
    invoke("open_workspace_window", { workspaceId }).catch((err) => {
      console.error("[exoskeleton] failed to open workspace window:", err);
    });
    closeMenu();
  }

  if (appState === undefined) {
    return <div className="app-frame app-frame--loading" />;
  }

  const menuActions: MenuActions = {
    workspaces: appState ? listWorkspaces(appState) : [],
    activeWorkspaceId: appState?.activeWorkspaceId ?? "",
    isPanelOpen: (id) => !!mainApiRef.current?.getPanel(id),
    addPanel: (id) => {
      if (mainApiRef.current) addOrFocusPanel(mainApiRef.current, id);
      closeMenu();
    },
    switchWorkspace: handleSwitchWorkspace,
    createWorkspace: handleCreateWorkspace,
    renameWorkspace: handleRenameWorkspace,
    deleteWorkspace: handleDeleteWorkspace,
    openWorkspaceInNewWindow: (id) => handleOpenWorkspaceInNewWindow(id, { stopPropagation() {} } as React.MouseEvent),
    exportWorkspace: handleExportWorkspace,
    importWorkspace: handleImportWorkspace,
    resetLayout: () => {
      const api = mainApiRef.current;
      if (!api) return;
      if (
        window.confirm(
          `Reset layout to default (${presets.find((p) => p.id === defaultPresetId())?.name ?? "Minimal"})? Any unsaved panel position changes will be cleared.`,
        )
      ) {
        api.clear();
        buildPreset(api, defaultPresetId());
        if (deckModeRef.current && appStateRef.current) {
          // The preset is a grid: it becomes the desktop layout, and the
          // deck is rebuilt from it.
          const grid = stripTransientPanels(api.toJSON());
          const reset = updateActiveWorkspaceLayout(appStateRef.current, grid, "layout");
          const ws = getActiveWorkspace(reset);
          const clean: AppStateV8 = {
            ...reset,
            workspaces: { ...reset.workspaces, [ws.id]: { ...ws } },
          };
          delete clean.workspaces[ws.id].mobileLayout;
          appStateRef.current = clean;
          setAppState(clean);
          applyWs(api, clean.workspaces[ws.id], clean.version);
        }
      }
    },
    closeMenu,
    deckMode,
    phone,
    deckOptIn,
    toggleDeck: () => {
      toggleDeckOptIn();
      closeMenu();
    },
    statusBarVisible: isStatusBarVisible,
    toggleStatusBar: () => {
      const api = mainApiRef.current;
      if (!api) return;
      if (api.getPanel("status-bar")) {
        deckStatusWantedRef.current = false;
        hideStatusBarInDeck(api);
      } else {
        deckStatusWantedRef.current = true;
        mountStatusBar(api);
      }
      closeMenu();
    },
    toggleSettings: () => {
      toggleSettings();
      closeMenu();
    },
  };

  return (
    <MenuContext.Provider value={menuActions}>
    <div className={`dockview-theme-abyss app-frame${deckMode ? " exo-deck" : ""}${phone ? " exo-phone" : ""}`}>
      <DockviewReact
        components={components}
        // — chrome slots: see ColoredTab.tsx, Watermark.tsx, HeaderActions.tsx —
        singleTabMode="fullwidth"
        disableTabsOverflowList
        defaultTabComponent={ColoredTab}
        watermarkComponent={Watermark}
        rightHeaderActionsComponent={RightHeaderActions}
        floatingGroupBounds="boundedWithinViewport"
        onReady={onMainReady}
      />
      {!isStatusBarVisible && !deckMode && mainApiRef.current && (
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
          onClick={toggleMenu}
          title="menu: add panels, workspaces, about"
        >
          ⊞
        </button>
      )}
    </div>
    </MenuContext.Provider>
  );
}
