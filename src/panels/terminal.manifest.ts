import type { PanelManifest } from "../panel-manifest";
import TerminalPanel from "./TerminalPanel";

// Core-panel manifest — see editor.manifest.ts for why core panels
// declare the same contract as library panels.
const manifest: PanelManifest = {
  id: "terminal",
  title: "terminal",
  component: TerminalPanel,
  description:
    "Real shell (xterm.js + tauri-plugin-pty). The workspace's hands.",

  accent: "#ff9800",
  glyph: "▸",

  // The one true weld in the capability map: a real PTY exists only
  // where the host can spawn processes. No pty, no terminal — a host
  // that can't provide it should refuse this panel outright.
  capabilities: ["pty"],

  defaultLayout: { direction: "below", reference: "editor" },
};

export default manifest;
