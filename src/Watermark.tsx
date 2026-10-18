import type { IWatermarkPanelProps } from "dockview-react";
import {
  addOrFocusPanel,
  buildPreset,
} from "./persistence/default-layout";
import { presets } from "./persistence/presets";
import PanelPicker from "./PanelPicker";
import "./Watermark.css";

export default function Watermark(props: IWatermarkPanelProps) {
  const api = props.containerApi;

  function applyPreset(presetId: string) {
    api.clear();
    buildPreset(api, presetId);
  }

  return (
    <div className="watermark">
      <div className="watermark-card">
        <h2>the grid is empty</h2>
        <p>
          Choose a layout preset to begin or restore your workspace:
        </p>

        <div className="watermark-presets">
          {presets.filter((p) => p.id !== "blank").map((preset) => (
            <button
              key={preset.id}
              className="watermark-preset-btn"
              onClick={() => applyPreset(preset.id)}
            >
              <div className="watermark-preset-name">{preset.name}</div>
              <div className="watermark-preset-desc">{preset.description}</div>
            </button>
          ))}
        </div>

        <p className="watermark-hint">or summon one panel at a time:</p>
        <PanelPicker onPick={(id) => addOrFocusPanel(api, id)} />
      </div>
    </div>
  );
}
