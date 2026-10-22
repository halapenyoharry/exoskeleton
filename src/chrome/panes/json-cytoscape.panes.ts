// Panes for json-cytoscape. Params from JsonCytoscapePanel.tsx
// (JsonCytoscapeParams, CytoscapeLayoutName).
// TODO: the "fit" button emits emitPanelMenu(panelId, "fit"); the panel does
// not yet subscribe with onPanelMenu (its toolbar called resetView).

import type { PanelPane } from "../../panel-manifest.ts";
import { registerPanes } from "../panes-registry.ts";

export const jsonCytoscapeStrip: PanelPane[] = [
  {
    id: "layout", kind: "pane", icon: "⌗", label: "layout", tooltip: "Layout algorithm",
    body: {
      layout: "grid",
      cells: [
        { type: "segmented", param: "layout", label: "algorithm", tooltip: "Layout algorithm", span: [3, 3],
          options: [
            { value: "fcose", label: "fcose" }, { value: "cose", label: "cose" },
            { value: "breadthfirst", label: "breadthfirst" }, { value: "concentric", label: "concentric" },
            { value: "circle", label: "circle" }, { value: "grid", label: "grid" }, { value: "random", label: "random" },
          ] },
      ],
    },
  },
  {
    id: "style", kind: "pane", icon: "◐", label: "style", tooltip: "Edges and labels",
    body: {
      layout: "stack",
      cells: [
        { type: "toggle", param: "curveEdges", label: "curve", tooltip: "Curve multi-edges" },
        { type: "toggle", param: "labelPrimary", label: "label", tooltip: "Label-primary: text is the node, no circle chrome" },
      ],
    },
  },
  { id: "fit", kind: "action", icon: "⤢", label: "fit", tooltip: "Fit graph to view" },
];

registerPanes("json-cytoscape", jsonCytoscapeStrip);
