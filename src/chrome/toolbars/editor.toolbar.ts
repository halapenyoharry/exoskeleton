import type { ToolbarItem } from "../../panel-manifest.ts";

export const editorToolbar: ToolbarItem[] = [
  { id: "open", icon: "📂", label: "Open", tooltip: "Open a file" },
  { id: "save", icon: "💾", label: "Save", tooltip: "Save the file" },
  { id: "saveAs", icon: "⤓", label: "Save As", tooltip: "Save as…" },
];
