// Drawer strip for json-graph. Params from JsonGraphPanel.tsx (JsonGraphParams).
// TODO: layer toggles (layerVisibility is a Record, not a simple cell) are not
// bound. The "fit" button emits emitPanelMenu(panelId, "fit"); JsonGraphPanel
// does not yet subscribe with onPanelMenu (its toolbar called resetRef).

import type { PaneStripItem } from "../../panel-manifest.ts";
import { registerStrip } from "../strip-registry.ts";

export const jsonGraphStrip: PaneStripItem[] = [
  {
    id: "physics", kind: "tab", icon: "⌗", label: "physics", tooltip: "Layout simulation",
    body: {
      layout: "stack",
      cells: [{ type: "toggle", param: "freezeLayout", label: "freeze", tooltip: "Freeze the physics simulation" }],
    },
  },
  { id: "fit", kind: "button", icon: "⤢", label: "fit", tooltip: "Fit graph to view" },
];

registerStrip("json-graph", jsonGraphStrip);
