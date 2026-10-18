import type { PanelManifest } from "../../panel-manifest";
import AddPanelPanel from "./AddPanelPanel";

const manifest: PanelManifest = {
  id: "add-panel",
  title: "add",
  component: AddPanelPanel,
  description:
    "Panel roster and workspace manager. Lists every registered panel (add or focus), and the workspaces (switch, create, rename, delete, export, import, open in a new window). Lives as a tab in the json-edit group.",

  accent: "#00e5ff",
  glyph: "⊞",

  capabilities: ["persistence"],
};

export default manifest;
