import type { PanelManifest } from "../../panel-manifest";
import SettingsPanel from "./SettingsPanel";

// Core-panel manifest — see ../editor.manifest.ts for why core panels
// declare the same contract as library panels.
const manifest: PanelManifest = {
  id: "settings",
  title: "settings",
  component: SettingsPanel,
  description:
    "Workspace settings. A tab in the json-edit group; Cmd+B focuses it (adding it if needed).",

  accent: "#8896a0",
  glyph: "⚙",

  // Needs somewhere to write settings — but every host has persistence,
  // so this is a requirement that's always satisfiable.
  capabilities: ["persistence"],
};

export default manifest;
