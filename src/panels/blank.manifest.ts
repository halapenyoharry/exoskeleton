import type { PanelManifest } from "../panel-manifest";
import BlankPanel from "./BlankPanel";

// Blank pane spawned by the header "+": a component picker that replaces
// itself with the chosen panel. Not in the registry or Watermark.
const manifest: PanelManifest = {
  id: "blank",
  title: "new",
  component: BlankPanel,
  description: "Blank pane with a component picker; becomes the chosen panel in place.",
  accent: "#8896a0",
  glyph: "+",
  capabilities: [],
  optionalCapabilities: [],
};

export default manifest;
