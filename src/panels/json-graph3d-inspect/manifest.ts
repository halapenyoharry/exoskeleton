import type { PanelManifest } from "../../panel-manifest";
import JsonGraph3DInspectPanel, {
  jsonGraph3DInspectDefaults,
  type JsonGraph3DInspectParams,
} from "./JsonGraph3DInspectPanel";

const manifest: PanelManifest<JsonGraph3DInspectParams> = {
  id: "json-graph3d-inspect",
  title: "3D-Inspect",
  component: JsonGraph3DInspectPanel,
  description:
    "Reading-oriented sibling of json-graph3d. Nodes are their labels (text sprites, readable from the chair), edges carry inline role/predicate text, edge color follows i2t category (or layer/predicate, with overrides), node size follows degree, and containment relations are drawn as transparent hulls instead of lines.",

  accent: "#ffd166",
  glyph: "⌖",

  // Universal tier: needs nothing from the host (docs/panel-capability-map.md).
  capabilities: [],
  companions: ["json-edit"],

  defaultLayout: { direction: "within", reference: "json-graph3d" },
  paramsDefault: jsonGraph3DInspectDefaults,

  npmDependencies: {
    "react-force-graph-3d": "^1.27.0",
    three: "^0.184.0",
    "three-spritetext": "^1.10.0",
    "@types/three": "^0.184.0",
  },
};

export default manifest;
