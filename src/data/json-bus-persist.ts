// Keeps json-bus documents across reloads, in IndexedDB.
//
// IndexedDB rather than the Tauri store or localStorage: it exists in both
// the Tauri webview and a plain browser, and it has no practical size limit
// (a whole-play extraction is hundreds of KB). Storage is per origin, so the
// desktop app and a browser tab on another machine each keep their own
// library.
//
// Best-effort by design: if IndexedDB is unavailable (private window,
// blocked storage), the bus still works in memory and the status says so.

import {
  hydrateJson,
  onJsonStore,
  type DocMeta,
  type JsonValue,
} from "./json-bus";

const DB_NAME = "exoskeleton";
const STORE = "json-docs";
const WRITE_DEBOUNCE_MS = 800;

interface Row {
  id: string;
  value: JsonValue;
  meta: DocMeta;
}

export type PersistStatus = "starting" | "ready" | "unavailable";

let status: PersistStatus = "starting";
let started = false;

export function getPersistStatus(): PersistStatus {
  return status;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Load stored documents onto the bus, then mirror every change back. */
export async function startJsonBusPersistence(): Promise<void> {
  if (started) return;
  started = true;

  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch (err) {
    status = "unavailable";
    console.warn("[json-bus-persist] IndexedDB unavailable; documents will not survive a reload:", err);
    return;
  }

  // Mirror writes. Debounced per id: json-edit publishes on every pause in
  // typing, and a large document should not be re-serialized each time.
  const pending = new Map<string, { row: Row; timer: number }>();
  const flush = async (id: string) => {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(entry.row);
      await done(tx);
    } catch (err) {
      console.warn(`[json-bus-persist] could not store "${id}":`, err);
    }
  };

  onJsonStore((e) => {
    if (e.type === "set") {
      const prev = pending.get(e.id);
      if (prev) window.clearTimeout(prev.timer);
      const timer = window.setTimeout(() => void flush(e.id), WRITE_DEBOUNCE_MS);
      pending.set(e.id, { row: { id: e.id, value: e.value, meta: e.meta }, timer });
      return;
    }
    const prev = pending.get(e.id);
    if (prev) window.clearTimeout(prev.timer);
    pending.delete(e.id);
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(e.id);
      void done(tx).catch((err) =>
        console.warn(`[json-bus-persist] could not delete "${e.id}":`, err),
      );
    } catch (err) {
      console.warn(`[json-bus-persist] could not delete "${e.id}":`, err);
    }
  });

  window.addEventListener("pagehide", () => {
    for (const id of [...pending.keys()]) void flush(id);
  });

  try {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    const rows = await new Promise<Row[]>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as Row[]);
      req.onerror = () => reject(req.error);
    });
    hydrateJson(rows);
    status = "ready";
  } catch (err) {
    status = "unavailable";
    console.warn("[json-bus-persist] could not load stored documents:", err);
  }
}
