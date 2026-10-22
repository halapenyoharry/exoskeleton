import type { PanelManifest } from "../../panel-manifest";
import JsonAttentionPanel, {
  jsonAttentionDefaults,
  type JsonAttentionParams,
} from "./JsonAttentionPanel";

const manifest: PanelManifest<JsonAttentionParams> = {
  id: "json-attention",
  title: "attention",
  component: JsonAttentionPanel,
  description:
    "Rigid-body field (Rapier 2D) where node mass is earned from connection and a token of attention walks the edges, bent toward heavy nodes. Every path it takes gets heavier; parking it on a node grows the node without creating anything. Synced by identity with the other graph viewers.",

  accent: "#e879f9",
  glyph: "◉",

  // Universal tier: needs nothing from the host (docs/panel-capability-map.md).
  // json-edit is the json-bus producer this viewer reads from.
  capabilities: [],
  companions: ["json-edit"],

  defaultLayout: { direction: "within", reference: "json-tree" },
  paramsDefault: jsonAttentionDefaults,

  npmDependencies: {
    "@dimforge/rapier2d-compat": "^0.21.0",
    d3: "^7.9.0",
    "@types/d3": "^7.4.3",
  },
};

export default manifest;
