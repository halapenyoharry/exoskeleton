// Panes for text-viewer. Params from TextViewerPanel.tsx (TextViewerParams).

import type { PanelPane } from "../../panel-manifest.ts";
import { registerPanes } from "../panes-registry.ts";

export const textViewerPanes: PanelPane[] = [
  {
    id: "scroll",
    kind: "pane",
    icon: "⇅",
    label: "scroll",
    tooltip: "When the text scrolls to a node",
    body: {
      layout: "stack",
      cells: [
        {
          type: "toggle",
          param: "scrollOnHover",
          label: "scroll on hover",
          tooltip: "Scroll when the pointer moves over a node in a graph; turn off to scroll only on click or tap",
        },
      ],
    },
  },
];

registerPanes("text-viewer", textViewerPanes);
