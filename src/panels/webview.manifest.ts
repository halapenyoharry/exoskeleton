import type { PanelManifest } from "../panel-manifest";
import LanWebview, { type LanWebviewParams } from "./LanWebview";

// Core-panel manifest — see editor.manifest.ts for why core panels
// declare the same contract as library panels.
const manifest: PanelManifest<LanWebviewParams> = {
  id: "webview",
  title: "webview",
  component: LanWebview,
  description:
    "Iframe with a URL bar, for LAN HTTP services and other iframe-friendly surfaces.",

  accent: "#6dffaa",
  glyph: "◯",

  // Runs anywhere an iframe does; Tauri's permissive webview is what
  // lets it load surfaces a browser-hosted iframe would refuse.
  capabilities: [],
  optionalCapabilities: ["iframe.permissive"],

  defaultLayout: { direction: "right", reference: "editor" },
  paramsDefault: { url: "https://dockview.dev" },
};

export default manifest;
