import { useEffect, useRef, useState } from "react";
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type SerializedDockview,
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
import SideGrid from "./sidegrid/SideGrid";
import { buildDefaultLayout } from "./persistence/default-layout";
import { CURRENT_VERSION, type AppState } from "./persistence/storage";
import { tauriStorage } from "./persistence/tauri-storage";
import "./App.css";

// SCHEMA — what panels exist and which React components fill them.
// (See README "Building with it" for the schema/state distinction.)
const components = {
  editor: EditorPanel,
  terminal: TerminalPanel,
  webview: LanWebview,
};

// Choose persistence backend by environment.
// Today: Tauri only. Tomorrow: branch on window.__TAURI_INTERNALS__,
// acquireVsCodeApi, etc. to pick web/vscode adapters.
const storage = tauriStorage;

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

  // Side-grid visibility. Toggled by Cmd+B (or Ctrl+B on Linux). Persisted
  // in preferences.sideGridVisible.
  const [sideGridVisible, setSideGridVisible] = useState(false);

  // Latest known side-grid layout. Tracked in state so it survives the
  // SideGrid unmount/remount cycle as the user toggles visibility.
  const [sideGridLayout, setSideGridLayout] =
    useState<SerializedDockview | null>(null);

  const mainApiRef = useRef<DockviewApi | null>(null);
  const sideApiRef = useRef<DockviewApi | null>(null);

  // Refs so the (debounced) save callback can read current values without
  // being recreated. The save itself is captured once and stable.
  const sideGridVisibleRef = useRef(sideGridVisible);
  const sideGridLayoutRef = useRef(sideGridLayout);
  useEffect(() => { sideGridVisibleRef.current = sideGridVisible; }, [sideGridVisible]);
  useEffect(() => { sideGridLayoutRef.current = sideGridLayout; }, [sideGridLayout]);

  // Single debounced save. Reads current values via refs.
  const save = useRef(
    debounce(() => {
      const main = mainApiRef.current?.toJSON();
      if (!main) return;
      // Try the live side api first; fall back to the last-known layout we
      // captured before the SideGrid component unmounted.
      let side: SerializedDockview | null | undefined;
      try {
        side = sideApiRef.current?.toJSON();
      } catch {
        side = undefined;
      }
      if (!side) side = sideGridLayoutRef.current;
      storage.save({
        version: CURRENT_VERSION,
        layout: main,
        sideGrid: side ?? undefined,
        preferences: {
          sideGridVisible: sideGridVisibleRef.current,
        },
      });
    }, 400),
  ).current;

  // When the SideGrid hides, its Dockview is disposed but our ref still
  // points at it. Clear so future saves use the captured snapshot instead.
  useEffect(() => {
    if (!sideGridVisible) sideApiRef.current = null;
  }, [sideGridVisible]);

  // Initial load.
  useEffect(() => {
    storage.load().then((s) => {
      setSaved(s);
      setSideGridVisible(s?.preferences?.sideGridVisible ?? false);
      setSideGridLayout(s?.sideGrid ?? null);
    });
  }, []);

  // Save whenever side-grid visibility changes (after initial load).
  useEffect(() => {
    if (saved !== undefined) save();
  }, [sideGridVisible, saved, save]);

  // Cmd+B / Ctrl+B toggles the side-grid (VS Code convention).
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSideGridVisible((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function onMainReady(event: DockviewReadyEvent) {
    mainApiRef.current = event.api;
    if (saved) {
      try {
        event.api.fromJSON(saved.layout);
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
    event.api.onDidLayoutChange(save);
    event.api.onDidActivePanelChange(save);
  }

  function onSideReady(api: DockviewApi) {
    sideApiRef.current = api;
    api.onDidLayoutChange(() => {
      // Auto-hide when the last panel closes. UX cue: an empty side-grid
      // sitting there with a watermark is a worse signal than just
      // tucking it away. Clear the saved layout so next Cmd+B rebuilds
      // the default settings panel rather than restoring the empty state.
      if (api.totalPanels === 0) {
        setSideGridVisible(false);
        setSideGridLayout(null);
      } else {
        setSideGridLayout(api.toJSON());
      }
      save();
    });
    api.onDidActivePanelChange(save);
  }

  if (saved === undefined) {
    return <div className="app-frame app-frame--loading" />;
  }

  return (
    <div className="dockview-theme-abyss app-frame">
      <div className="app-layout">
        {sideGridVisible && (
          <div className="app-layout__side">
            <SideGrid
              savedLayout={sideGridLayout}
              onApiReady={onSideReady}
            />
          </div>
        )}
        <div className="app-layout__main">
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
      </div>
    </div>
  );
}
