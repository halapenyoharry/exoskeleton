import type { PanelManifest } from "../panel-manifest";
import EditorPanel from "./EditorPanel";

// Manifest for a core (in-repo) panel. Core panels never get "installed",
// but declaring them in the same contract as library panels means every
// one of the 16 is capability-mapped — a host (or fork) can reason about
// the full roster uniformly. See docs/panel-capability-map.md.
const manifest: PanelManifest = {
  id: "editor",
  title: "editor",
  component: EditorPanel,
  description:
    "Markdown/text editor with native open/save. Anchors the default layout — the first panel into an empty grid.",

  accent: "#18ffff",
  glyph: "◆",

  // Host-bound: no filesystem, no editor. `fs` is native on Tauri and an
  // adapter on web/vscode hosts, so this is a glue-point, not a weld.
  capabilities: ["fs"],
};

export default manifest;
