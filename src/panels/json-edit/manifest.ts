import { graphLibrary } from "../../fixtures/graphs";
import type { PanelManifest } from "../../panel-manifest";
import { jsonEditToolbar } from "../../chrome/toolbars/json-edit.toolbar";
import JsonEditPanel, {
  jsonEditDefaults,
  type JsonEditParams,
} from "./JsonEditPanel";

const manifest: PanelManifest<JsonEditParams> = {
  // identity
  id: "json-edit",
  title: "json-edit",
  component: JsonEditPanel,
  description:
    "CodeMirror 6 JSON editor. Publishes parsed JSON to the json-bus (default channel 'default'); JSON-visualizer panels subscribe to render.",

  toolbar: jsonEditToolbar,

  // pill ☰ menu; handled in JsonEditPanel via onPanelMenu
  menu: [
    { id: "new", label: "New document" },
    { id: "open", label: "Open file…", shortcut: "⌘O" },
    {
      id: "library",
      label: "Library",
      children: graphLibrary.map((e) => ({ id: `library:${e.id}`, label: e.title })),
    },
    { id: "save", label: "Download", shortcut: "⌘S" },
    { id: "saveAs", label: "Save As…", shortcut: "⌘⌥S" },
    { id: "copy", label: "Copy JSON" },
    { id: "format", label: "Format JSON" },
    { id: "rename", label: "Rename…" },
    { id: "delete", label: "Delete document" },
  ],

  // chrome
  accent: "#59b8ff",
  glyph: "{}",

  // Runs anywhere; file open/save is the one feature lost off-Tauri.
  capabilities: [],
  optionalCapabilities: ["fs"],

  // layout — json-edit is the DOCUMENT, not a grid pane: it lives in the left
  // edge group ("document-edge", persistence/document-edge.ts), which every
  // layout build/restore ensures. It has no `defaultLayout` on purpose.
  paramsDefault: jsonEditDefaults,

  npmDependencies: {
    "codemirror": "^6.0.0",
    "@codemirror/lang-json": "^6.0.0",
  },
};

export default manifest;
