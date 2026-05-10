import { DockviewReact, type DockviewReadyEvent } from "dockview";
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
import "./App.css";

// Panel content components — what fills each rectangle.
const components = {
  editor: EditorPanel,
  terminal: TerminalPanel,
  webview: LanWebview,
};

function onReady(event: DockviewReadyEvent) {
  event.api.addPanel({
    id: "editor",
    component: "editor",
    title: "editor",
  });

  event.api.addPanel({
    id: "webview",
    component: "webview",
    title: "webview",
    position: { referencePanel: "editor", direction: "right" },
  });

  event.api.addPanel({
    id: "terminal",
    component: "terminal",
    title: "terminal",
    position: { referencePanel: "editor", direction: "below" },
  });
}

export default function App() {
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
