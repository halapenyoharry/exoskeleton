/**
 * Global pane-chrome settings (scrim under the pill row). Stored in
 * localStorage (works in the Tauri webview and the browser build) and
 * published as CSS variables that `.app-frame` and everything under it
 * inherit: --exo-scrim-darken (0-1) and --exo-scrim-blur (px).
 */
export interface ChromeSettings {
  scrimDarken: number;
  scrimBlur: number;
}

export const CHROME_DEFAULTS: ChromeSettings = { scrimDarken: 0.35, scrimBlur: 6 };
const KEY = "exo.chrome.settings";

export function loadChromeSettings(): ChromeSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<ChromeSettings>;
    const d = Number(raw.scrimDarken);
    const b = Number(raw.scrimBlur);
    return {
      scrimDarken: Number.isFinite(d) && raw.scrimDarken !== undefined ? Math.min(1, Math.max(0, d)) : CHROME_DEFAULTS.scrimDarken,
      scrimBlur: Number.isFinite(b) && raw.scrimBlur !== undefined ? Math.min(40, Math.max(0, b)) : CHROME_DEFAULTS.scrimBlur,
    };
  } catch {
    return { ...CHROME_DEFAULTS };
  }
}

export function applyChromeSettings(s: ChromeSettings = loadChromeSettings()): void {
  const root = document.documentElement;
  root.style.setProperty("--exo-scrim-darken", String(s.scrimDarken));
  root.style.setProperty("--exo-scrim-blur", `${s.scrimBlur}px`);
}

export function saveChromeSettings(s: ChromeSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: still apply for this session */
  }
  applyChromeSettings(s);
}

applyChromeSettings();
