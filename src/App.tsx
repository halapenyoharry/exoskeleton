import { useRef } from "react";
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
import { buildDefaultLayout } from "./persistence/default-layout";
import { CURRENT_VERSION } from "./persistence/storage";
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
  const apiRef = useRef<DockviewApi | null>(null);

  async function onReady(event: DockviewReadyEvent) {
    apiRef.current = event.api;

    // Try to restore saved state. If absent or incompatible, build defaults.
    const saved = await storage.load();
    if (saved) {
      try {
        event.api.fromJSON(saved.layout);
      } catch (e) {
        console.warn(
          "[exoskeleton] fromJSON failed, falling back to defaults:",
          e,
        );
        buildDefaultLayout(event.api);
      }
    } else {
      buildDefaultLayout(event.api);
    }

    // Save on any layout mutation (panels added/removed/moved/resized,
    // active panel changed, panel params updated). Debounced so a rapid
    // drag doesn't write 30 times per second.
    const save = debounce(() => {
      const layout = event.api.toJSON();
      storage.save({ version: CURRENT_VERSION, layout });
    }, 400);

    event.api.onDidLayoutChange(save);
    event.api.onDidActivePanelChange(save);
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
        onReady={onReady}
      />
    </div>
  );
}
