// Panes for the editor: one row of file actions. Action ids are the ones
// EditorPanel.tsx handles in onPanelMenu.

import type { PanelPane } from "../../panel-manifest.ts";
import { registerPanes } from "../panes-registry.ts";

export const editorPanes: PanelPane[] = [
  {
    id: "file", kind: "pane", icon: "◆", label: "file", tooltip: "Open and save the file",
    body: {
      layout: "grid",
      cells: [
        { type: "action", action: "open", icon: "⤒", label: "Open", tooltip: "Open a file" },
        { type: "action", action: "save", icon: "⤓", label: "Save", tooltip: "Save the file" },
        { type: "action", action: "saveAs", icon: "⇲", label: "Save As", tooltip: "Save as…" },
      ],
    },
  },
];

registerPanes("editor", editorPanes);
