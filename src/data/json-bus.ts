// Exoskeleton's json-bus: in-process snapshot state for cross-panel JSON
// documents. One job — holding the document.
//
// This module used to also carry selection, focus, the active-document id and
// the graphs-connected flag. Those were event-shaped and all four fit in OSC
// args, so they moved to src/osc/channels/ (issue #4). The document is the one
// payload that stayed, and the rule says why:
//
//   If it fits in an OSC arg and is cheap to send, send it as OSC.
//   If something needs to know the last value, retain the address.
//
// A parsed document fits only as {type:"string", value: JSON.stringify(doc)},
// which is not cheap — it reintroduces serialization on every keystroke, the
// exact cost in-process dispatch avoids by passing an object reference. So it
// keeps its own holder here. Widening OscArg with an object case was the other
// option and is worse: it stops being OSC, and that arg would silently fail to
// cross the UDP bridge.
//
// A viewer panel that mounts AFTER the editor has set a value should see that
// value on its first render via getJson(id), then react to subsequent edits
// via onJsonChange(id, handler). That two-step matches the React useState +
// useEffect idiom.
//
// Documents are keyed by id so multiple JSON documents can coexist
// (e.g. editor A → viewers A; editor B → viewers B). The bus doubles as the
// in-app document library: each id carries a title and timestamps, panels
// can list, retitle, and delete documents, and json-bus-persist.ts keeps
// them across reloads.
//
// Scope: in-process only. Same React tree, same JS heap. If a panel opens
// in a separate Tauri WebviewWindow (popout group via addPopoutGroup), this
// bus does not reach it, and — unlike the channels that moved to OSC — it
// has no path to ever reaching it. See docs/AGENTS-FAQ.md.

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type Handler = (value: JsonValue) => void;

interface Subscription {
  id: string;
  handler: Handler;
}

/**
 * What the bus knows about a document besides its value. The bus is also
 * the in-app document library: every id is a named document that panels can
 * list, switch between, rename, and delete.
 */
export interface DocMeta {
  /** Human name shown in pickers. Defaults to the id. */
  title: string;
  /** Who produced it, e.g. "topology-extract" or "file: notes.json". */
  source?: string;
  /** Disk path it was opened from or saved to (desktop app only). */
  path?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocEntry {
  id: string;
  meta: DocMeta;
}

/** Storage-facing change feed (see json-bus-persist.ts). */
export type StoreEvent =
  | { type: "set"; id: string; value: JsonValue; meta: DocMeta }
  | { type: "delete"; id: string };

const values = new Map<string, JsonValue>();
const metas = new Map<string, DocMeta>();
const subscriptions: Set<Subscription> = new Set();
const listListeners: Set<() => void> = new Set();
const storeListeners: Set<(e: StoreEvent) => void> = new Set();

export function getJson(id: string): JsonValue | undefined {
  return values.get(id);
}

export function setJson(
  id: string,
  value: JsonValue,
  meta?: { title?: string; source?: string; path?: string },
): void {
  const now = new Date().toISOString();
  const prev = metas.get(id);
  const next: DocMeta = {
    title: meta?.title ?? prev?.title ?? id,
    source: meta?.source ?? prev?.source,
    path: meta?.path ?? prev?.path,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  const listChanged =
    !prev || prev.title !== next.title || prev.source !== next.source;
  values.set(id, value);
  metas.set(id, next);
  dispatch(id, value);
  emitStore({ type: "set", id, value, meta: next });
  if (listChanged) emitList();
}

export function onJsonChange(id: string, handler: Handler): () => void {
  const sub: Subscription = { id, handler };
  subscriptions.add(sub);
  return () => {
    subscriptions.delete(sub);
  };
}

// ── Document library ────────────────────────────────────────────────

export function getJsonMeta(id: string): DocMeta | undefined {
  return metas.get(id);
}

/** Every document on the bus, most recently updated first. */
export function listJson(): DocEntry[] {
  return [...metas.entries()]
    .map(([id, meta]) => ({ id, meta }))
    .sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt));
}

/** Update a document's title or path. The id stays stable for subscribers. */
export function updateJsonMeta(
  id: string,
  patch: { title?: string; path?: string },
): void {
  const prev = metas.get(id);
  const value = values.get(id);
  if (!prev || value === undefined) return;
  const next = { ...prev, ...patch };
  metas.set(id, next);
  emitStore({ type: "set", id, value, meta: next });
  emitList();
}

export function deleteJson(id: string): boolean {
  const existed = values.delete(id);
  metas.delete(id);
  if (existed) {
    emitStore({ type: "delete", id });
    emitList();
  }
  return existed;
}

/** Fires when documents are added, removed, or retitled. */
export function onJsonListChange(listener: () => void): () => void {
  listListeners.add(listener);
  return () => {
    listListeners.delete(listener);
  };
}

/** An id derived from `base` that no document uses yet. */
export function uniqueJsonId(base: string): string {
  const stem =
    base
      .toLowerCase()
      .replace(/\.json$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "doc";
  if (!values.has(stem)) return stem;
  for (let k = 2; ; k++) {
    const id = `${stem}-${k}`;
    if (!values.has(id)) return id;
  }
}

// ── Storage hooks ───────────────────────────────────────────────────

/** Subscribe to every write and delete, for persistence. */
export function onJsonStore(listener: (e: StoreEvent) => void): () => void {
  storeListeners.add(listener);
  return () => {
    storeListeners.delete(listener);
  };
}

/**
 * Load documents from storage. Documents already on the bus win (a panel
 * may have published before storage finished loading). Does not echo back
 * to storage.
 */
export function hydrateJson(
  entries: { id: string; value: JsonValue; meta: DocMeta }[],
): void {
  let added = false;
  for (const e of entries) {
    if (values.has(e.id)) continue;
    values.set(e.id, e.value);
    metas.set(e.id, e.meta);
    dispatch(e.id, e.value);
    added = true;
  }
  if (added) emitList();
}

function dispatch(id: string, value: JsonValue): void {
  // Snapshot — handlers may unsubscribe mid-dispatch.
  for (const sub of [...subscriptions]) {
    if (sub.id === id) {
      try {
        sub.handler(value);
      } catch (e) {
        console.error("[json-bus] subscriber threw:", e);
      }
    }
  }
}

function emitList(): void {
  for (const l of [...listListeners]) {
    try {
      l();
    } catch (e) {
      console.error("[json-bus] list listener threw:", e);
    }
  }
}

function emitStore(e: StoreEvent): void {
  for (const l of [...storeListeners]) {
    try {
      l(e);
    } catch (err) {
      console.error("[json-bus] store listener threw:", err);
    }
  }
}
