import type { IWatermarkPanelProps } from "dockview";
import {
  addOrFocusPanel,
  buildDefaultLayout,
  panelRegistry,
  repairLayout,
} from "./persistence/default-layout";
import { panelAccent, panelGlyph } from "./ColoredTab";
import "./Watermark.css";

export default function Watermark(props: IWatermarkPanelProps) {
  const api = props.containerApi;

  // Both paths are idempotent: repairLayout rescues panels hidden in an
  // edge group (the "grid looks empty but every id already exists" trap),
  // buildDefaultLayout then adds only what's actually missing.
  function restoreAll() {
    repairLayout(api);
    buildDefaultLayout(api);
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
        <p className="watermark-hint">or summon one panel at a time:</p>
        <div className="watermark-buttons">
          {panelRegistry.map((entry) => (
            <button
              key={entry.id}
              className="watermark-btn"
              style={{ color: panelAccent(entry.id) }}
              onClick={() => addOrFocusPanel(api, entry.id)}
            >
              {panelGlyph(entry.id)} {entry.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
