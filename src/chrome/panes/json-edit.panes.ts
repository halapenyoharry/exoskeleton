// Panes for json-edit: one row of file actions plus the loaded document's
// name (published at runtime by the panel; click it to switch documents).
// Action ids are the ones JsonEditPanel.tsx handles in onPanelMenu.

import type { PanelPane } from "../../panel-manifest.ts";
import { registerPanes } from "../panes-registry.ts";

export const jsonEditPanes: PanelPane[] = [
  {
    id: "document", kind: "pane", icon: "{}", label: "document", tooltip: "Open, save, copy or format the loaded document; switch documents",
    body: {
      layout: "grid",
      cells: [
        { type: "action", action: "open", icon: "📂", label: "Open", tooltip: "Open file…" },
        { type: "action", action: "save", icon: "⤓", label: "Download", tooltip: "Download JSON" },
        { type: "action", action: "copy", icon: "⧉", label: "Copy", tooltip: "Copy JSON" },
        { type: "action", action: "format", icon: "⇥", label: "Format", tooltip: "Format (pretty-print) JSON" },
        { type: "text", action: "doc", textFrom: "doc", label: "Document", tooltip: "Current document — click to switch" },
      ],
    },
  },
];

registerPanes("json-edit", jsonEditPanes);
