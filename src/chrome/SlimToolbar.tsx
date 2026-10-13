// Slim toolbar (pane chrome v2.1): a dedicated 28px row of circular outlined
// icon buttons at the top of a panel's content. Items are declared in
// manifest.toolbar; a click calls emitPanelMenu(panelId, id). Items with
// kind 'chip' render a text label fed by runtime-options' toolbar text.
import { useEffect, useState } from "react";
import { emitPanelMenu } from "../panel-menu";
import type { ToolbarItem } from "../panel-manifest";
import { getToolbarText, onToolbarText } from "./runtime-options";
import "./SlimToolbar.css";

function Chip({ panelId, item }: { panelId: string; item: ToolbarItem }) {
  const key = item.textFrom ?? item.id;
  const [text, setText] = useState(() => getToolbarText(panelId, key));
  useEffect(() => {
    setText(getToolbarText(panelId, key));
    return onToolbarText(panelId, key, setText);
  }, [panelId, key]);
  return (
    <button
      type="button"
      className="slim-toolbar__chip"
      data-toolbar-item={item.id}
      aria-label={item.label}
      title={item.tooltip ?? item.label}
      disabled={item.disabled}
      onClick={() => emitPanelMenu(panelId, item.id)}
    >
      {text || item.label}
    </button>
  );
}

export function SlimToolbar({ panelId, items }: { panelId: string; items: ToolbarItem[] }) {
  return (
    <div className="slim-toolbar" role="toolbar" aria-label="Toolbar">
      {items.map((it) =>
        it.kind === "chip" ? (
          <Chip key={it.id} panelId={panelId} item={it} />
        ) : (
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
        ),
      )}
    </div>
  );
}
