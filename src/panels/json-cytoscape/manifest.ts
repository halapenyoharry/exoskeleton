import type { PanelManifest } from "../../panel-manifest";
import JsonCytoscapePanel, {
  jsonCytoscapeDefaults,
  type JsonCytoscapeParams,
} from "./JsonCytoscapePanel";

const manifest: PanelManifest<JsonCytoscapeParams> = {
  id: "json-cytoscape",
  title: "cyto",
  component: JsonCytoscapePanel,
  description:
    "Cytoscape.js graph (multi-layout: fcose, cose, breadthfirst, concentric, circle, grid, random). Detects graph-shaped JSON from the json-bus; supports multi-edge, layer toggles, attribute tooltips.",

  accent: "#b388ff",
  glyph: "⬢",

  // Universal tier: needs nothing from the host (docs/panel-capability-map.md).
  // json-edit is the json-bus producer this viewer reads from.
  capabilities: [],
  companions: ["json-edit"],

  defaultLayout: { direction: "within", reference: "json-tree" },
  paramsDefault: jsonCytoscapeDefaults,

  npmDependencies: {
    cytoscape: "^3.33.0",
    "cytoscape-fcose": "^2.2.0",
    "@types/cytoscape": "^3.21.0",
  },
};

export default manifest;
