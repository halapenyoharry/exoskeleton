import type { PanelManifest } from "../../panel-manifest";
import JsonGraphPanel, {
  jsonGraphDefaults,
  type JsonGraphParams,
} from "./JsonGraphPanel";

const manifest: PanelManifest<JsonGraphParams> = {
  id: "json-graph",
  title: "graph",
  component: JsonGraphPanel,
  description:
    "D3 force-directed graph of the JSON document on the json-bus. Drag nodes; scroll to zoom; freeze the layout to explore stably. Detects {nodes, edges}, edge arrays, and rooted-node shapes.",

  accent: "#06d6a0",
  glyph: "✦",

  // Universal tier: needs nothing from the host (docs/panel-capability-map.md).
  // json-edit is the json-bus producer this viewer reads from.
  capabilities: [],
  companions: ["json-edit"],

  defaultLayout: { direction: "within", reference: "json-tree" },
  paramsDefault: jsonGraphDefaults,

  npmDependencies: {
    d3: "^7.9.0",
    "@types/d3": "^7.4.3",
  },
};

export default manifest;
