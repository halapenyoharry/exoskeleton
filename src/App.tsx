import { useEffect, useRef, useState } from "react";
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
import ScopePanel from "./panels/scope/ScopePanel";
import JsonEditPanel from "./panels/json-edit/JsonEditPanel";
import JsonTreePanel from "./panels/json-tree/JsonTreePanel";
import JsonCirclesPanel from "./panels/json-circles/JsonCirclesPanel";
import JsonMassPanel from "./panels/json-mass/JsonMassPanel";
import JsonCytoscapePanel from "./panels/json-cytoscape/JsonCytoscapePanel";
import JsonGraphPanel from "./panels/json-graph/JsonGraphPanel";
import JsonGraph3DPanel from "./panels/json-graph3d/JsonGraph3DPanel";
import JsonDyadicPanel from "./panels/json-dyadic/JsonDyadicPanel";
import StatusBarPanel from "./panels/StatusBarPanel";
import { exoPanel } from "./PanelRoot";
import {
  buildDefaultLayout,
  migrateLayout,
  migrateSavedLayout,
} from "./persistence/default-layout";
import { CURRENT_VERSION, type AppState } from "./persistence/storage";
import { tauriStorage } from "./persistence/tauri-storage";
import "./App.css";

// SCHEMA — what panels exist and which React components fill them.
// Each entry is wrapped with `exoPanel(Component, accent)` so the host
// (not the panel) owns positioning and the accent stripe. The panel
// itself is pure content. See src/PanelRoot.tsx for the wrapper.
const components = {
  editor:          exoPanel(EditorPanel,        "var(--accent-editor)"),
  terminal:        exoPanel(TerminalPanel,      "var(--accent-terminal)"),
  webview:         exoPanel(LanWebview,         "var(--accent-webview)"),
  "tempo-clock":   exoPanel(TempoClockPanel,    "var(--accent-tempo-clock)"),
  settings:        exoPanel(SettingsPanel,      "var(--accent-settings)"),
  piano:           exoPanel(PianoPanel,         "var(--accent-piano)"),
  scope:           exoPanel(ScopePanel,         "var(--accent-scope)"),
  "json-edit":     exoPanel(JsonEditPanel,      "var(--accent-json-edit)"),
  "json-tree":     exoPanel(JsonTreePanel,      "var(--accent-json-tree)"),
  "json-circles":  exoPanel(JsonCirclesPanel,   "var(--accent-json-circles)"),
  "json-mass":     exoPanel(JsonMassPanel,      "var(--accent-json-mass)"),
  "json-cytoscape":exoPanel(JsonCytoscapePanel, "var(--accent-json-cytoscape)"),
  "json-graph":    exoPanel(JsonGraphPanel,     "var(--accent-json-graph)"),
  "json-graph3d":  exoPanel(JsonGraph3DPanel,   "var(--accent-json-graph3d)"),
  "json-dyadic":   exoPanel(JsonDyadicPanel,      "var(--accent-json-dyadic)"),
  "status-bar-panel": StatusBarPanel,
};

// Choose persistence backend by environment.
// Today: Tauri only. Tomorrow: branch on window.__TAURI_INTERNALS__,
// acquireVsCodeApi, etc. to pick web/vscode adapters.
const storage = tauriStorage;

// The Cmd+B-summoned settings panel lives in a Dockview 6 edge group on
// the left side of the main grid. Same constant used by toggleSettings,
// the auto-cleanup hook, and (implicitly) the serialized layout.
const SIDE_EDGE = "left" as const;
const SIDE_GROUP_ID = "side-grid";

// Debounce helper for save-on-change.
function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export default function App() {
  // Initial-load gate. `undefined` = loading; null = no saved state; an
  // AppState = restored from disk. We don't mount Dockview until this is
  // resolved so we don't briefly flash a default layout.
  const [saved, setSaved] = useState<AppState | null | undefined>(undefined);

  const mainApiRef = useRef<DockviewApi | null>(null);
  const [isStatusBarVisible, setIsStatusBarVisible] = useState(false);

  // Preferences state. Currently empty (see Preferences interface in
  // storage.ts); included in the save so future fields persist automatically.
  const prefsRef = useRef<AppState["preferences"]>({});

  // Single debounced save. Reads the live api ref + prefs ref each tick.
  const save = useRef(
    debounce(() => {
      const main = mainApiRef.current?.toJSON();
      if (!main) return;
      storage.save({
        version: CURRENT_VERSION,
        layout: main,
        preferences: prefsRef.current,
      });
    }, 400),
  ).current;

  // Initial load.
  useEffect(() => {
    storage.load().then(setSaved);
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
    const unlistenP = listen("shortcut:toggle-settings", () => toggleSettings());
    return () => {
      void unlistenP.then((fn) => fn());
    };
  }, []);

  function onMainReady(event: DockviewReadyEvent) {
    mainApiRef.current = event.api;
    if (saved) {
      // Restore preferences so the first auto-save round-trips them.
      if (saved.preferences) prefsRef.current = saved.preferences;
      try {
        const layout = migrateSavedLayout(saved.layout, saved.version);
        event.api.fromJSON(layout);
        // Add any panels the user's saved state predates. No-op when the
        // saved version is already current. Without this, panels installed
        // after the user's last save would never appear unless they
        // cleared state — a real UX trap for library-panel installs.
        migrateLayout(event.api, saved.version);
      } catch (e) {
        console.warn(
          "[exoskeleton] main fromJSON failed, falling back to defaults:",
          e,
        );
        buildDefaultLayout(event.api);
      }
    } else {
      buildDefaultLayout(event.api);
    }

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

  if (saved === undefined) {
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
    </div>
  );
}
