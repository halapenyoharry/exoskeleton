import { isPanelSupported, panelRegistry } from "./persistence/default-layout";
import { panelAccent, panelGlyph } from "./ColoredTab";
import "./PanelPicker.css";

/**
 * Shared component picker: one button per supported panelRegistry entry, tinted
 * with the panel's accent. Used by the Watermark (empty grid) and BlankPanel
 * (the header "+"). The caller decides what "choose" means.
 */
export default function PanelPicker({
  onPick,
  variant = "chips",
}: {
  onPick: (id: string) => void;
  variant?: "chips" | "list";
}) {
  return (
    <div className={`panel-picker panel-picker--${variant}`}>
      {panelRegistry.filter((entry) => isPanelSupported(entry)).map((entry) => (
        <button
          key={entry.id}
          className="panel-picker-btn watermark-btn"
          style={{ color: panelAccent(entry.id) }}
          onClick={() => onPick(entry.id)}
        >
          {panelGlyph(entry.id)} {entry.id}
        </button>
      ))}
    </div>
  );
}
