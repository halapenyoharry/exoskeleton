// Registers the header actions declared by manifests. Imported once by PanelRoot.
// Declared here (not imported from the manifests) so this module stays free of
// React component imports; the manifests reference the same arrays.
import { registerHeaderActions } from "../header-actions-registry.ts";
import { editorHeaderActions } from "./editor.header-actions.ts";
import { jsonEditHeaderActions } from "./json-edit.header-actions.ts";

registerHeaderActions("editor", editorHeaderActions);
registerHeaderActions("json-edit", jsonEditHeaderActions);
