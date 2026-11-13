import type { PanelManifest } from "../../panel-manifest";
import { textViewerPanes } from "../../chrome/panes/text-viewer.panes";
import TextViewerPanel, { textViewerDefaults, type TextViewerParams } from "./TextViewerPanel";

const manifest: PanelManifest<TextViewerParams> = {
  id: "text-viewer",
  title: "Text Viewer",
  component: TextViewerPanel,
  description: "Web-native text viewing panel with two-way cross-panel selection and focus.",
  accent: "var(--accent-editor)",
  glyph: "▤",
  panes: textViewerPanes,
  capabilities: [],
  optionalCapabilities: [],
  companions: [],
  paramsDefault: textViewerDefaults,
};

export default manifest;
