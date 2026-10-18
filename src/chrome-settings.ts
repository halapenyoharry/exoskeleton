/**
 * Small persisted UI preferences, stored in localStorage (works in the Tauri
 * webview and the browser build). Today only the phone "one pane at a time"
 * opt-in lives here; the key name is kept so existing saved values survive.
 */
const KEY = "exo.chrome.settings";

/** Phone "one pane at a time": opt-in, default off (phones show the grid). */
export function loadDeckOptIn(): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as { deckOptIn?: unknown }).deckOptIn === true;
  } catch {
    return false;
  }
}

export function saveDeckOptIn(on: boolean): void {
  try {
    const prev = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(KEY, JSON.stringify({ ...prev, deckOptIn: on }));
  } catch {
    /* storage unavailable: applies for this session only */
  }
}
