// Panes for json-dyadic. Layer choices arrive at runtime
// (publishOptions(panelId, "layers", ...) from JsonDyadicPanel).
import type { PanelPane } from "../../panel-manifest.ts";
import { registerPanes } from "../panes-registry.ts";

export const jsonDyadicStrip: PanelPane[] = [
  {
    id: "layers", kind: "pane", icon: "◫", label: "layers", tooltip: "Dynamic layer",
    body: { layout: "stack", cells: [
      { type: "select", param: "selectedLayer", label: "layer", optionsFrom: "layers", span: [3, 1] },
    ] },
  },
  {
    id: "show", kind: "pane", icon: "◐", label: "show", tooltip: "Legend and metadata",
    body: { layout: "grid", cells: [
      { type: "toggle", param: "showCategoryLegend", label: "legend" },
      { type: "toggle", param: "showMetadata", label: "metadata" },
    ] },
  },
];

registerPanes("json-dyadic", jsonDyadicStrip);
