// Panes for json-graph3d. Params from JsonGraph3DPanel.tsx
// (JsonGraph3DParams). Imported for its side effect via ./index.ts.
// TODO: the "fit" button emits emitPanelMenu(panelId, "fit"); JsonGraph3DPanel
// does not yet subscribe with onPanelMenu (its toolbar called resetView).

import type { PanelPane } from "../../panel-manifest.ts";
import { registerPanes } from "../panes-registry.ts";

export const json3dStrip: PanelPane[] = [
  {
    id: "view", kind: "pane", icon: "◈", label: "view", tooltip: "Dimensions and labels",
    body: {
      layout: "grid",
      cells: [
        { type: "segmented", param: "dimensions", label: "layout", tooltip: "Lay the graph out flat or in depth", span: [2, 1],
          options: [{ value: "2", label: "2D", icon: "▭" }, { value: "3", label: "3D", icon: "◫" }] },
        { type: "segmented", param: "labelMode", label: "labels", tooltip: "When node names are shown", span: [3, 1],
          options: [{ value: "always", label: "always" }, { value: "hover", label: "hover" }, { value: "never", label: "never" }] },
      ],
    },
  },
  {
    id: "motion", kind: "pane", icon: "⌗", label: "motion", tooltip: "Physics and particles",
    body: {
      layout: "stack",
      cells: [
        { type: "toggle", param: "particles", label: "particles", tooltip: "Show traveling particles on directed edges" },
        { type: "toggle", param: "freezeLayout", label: "freeze", tooltip: "Freeze the physics simulation" },
      ],
    },
  },
  { id: "fit", kind: "action", icon: "⤢", label: "fit", tooltip: "Fit graph to view" },
];

registerPanes("json-graph3d", json3dStrip);
