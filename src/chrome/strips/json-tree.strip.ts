// Drawer strip for json-tree. Params from JsonTreePanel.tsx (JsonTreeParams).

import type { PaneStripItem } from "../../panel-manifest.ts";
import { registerStrip } from "../strip-registry.ts";

export const jsonTreeStrip: PaneStripItem[] = [
  {
    id: "layout", kind: "tab", icon: "⌗", label: "layout", tooltip: "Tree layout and orientation",
    body: {
      layout: "grid",
      cells: [
        { type: "segmented", param: "layout", label: "layout", tooltip: "Tree layout algorithm", span: [2, 1],
          options: [{ value: "cluster", label: "cluster" }, { value: "tidy", label: "tidy" }] },
        { type: "segmented", param: "direction", label: "orientation", tooltip: "Reading direction", span: [3, 1],
          options: [{ value: "LR", label: "L→R" }, { value: "RL", label: "R→L" }, { value: "TB", label: "T↓B" }, { value: "BT", label: "B↑T" }] },
        { type: "toggle", param: "fitOnLoad", label: "fit on load", tooltip: "Fit the tree to the pane when drawn or the document changes" },
      ],
    },
  },
  {
    id: "labels", kind: "tab", icon: "Ⓝ", label: "labels", tooltip: "Array indices and primitives",
    body: {
      layout: "stack",
      cells: [
        { type: "toggle", param: "showArrayIndices", label: "[N]", tooltip: "Show [N] prefix on array items" },
        { type: "toggle", param: "explodePrimitives", label: "explode", tooltip: "Separate primitive values into child nodes" },
      ],
    },
  },
  { id: "reset", kind: "button", icon: "⤢", label: "reset", tooltip: "Reset view" },
];

registerStrip("json-tree", jsonTreeStrip);
