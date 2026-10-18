// Panes for json-graph. Params from JsonGraphPanel.tsx (JsonGraphParams).
// TODO: layer toggles (layerVisibility is a Record, not a simple cell) are not
// bound. The "fit" button emits emitPanelMenu(panelId, "fit"); JsonGraphPanel
// does not yet subscribe with onPanelMenu (its toolbar called resetRef).

import type { PanelPane } from "../../panel-manifest.ts";
import { registerPanes } from "../panes-registry.ts";

export const jsonGraphStrip: PanelPane[] = [
  {
    id: "physics", kind: "pane", icon: "⌗", label: "physics", tooltip: "Layout simulation",
    body: {
      layout: "stack",
      cells: [{ type: "toggle", param: "freezeLayout", label: "freeze", tooltip: "Freeze the physics simulation" }],
    },
  },
  { id: "fit", kind: "action", icon: "⤢", label: "fit", tooltip: "Fit graph to view" },
];

registerPanes("json-graph", jsonGraphStrip);
