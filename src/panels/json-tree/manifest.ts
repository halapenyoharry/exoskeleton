import type { PanelManifest } from "../../panel-manifest";
import JsonTreePanel, {
  jsonTreeDefaults,
  type JsonTreeParams,
} from "./JsonTreePanel";

const manifest: PanelManifest<JsonTreeParams> = {
  // identity
  id: "json-tree",
  title: "tree",
  component: JsonTreePanel,
  description:
    "Hierarchical D3 tree (cluster or tidy) of the JSON document on the json-bus. Drag nodes; scroll to zoom; configurable orientation.",

  // chrome
  accent: "#00e5ff",
  glyph: "ϟ",

  // layout — splits right of the editor on first launch; sibling viewer
  // panels (graph, cyto, 3d, circles, mass) tab into this group.
  defaultLayout: { direction: "right", reference: "json-edit" },
  paramsDefault: jsonTreeDefaults,

  npmDependencies: {
    d3: "^7.9.0",
    "@types/d3": "^7.4.3",
  },
};

export default manifest;
