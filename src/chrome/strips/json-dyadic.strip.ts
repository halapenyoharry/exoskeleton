// Drawer strip for json-dyadic. Layer choices arrive at runtime
// (publishOptions(panelId, "layers", ...) from JsonDyadicPanel).
import type { PaneStripItem } from "../../panel-manifest.ts";
import { registerStrip } from "../strip-registry.ts";

export const jsonDyadicStrip: PaneStripItem[] = [
  {
    id: "layers", kind: "tab", icon: "◫", label: "layers", tooltip: "Dynamic layer",
    body: { layout: "stack", cells: [
      { type: "select", param: "selectedLayer", label: "layer", optionsFrom: "layers", span: [3, 1] },
    ] },
  },
  {
    id: "show", kind: "tab", icon: "◐", label: "show", tooltip: "Legend and metadata",
    body: { layout: "grid", cells: [
      { type: "toggle", param: "showCategoryLegend", label: "legend" },
      { type: "toggle", param: "showMetadata", label: "metadata" },
    ] },
  },
];

registerStrip("json-dyadic", jsonDyadicStrip);
