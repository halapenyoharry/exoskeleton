import type { ToolbarItem } from "../../panel-manifest.ts";

export const jsonEditToolbar: ToolbarItem[] = [
  { id: "open", icon: "📂", label: "Open", tooltip: "Open file…" },
  { id: "save", icon: "⤓", label: "Download", tooltip: "Download JSON" },
  { id: "copy", icon: "⧉", label: "Copy", tooltip: "Copy JSON" },
  { id: "format", icon: "⇥", label: "Format", tooltip: "Format (pretty-print) JSON" },
];
