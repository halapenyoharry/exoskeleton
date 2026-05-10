import type { IDockviewPanelHeaderProps } from "dockview";
import "./ColoredTab.css";

const accents: Record<string, string> = {
  editor: "var(--accent-editor)",
  terminal: "var(--accent-terminal)",
  webview: "var(--accent-webview)",
};

const glyphs: Record<string, string> = {
  editor: "◆",
  terminal: "▸",
  webview: "◯",
};

export default function ColoredTab(props: IDockviewPanelHeaderProps) {
  const id = props.api.id;
  const title = props.api.title ?? id;
  const accent = accents[id] ?? "inherit";
  const glyph = glyphs[id] ?? "·";

  function onClose(e: React.MouseEvent) {
    e.stopPropagation();
    props.api.close();
  }

  return (
    <div className="colored-tab" style={{ color: accent }}>
      <span className="colored-tab__glyph">{glyph}</span>
      <span className="colored-tab__title">{title}</span>
      <button
        className="colored-tab__close"
        onClick={onClose}
        title="close panel"
      >
        ×
      </button>
    </div>
  );
}
