import { LazyStore } from "@tauri-apps/plugin-store";
import type { Storage, AppState } from "./storage";
import { isCompatible } from "./storage";

// Backed by tauri-plugin-store, which writes JSON into the OS's per-user
// app data dir (macOS: ~/Library/Application Support/dev.harold.exoskeleton/).
// Atomic writes are handled by the plugin; we just call set() and save().

const STORE_FILE = "exoskeleton.json";
const STATE_KEY = "state";

const store = new LazyStore(STORE_FILE);

export const tauriStorage: Storage = {
  async load() {
    try {
      const raw = await store.get(STATE_KEY);
      if (!isCompatible(raw)) {
        if (raw !== undefined && raw !== null) {
          console.warn(
            "[exoskeleton] saved state has incompatible version, falling back to defaults",
            raw,
          );
        }
        return null;
      }
      return raw;
    } catch (e) {
      console.warn("[exoskeleton] failed to load state:", e);
      return null;
    }
  },
  async save(state: AppState) {
    try {
      await store.set(STATE_KEY, state);
      await store.save();
    } catch (e) {
      console.warn("[exoskeleton] failed to save state:", e);
    }
  },
  async clear() {
    try {
      await store.delete(STATE_KEY);
      await store.save();
    } catch (e) {
      console.warn("[exoskeleton] failed to clear state:", e);
    }
  },
};
