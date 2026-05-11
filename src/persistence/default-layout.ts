import type { DockviewApi } from "dockview";

// The default panel arrangement — what Exoskeleton looks like on first launch,
// or after the user resets/clears their saved state.
//
// This is the SCHEMA's idea of "what panels exist and how they're arranged."
// State (the JSON saved between sessions) is a delta on top of this.

export const DEFAULT_WEBVIEW_URL = "https://dockview.dev";

export function buildDefaultLayout(api: DockviewApi) {
  api.addPanel({
    id: "editor",
    component: "editor",
    title: "editor",
  });

  api.addPanel({
    id: "webview",
    component: "webview",
    title: "webview",
    params: { url: DEFAULT_WEBVIEW_URL },
    position: { referencePanel: "editor", direction: "right" },
  });

  api.addPanel({
    id: "terminal",
    component: "terminal",
    title: "terminal",
    position: { referencePanel: "editor", direction: "below" },
  });
}
