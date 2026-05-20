import type { PanelManifest } from "../../panel-manifest";
import JsonCirclesPanel, {
  jsonCirclesDefaults,
  type JsonCirclesParams,
} from "./JsonCirclesPanel";

const manifest: PanelManifest<JsonCirclesParams> = {
  id: "json-circles",
  title: "circles",
  component: JsonCirclesPanel,
  description:
    "Zoomable circle packing of the JSON document (D3 pack layout, uniform leaf weighting). Click circles to zoom in; click background to zoom out.",

  accent: "#ff4d8d",
  glyph: "◯",

  // Tabs into the viewer group anchored by json-tree.
  defaultLayout: { direction: "within", reference: "json-tree" },
  paramsDefault: jsonCirclesDefaults,

  npmDependencies: {
    d3: "^7.9.0",
    "@types/d3": "^7.4.3",
  },
};

export default manifest;
