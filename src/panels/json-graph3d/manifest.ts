import type { PanelManifest } from "../../panel-manifest";
import JsonGraph3DPanel, {
  jsonGraph3DDefaults,
  type JsonGraph3DParams,
} from "./JsonGraph3DPanel";

const manifest: PanelManifest<JsonGraph3DParams> = {
  id: "json-graph3d",
  title: "3d",
  component: JsonGraph3DPanel,
  description:
    "WebGL force-directed 3D graph (react-force-graph-3d). Fan-out multi-edges with sprite labels, layer toggles, freeze, 2D/3D mode switch. Detects graph-shaped JSON from the json-bus.",

  accent: "#ff9f1c",
  glyph: "⌬",

  // Universal tier: needs nothing from the host (docs/panel-capability-map.md).
  // json-edit is the json-bus producer this viewer reads from.
  capabilities: [],
  companions: ["json-edit"],

  defaultLayout: { direction: "within", reference: "json-tree" },
  paramsDefault: jsonGraph3DDefaults,

  npmDependencies: {
    "react-force-graph-3d": "^1.27.0",
    three: "^0.184.0",
    "three-spritetext": "^1.10.0",
    "@types/three": "^0.184.0",
  },
};

export default manifest;
