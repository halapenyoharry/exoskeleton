import type { IWatermarkPanelProps } from "dockview";
import "./SideGridWatermark.css";

/**
 * Shown when the side-grid has zero panels. Gives the user a friendly path
 * back from "I closed the only tab" — without it the grid container just
 * sits there empty and the user has no obvious way to repopulate it.
 *
 * Different from the main grid's Watermark: that one restores three panels
 * (editor / terminal / webview); this one restores the single settings panel.
 */
export default function SideGridWatermark(props: IWatermarkPanelProps) {
  const api = props.containerApi;

  function restoreSettings() {
    api.addPanel({
      id: "settings",
      component: "settings",
      title: "settings",
    });
  }

  return (
    <div className="side-watermark">
      <div className="side-watermark__card">
        <h2>side-grid is empty</h2>
        <p>you closed the only panel. press Cmd+B to hide this whole grid, or restore the settings panel below.</p>
        <button onClick={restoreSettings}>⚙ restore settings</button>
      </div>
    </div>
  );
}
