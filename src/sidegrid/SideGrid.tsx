import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type SerializedDockview,
} from "dockview";
import ColoredTab from "../ColoredTab";
import SettingsPanel from "./SettingsPanel";
import "./SideGrid.css";

// The side-grid is a *peer* DockviewReact to the main grid. Same chrome
// (ColoredTab from the main grid's vocabulary), separate state. Designed
// to host app-level controls — today: a settings JSON editor. Tomorrow:
// themes, command palettes, anything that operates *on* the workspace
// rather than being content of the workspace.
//
// Peer grids can't drag-and-drop tabs across the boundary; that's intentional
// (separating "control" from "content" topologically).

const components = {
  settings: SettingsPanel,
};

function buildDefault(api: DockviewApi) {
  api.addPanel({
    id: "settings",
    component: "settings",
    title: "settings",
  });
}

interface SideGridProps {
  savedLayout: SerializedDockview | null;
  onApiReady: (api: DockviewApi) => void;
}

export default function SideGrid({ savedLayout, onApiReady }: SideGridProps) {
  function onReady(event: DockviewReadyEvent) {
    if (savedLayout) {
      try {
        event.api.fromJSON(savedLayout);
      } catch (e) {
        console.warn(
          "[side-grid] fromJSON failed, falling back to default:",
          e,
        );
        buildDefault(event.api);
      }
    } else {
      buildDefault(event.api);
    }
    onApiReady(event.api);
  }

  return (
    <div className="dockview-theme-abyss side-grid">
      <DockviewReact
        components={components}
        defaultTabComponent={ColoredTab}
        onReady={onReady}
      />
    </div>
  );
}
