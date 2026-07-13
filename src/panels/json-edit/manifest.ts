import type { PanelManifest } from "../../panel-manifest";
import JsonEditPanel, {
  jsonEditDefaults,
  type JsonEditParams,
} from "./JsonEditPanel";

const manifest: PanelManifest<JsonEditParams> = {
  // identity
  id: "json-edit",
  title: "json-edit",
  component: JsonEditPanel,
  description:
    "Monaco JSON editor. Publishes parsed JSON to the json-bus (default channel 'default'); JSON-visualizer panels subscribe to render.",

  // chrome
  accent: "#59b8ff",
  glyph: "{}",

  // Runs anywhere; file open/save is the one feature lost off-Tauri.
  capabilities: [],
  optionalCapabilities: ["fs"],

  // layout — anchors the empty grid on first launch; visualizer panels
  // position themselves "right" or "within" relative to this id.
  paramsDefault: jsonEditDefaults,

  npmDependencies: {
    "@monaco-editor/react": "^4.7.0",
    "monaco-editor": "^0.55.0",
  },
};

export default manifest;
