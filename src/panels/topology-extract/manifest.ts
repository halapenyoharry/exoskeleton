import type { PanelManifest } from "../../panel-manifest";
import TopologyExtractPanel, {
  topologyExtractDefaults,
  type TopologyExtractParams,
} from "./TopologyExtractPanel";

const manifest: PanelManifest<TopologyExtractParams> = {
  id: "topology-extract",
  title: "topology-extract",
  component: TopologyExtractPanel,
  description:
    "Ingestion furnace for the info2topo pipeline. Takes source text, " +
    "runs it through an AI provider (OpenRouter default), and pushes " +
    "normalized-dyadic topology JSON to the json-bus.",

  accent: "#e040fb",
  glyph: "⚗",

  // Runs anywhere; file open/save is the one feature lost off-Tauri.
  capabilities: [],
  optionalCapabilities: ["fs"],

  // Primary consumer of this panel's output.
  companions: ["json-dyadic"],

  paramsDefault: topologyExtractDefaults,
};

export default manifest;
