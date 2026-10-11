// Drawer strip for json-mass. Its only toolbar control was the reset button.
import type { PaneStripItem } from "../../panel-manifest.ts";
import { registerStrip } from "../strip-registry.ts";

export const jsonMassStrip: PaneStripItem[] = [
  { id: "reset", kind: "button", icon: "⤢", label: "reset", tooltip: "Reset view" },
];

registerStrip("json-mass", jsonMassStrip);
