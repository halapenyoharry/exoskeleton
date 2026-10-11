// Drawer strip for json-graph3d-inspect. Param names and option values are
// taken from JsonGraph3DInspectPanel.tsx. Imported for its side effect.

import type { PaneStripItem } from "../../panel-manifest.ts";
import { registerStrip } from "../strip-registry.ts";

export const json3dInspectStrip: PaneStripItem[] = [
  {
    id: "view", kind: "tab", icon: "◈", label: "view", tooltip: "Dimensions, edge labels, node size",
    body: {
      layout: "grid",
      cells: [
        { type: "segmented", param: "dimensions", label: "layout", tooltip: "Lay the graph out flat or in depth", span: [2, 1],
          options: [{ value: "2", label: "2D", icon: "▭" }, { value: "3", label: "3D", icon: "◫" }] },
        { type: "segmented", param: "edgeLabels", label: "edge labels", tooltip: "When the text on a connection is shown", span: [2, 1],
          options: [{ value: "always", label: "always" }, { value: "hover", label: "hover" }, { value: "never", label: "never" }] },
        { type: "segmented", param: "nodeSizeBy", label: "node size", tooltip: "What decides how big a node's name is drawn", span: [2, 1],
          options: [{ value: "uniform", label: "same", icon: "●" }, { value: "degree", label: "by links", icon: "⬤" }] },
      ],
    },
  },
  {
    id: "style", kind: "tab", icon: "◐", label: "style", tooltip: "Edge color and containment",
    body: {
      layout: "grid",
      cells: [
        { type: "segmented", param: "edgeColorBy", label: "edge color", tooltip: "What decides the color of a connection", span: [3, 1],
          options: [{ value: "category", label: "category", icon: "⁘" }, { value: "layer", label: "layer" }, { value: "predicate", label: "verb" }] },
        { type: "toggle", param: "hulls", label: "hulls", tooltip: "Draw a see-through shell around each group of nodes that belong together" },
        { type: "segmented", param: "hullMode", label: "hull shape", tooltip: "Shape of the shell around a group", span: [2, 1],
          options: [{ value: "ellipsoid", label: "blob", icon: "◯" }, { value: "convex", label: "convex", icon: "⬡" }] },
        { type: "toggle", param: "showContainmentLinks", label: "lines", tooltip: "Also draw the lines from a container to each thing inside it" },
      ],
    },
  },
  {
    id: "layout", kind: "tab", icon: "⌗", label: "layout", tooltip: "Physics and overlays",
    body: {
      layout: "stack",
      cells: [
        { type: "toggle", param: "freezeLayout", label: "freeze", tooltip: "Stop the nodes from moving; turn off to let them settle again" },
        { type: "toggle", param: "showLegend", label: "legend", tooltip: "Show the color key for connection kinds in the corner" },
      ],
    },
  },
  { id: "fit", kind: "button", icon: "⤢", label: "fit", tooltip: "Fit graph to view" },
];

registerStrip("json-graph3d-inspect", json3dInspectStrip);
