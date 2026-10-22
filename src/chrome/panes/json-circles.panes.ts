// Panes for json-circles. Params from JsonCirclesPanel.tsx.
import type { PanelPane } from "../../panel-manifest.ts";
import { registerPanes } from "../panes-registry.ts";

export const jsonCirclesStrip: PanelPane[] = [
  {
    id: "labels", kind: "pane", icon: "Ⓝ", label: "labels", tooltip: "Array indices",
    body: {
      layout: "stack",
      cells: [{ type: "toggle", param: "showArrayIndices", label: "[N]", tooltip: "Show [N] prefix on array items" }],
    },
  },
  { id: "reset", kind: "action", icon: "⤢", label: "reset", tooltip: "Reset view" },
];

registerPanes("json-circles", jsonCirclesStrip);
