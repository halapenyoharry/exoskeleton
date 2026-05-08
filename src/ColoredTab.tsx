import { DockviewDefaultTab, type IDockviewPanelHeaderProps } from "dockview";

const accents: Record<string, string> = {
  editor: "var(--accent-editor)",
  terminal: "var(--accent-terminal)",
  webview: "var(--accent-webview)",
};

export default function ColoredTab(props: IDockviewPanelHeaderProps) {
  const accent = accents[props.api.id] ?? "inherit";
  return (
    <DockviewDefaultTab
      {...props}
      style={{ color: accent }}
    />
  );
}
