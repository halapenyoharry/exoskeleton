// Drawer strip for json-circles. Params from JsonCirclesPanel.tsx.
import type { PaneStripItem } from "../../panel-manifest.ts";
import { registerStrip } from "../strip-registry.ts";

export const jsonCirclesStrip: PaneStripItem[] = [
  {
    id: "labels", kind: "tab", icon: "Ⓝ", label: "labels", tooltip: "Array indices",
    body: {
      layout: "stack",
      cells: [{ type: "toggle", param: "showArrayIndices", label: "[N]", tooltip: "Show [N] prefix on array items" }],
    },
  },
  { id: "reset", kind: "button", icon: "⤢", label: "reset", tooltip: "Reset view" },
];

registerStrip("json-circles", jsonCirclesStrip);
