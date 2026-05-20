import type { PanelManifest } from "../../panel-manifest";
import JsonMassPanel, {
  jsonMassDefaults,
  type JsonMassParams,
} from "./JsonMassPanel";

const manifest: PanelManifest<JsonMassParams> = {
  id: "json-mass",
  title: "mass",
  component: JsonMassPanel,
  description:
    "Circle packing weighted by substrate-normalized mass (text lines, image weights) rather than leaf count. Pairs with project-mass-scanner output.",

  accent: "#ffd166",
  glyph: "M",

  defaultLayout: { direction: "within", reference: "json-tree" },
  paramsDefault: jsonMassDefaults,

  npmDependencies: {
    d3: "^7.9.0",
    "@types/d3": "^7.4.3",
  },
};

export default manifest;
