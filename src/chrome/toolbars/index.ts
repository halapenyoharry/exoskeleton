// Registers the slim toolbars declared by manifests. Imported once by PanelRoot.
// Declared here (not imported from the manifests) so this module stays free of
// React component imports; the manifests reference the same arrays.
import { registerToolbar } from "../toolbar-registry.ts";
import { editorToolbar } from "./editor.toolbar.ts";
import { jsonEditToolbar } from "./json-edit.toolbar.ts";

registerToolbar("editor", editorToolbar);
registerToolbar("json-edit", jsonEditToolbar);
