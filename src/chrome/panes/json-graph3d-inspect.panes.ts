// Panes for json-graph3d-inspect. Param names and option values are
// taken from JsonGraph3DInspectPanel.tsx. Imported for its side effect.

import type { PanelPane } from "../../panel-manifest.ts";
import { registerPanes } from "../panes-registry.ts";

export const json3dInspectPanes: PanelPane[] = [
  {
    id: "look", kind: "pane", icon: "◐", label: "look", tooltip: "How edges, nodes and labels are drawn",
    body: {
      layout: "grid",
      cells: [
        { type: "segmented", param: "edgeColorBy", label: "edge color", tooltip: "What decides the color of a connection",
          options: [{ value: "category", label: "category", icon: "⁘" }, { value: "layer", label: "layer" }, { value: "predicate", label: "verb" }] },
        { type: "segmented", param: "nodeSizeBy", label: "node size", tooltip: "What decides how big a node's name is drawn",
          options: [{ value: "uniform", label: "same", icon: "●" }, { value: "degree", label: "by links", icon: "⬤" }] },
        { type: "segmented", param: "edgeLabels", label: "edge labels", tooltip: "When the text on a connection is shown",
          options: [{ value: "always", label: "always" }, { value: "hover", label: "hover" }, { value: "never", label: "never" }] },
        { type: "segmented", param: "edgeLabelOrientation", label: "label placement", tooltip: "Text runs along the edge or always faces you",
          options: [{ value: "along", label: "along" }, { value: "billboard", label: "facing" }] },
      ],
    },
  },
  {
    id: "structure", kind: "pane", icon: "⬡", label: "structure", tooltip: "Hulls, containment and relations",
    body: {
      layout: "grid",
      cells: [
        { type: "toggle", param: "hulls", label: "hulls", tooltip: "Draw a see-through shell around each group of nodes that belong together" },
        { type: "segmented", param: "hullMode", label: "hull shape", tooltip: "Shape of the shell around a group",
          options: [{ value: "ellipsoid", label: "blob", icon: "◯" }, { value: "convex", label: "convex", icon: "⬡" }] },
        { type: "toggle", param: "showContainmentLinks", label: "contain lines", tooltip: "Also draw the lines from a container to each thing inside it" },
        { type: "segmented", param: "hyperedgeLabel", label: "relations", tooltip: "How a relation node is labeled",
          options: [{ value: "predicate", label: "verb" }, { value: "dot", label: "dot" }, { value: "id", label: "id" }] },
      ],
    },
  },
  {
    id: "motion", kind: "pane", icon: "◫", label: "motion", tooltip: "Dimensions, physics and legend",
    body: {
      layout: "grid",
      cells: [
        { type: "segmented", param: "dimensions", label: "dimensions", tooltip: "Lay the graph out flat or in depth",
          options: [{ value: "2", label: "2D", icon: "▭" }, { value: "3", label: "3D", icon: "◫" }] },
        { type: "toggle", param: "freezeLayout", label: "freeze", tooltip: "Stop the nodes from moving; turn off to let them settle again" },
        { type: "toggle", param: "showLegend", label: "legend", tooltip: "Show the color key for connection kinds in the corner" },
      ],
    },
  },
  { id: "fit", kind: "action", icon: "⤢", label: "fit", tooltip: "Fit graph to view" },
];

registerPanes("json-graph3d-inspect", json3dInspectPanes);
