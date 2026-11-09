// Header actions for json-cosmos. Handled via onPanelMenu in JsonCosmosPanel.tsx.

import type { PanelPane } from "../../panel-manifest.ts";
import { registerPanes } from "../panes-registry.ts";

export const jsonCosmosStrip: PanelPane[] = [
  { id: "fit", kind: "action", icon: "⤢", label: "fit", tooltip: "Fit graph to view" },
  { id: "pause", kind: "action", icon: "⏯", label: "pause", tooltip: "Pause or resume the layout" },
];

registerPanes("json-cosmos", jsonCosmosStrip);
