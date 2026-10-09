import type { Storage } from "./storage";
import { tauriStorage } from "./tauri-storage";
import { webStorage } from "./web-storage";
import { inTauri } from "../utils/file-io";

/** App-state backend for this runtime: the Tauri store in the desktop app,
 *  localStorage in a browser tab. */
export const appStorage: Storage = inTauri() ? tauriStorage : webStorage;
