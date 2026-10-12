// Slim toolbar (pane chrome v2.1): a dedicated 28px row of circular outlined
// icon buttons at the top of a panel's content. Items are declared in
// manifest.toolbar; a click calls emitPanelMenu(panelId, id).
import { emitPanelMenu } from "../panel-menu";
import type { ToolbarItem } from "../panel-manifest";
import "./SlimToolbar.css";

export function SlimToolbar({ panelId, items }: { panelId: string; items: ToolbarItem[] }) {
  return (
    <div className="slim-toolbar" role="toolbar" aria-label="Toolbar">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className="slim-toolbar__btn"
          aria-label={it.label}
          title={it.tooltip ?? it.label}
          disabled={it.disabled}
          onClick={() => emitPanelMenu(panelId, it.id)}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}
