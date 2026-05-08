import { DockviewReact, type DockviewReadyEvent } from "dockview";
import ColoredTab from "./ColoredTab";
import EditorPanel from "./panels/EditorPanel";
import TerminalPanel from "./panels/TerminalPanel";
import WebviewPanel from "./panels/WebviewPanel";
import "./App.css";

const components = {
  editor: EditorPanel,
  terminal: TerminalPanel,
  webview: WebviewPanel,
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
        defaultTabComponent={ColoredTab}
        onReady={onReady}
      />
    </div>
  );
}
