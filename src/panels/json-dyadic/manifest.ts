import type { PanelManifest } from "../../panel-manifest";
import JsonDyadicPanel, {
  jsonDyadicDefaults,
  type JsonDyadicParams,
} from "./JsonDyadicPanel";

const manifest: PanelManifest<JsonDyadicParams> = {
  id: "json-dyadic",
  title: "dyadic",
  component: JsonDyadicPanel,
  description:
    "Categorical viewer for TopoThink dyadic JSON. Renders each edge per its i2t:edge_category — containment as enclosures, state_change as gradient flows, interactivity as shared color fields, reference as low-weight tags. Never draws connector lines. Layer is the loadable unit.",

  accent: "#ffb86c",
  glyph: "◬",

  // Universal tier: needs nothing from the host (docs/panel-capability-map.md).
  // json-edit is the json-bus producer this viewer reads from.
  capabilities: [],
  companions: ["json-edit"],

  // Tabs into the json viewer group anchored by json-tree, alongside the
  // other graph viewers — but conceptually distinct: this is the only one
  // that respects the four-category edge contract.
  defaultLayout: { direction: "within", reference: "json-tree" },
  paramsDefault: jsonDyadicDefaults,
};

export default manifest;
