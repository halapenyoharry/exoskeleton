import type { PanelManifest } from "../../panel-manifest";
import JsonCosmosPanel, {
  jsonCosmosDefaults,
  type JsonCosmosParams,
} from "./JsonCosmosPanel";

const manifest: PanelManifest<JsonCosmosParams> = {
  id: "json-cosmos",
  title: "cosmos",
  component: JsonCosmosPanel,
  description:
    "cosmos.gl (the engine under Cosmograph): force layout and drawing on the GPU, for graphs with tens of thousands of nodes. Reads graph-shaped JSON from the json-bus.",

  accent: "var(--accent-json-cosmos)",
  glyph: "⁂",

  capabilities: [],
  companions: ["json-edit"],

  paramsDefault: jsonCosmosDefaults,

  npmDependencies: {
    "@cosmos.gl/graph": "3.5.1",
    "@luma.gl/core": "9.3.6",
    "@luma.gl/engine": "9.3.6",
    "@luma.gl/shadertools": "9.3.6",
    "@luma.gl/webgl": "9.3.6",
  },
};

export default manifest;
