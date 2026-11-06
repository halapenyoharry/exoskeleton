import type { PanelManifest } from "../../panel-manifest";
import TldrawPanel from "./TldrawPanel";

const manifest: PanelManifest = {
  id: "tldraw",
  title: "tldraw",
  component: TldrawPanel,
  description: "tldraw's whiteboard SDK, vanilla: its own drawing tools, menus and shapes.",
  accent: "var(--accent-tldraw)",
  glyph: "✎",
  capabilities: [],
  optionalCapabilities: [],
  companions: [],
  npmDependencies: {
    tldraw: "5.6.0",
    "@tldraw/assets": "5.6.0",
  },
};

export default manifest;
