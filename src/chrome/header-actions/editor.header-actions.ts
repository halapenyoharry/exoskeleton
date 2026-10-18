import type { HeaderActionItem } from "../../panel-manifest.ts";

export const editorHeaderActions: HeaderActionItem[] = [
  { id: "open", icon: "📂", label: "Open", tooltip: "Open a file" },
  { id: "save", icon: "💾", label: "Save", tooltip: "Save the file" },
  { id: "saveAs", icon: "⤓", label: "Save As", tooltip: "Save as…" },
];
