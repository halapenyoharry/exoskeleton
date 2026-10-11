// Drawer strip for editor. Buttons emit "open" / "save"; EditorPanel subscribes.
import type { PaneStripItem } from "../../panel-manifest.ts";
import { registerStrip } from "../strip-registry.ts";

export const editorStrip: PaneStripItem[] = [
  { id: "open", kind: "button", icon: "📂", label: "open", tooltip: "Open a file" },
  { id: "save", kind: "button", icon: "💾", label: "save", tooltip: "Save the file" },
];

registerStrip("editor", editorStrip);
