import { DockviewDefaultTab, type IDockviewPanelHeaderProps } from "dockview";
import "./ColoredTab.css";

// Customize Dockview's default tab without replacing it. The default tab
// carries the drag-and-drop plumbing (pointer event handlers, drag start /
// data transfer setup). Building a tab from scratch means re-implementing
// that — easy to get wrong, breaks when Dockview ships internal changes.
//
// Instead we pass color + a CSS variable carrying the glyph through to the
// default tab's root div. ColoredTab.css uses the variable in a ::before
// pseudo-element. Result: drag works because we touched nothing important.

const accents: Record<string, string> = {
  editor: "var(--accent-editor)",
  terminal: "var(--accent-terminal)",
  webview: "var(--accent-webview)",
  topoviewer: "var(--accent-topoviewer)",
};

const glyphs: Record<string, string> = {
  editor: '"◆"',
  terminal: '"▸"',
  webview: '"◯"',
  topoviewer: '"⌬"',
  settings: '"⚙"',
};

export default function ColoredTab(props: IDockviewPanelHeaderProps) {
  const id = props.api.id;
  const accent = accents[id] ?? "inherit";
  const glyph = glyphs[id] ?? '"·"';

  return (
    <DockviewDefaultTab
      {...props}
      style={
        {
          color: accent,
          "--tab-glyph": glyph,
        } as React.CSSProperties
      }
    />
  );
}
