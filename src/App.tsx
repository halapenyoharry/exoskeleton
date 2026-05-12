import { useEffect, useRef, useState } from "react";
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
} from "dockview";
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
import { exoPanel } from "./PanelRoot";
import { buildDefaultLayout, migrateLayout } from "./persistence/default-layout";
import { CURRENT_VERSION, type AppState } from "./persistence/storage";
import { tauriStorage } from "./persistence/tauri-storage";
import "./App.css";

// SCHEMA — what panels exist and which React components fill them.
// Each entry is wrapped with `exoPanel(Component, accent)` so the host
// (not the panel) owns positioning and the accent stripe. The panel
// itself is pure content. See src/PanelRoot.tsx for the wrapper.
const components = {
  editor:        exoPanel(EditorPanel,     "var(--accent-editor)"),
  terminal:      exoPanel(TerminalPanel,   "var(--accent-terminal)"),
  webview:       exoPanel(LanWebview,      "var(--accent-webview)"),
  "tempo-clock": exoPanel(TempoClockPanel, "var(--accent-tempo-clock)"),
  settings:      exoPanel(SettingsPanel,   "var(--accent-settings)"),
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

  // Single debounced save. Reads the live api ref each tick.
  const save = useRef(
    debounce(() => {
      const main = mainApiRef.current?.toJSON();
      if (!main) return;
      storage.save({
        version: CURRENT_VERSION,
        layout: main,
      });
    }, 400),
  ).current;

  // Initial load.
  useEffect(() => {
    storage.load().then(setSaved);
  }, []);

  // Cmd+B / Ctrl+B summons or dismisses the settings panel (VS Code convention).
  // Settings lives in a left edge group that's created on demand and torn
  // down when its last panel closes.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "b") return;
      e.preventDefault();
      const api = mainApiRef.current;
      if (!api) return;

      const existing = api.getPanel("settings");
      if (existing) {
        api.removePanel(existing);
        return;
      }

      // Ensure the left edge group exists, then drop the settings panel in.
      // The onDidLayoutChange cleanup in onMainReady handles the reverse —
      // when the user closes the settings tab, the edge group is removed.
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
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function onMainReady(event: DockviewReadyEvent) {
    mainApiRef.current = event.api;
    if (saved) {
      try {
        event.api.fromJSON(saved.layout);
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
    </div>
  );
}
