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
  "tempo-clock": "var(--accent-tempo-clock)",
  settings: "var(--accent-settings)",
  piano: "var(--accent-piano)",
  scope: "var(--accent-scope)",
  "json-edit": "var(--accent-json-edit)",
  "json-tree": "var(--accent-json-tree)",
  "json-circles": "var(--accent-json-circles)",
  "json-mass": "var(--accent-json-mass)",
  "json-cytoscape": "var(--accent-json-cytoscape)",
  "json-graph": "var(--accent-json-graph)",
  "json-graph3d": "var(--accent-json-graph3d)",
  "json-dyadic": "var(--accent-json-dyadic)",
};

const glyphs: Record<string, string> = {
  editor: '"◆"',
  terminal: '"▸"',
  webview: '"◯"',
  settings: '"⚙"',
  "tempo-clock": '"♩"',
  piano: '"♬"',
  scope: '"∿"',
  "json-edit": '"{}"',
  "json-tree": '"ϟ"',
  "json-circles": '"◯"',
  "json-mass": '"M"',
  "json-cytoscape": '"⬢"',
  "json-graph": '"✦"',
  "json-graph3d": '"⌬"',
  "json-dyadic": '"◬"',
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
