// Panes for json-mass. Its only toolbar control was the reset button.
import type { PanelPane } from "../../panel-manifest.ts";
import { registerPanes } from "../panes-registry.ts";

export const jsonMassStrip: PanelPane[] = [
  { id: "reset", kind: "action", icon: "⤢", label: "reset", tooltip: "Reset view" },
];

registerPanes("json-mass", jsonMassStrip);
