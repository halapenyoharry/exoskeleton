import type { PanelManifest } from "../../panel-manifest";
import type { TextViewerParams } from "./TextViewerPanel";
import TextViewerPanel from "./TextViewerPanel";

const manifest: PanelManifest<TextViewerParams> = {
  id: "text-viewer",
  title: "Text Viewer",
  component: TextViewerPanel,
  description: "Web-native text viewing panel with two-way cross-panel selection and focus.",
  accent: "var(--accent-editor)",
  glyph: "▤",
  capabilities: [],
  optionalCapabilities: [],
  companions: [],
  paramsDefault: {
    documentId: "default",
  },
};

export default manifest;
