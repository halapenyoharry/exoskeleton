import type { PanelManifest } from "../panel-manifest";
import StatusBarPanel from "./StatusBarPanel";

// Core-panel manifest — see editor.manifest.ts for why core panels
// declare the same contract as library panels.
const manifest: PanelManifest = {
  id: "status-bar",
  title: "status",
  component: StatusBarPanel,
  description:
    "Astromech status bar: json-bus stats, graph connect/decouple toggle, full-width chrome in the bottom edge group. Registered without the exoPanel accent wrapper on purpose.",

  accent: "#00e5ff",
  glyph: "⌬",

  // Universal tier: pure in-process UI over the json-bus.
  capabilities: [],
};

export default manifest;
