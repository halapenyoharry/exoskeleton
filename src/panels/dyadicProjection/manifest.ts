import type { PanelManifest } from "../../panel-manifest";
import DyadicProjectionPanel, {
  dyadicProjectionDefaults,
  type DyadicProjectionParams,
} from "./DyadicProjectionPanel";

const manifest: PanelManifest<DyadicProjectionParams> = {
  id: "dyadicProjection",
  title: "dyadic",
  component: DyadicProjectionPanel,
  description:
    "Categorical viewer for TopoThink dyadic JSON. Renders each edge per its i2t:edge_category — containment as enclosures, state_change as gradient flows, interactivity as shared color fields, reference as low-weight tags. Never draws connector lines. Layer is the loadable unit.",

  accent: "#ffb86c",
  glyph: "◬",

  // Tabs into the json viewer group anchored by json-tree, alongside the
  // other graph viewers — but conceptually distinct: this is the only one
  // that respects the four-category edge contract.
  defaultLayout: { direction: "within", reference: "json-tree" },
  paramsDefault: dyadicProjectionDefaults,
};

export default manifest;
