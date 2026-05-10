import type { IWatermarkPanelProps } from "dockview";
import "./Watermark.css";

export default function Watermark(props: IWatermarkPanelProps) {
  const api = props.containerApi;

  function restoreAll() {
    api.addPanel({ id: "editor", component: "editor", title: "editor" });
    api.addPanel({
      id: "webview",
      component: "webview",
      title: "webview",
      position: { referencePanel: "editor", direction: "right" },
    });
    api.addPanel({
      id: "terminal",
      component: "terminal",
      title: "terminal",
      position: { referencePanel: "editor", direction: "below" },
    });
  }

  function restoreOne(id: "editor" | "terminal" | "webview") {
    api.addPanel({ id, component: id, title: id });
  }

  return (
    <div className="watermark">
      <div className="watermark-card">
        <h2>the grid is empty</h2>
        <p>
          this is what the <code>watermarkComponent</code> slot renders when
          no panels are open. it's your last-chance UI before the user thinks
          the app is broken.
        </p>
        <button className="watermark-restore" onClick={restoreAll}>
          restore default layout
        </button>
        <p className="watermark-hint">or restore one panel at a time:</p>
        <div className="watermark-buttons">
          <button
            className="watermark-btn watermark-btn--editor"
            onClick={() => restoreOne("editor")}
          >
            ◆ editor
          </button>
          <button
            className="watermark-btn watermark-btn--terminal"
            onClick={() => restoreOne("terminal")}
          >
            ▸ terminal
          </button>
          <button
            className="watermark-btn watermark-btn--webview"
            onClick={() => restoreOne("webview")}
          >
            ◯ webview
          </button>
        </div>
      </div>
    </div>
  );
}
