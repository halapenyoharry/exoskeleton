import type { HeaderActionItem } from "../../panel-manifest.ts";

export const jsonEditHeaderActions: HeaderActionItem[] = [
  { id: "open", icon: "📂", label: "Open", tooltip: "Open file…" },
  { id: "save", icon: "⤓", label: "Download", tooltip: "Download JSON" },
  { id: "copy", icon: "⧉", label: "Copy", tooltip: "Copy JSON" },
  { id: "format", icon: "⇥", label: "Format", tooltip: "Format (pretty-print) JSON" },
  { id: "doc", icon: "", label: "Document", kind: "chip", textFrom: "doc", tooltip: "Current document \u2014 click to switch" },
];
