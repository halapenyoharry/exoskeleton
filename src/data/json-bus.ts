// Exoskeleton's json-bus: in-process snapshot state for cross-panel JSON
// documents. The shape mirrors src/osc/index.ts (subscription set, snapshot
// iteration to allow mid-dispatch unsubscribe) but the semantics are
// different: this is current-value-with-subscription, not an event stream.
//
// OSC is for ephemeral events (clock ticks, MIDI notes) — fire-and-forget,
// late subscribers miss prior events. json-bus is for documents — a viewer
// panel that mounts AFTER the editor has set a value should see that value
// on its first render via getJson(id), then react to subsequent edits via
// onJsonChange(id, handler). That two-step matches the React useState +
// useEffect idiom.
//
// Documents are keyed by id so multiple JSON documents can coexist
// (e.g. editor A → viewers A; editor B → viewers B). Pick an id convention
// that fits your panel pair — "default" is fine for a single-document app.
//
// Scope: in-process only. Same React tree, same JS heap. If a panel opens
// in a separate Tauri WebviewWindow (popout group via addPopoutGroup), this
// bus does not reach it — Tauri events become the right answer for that
// case. See docs/AGENTS-FAQ.md for the full reasoning.

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

const values = new Map<string, JsonValue>();
const subscriptions: Set<Subscription> = new Set();

export function getJson(id: string): JsonValue | undefined {
  return values.get(id);
}

export function setJson(id: string, value: JsonValue): void {
  values.set(id, value);
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

export function onJsonChange(id: string, handler: Handler): () => void {
  const sub: Subscription = { id, handler };
  subscriptions.add(sub);
  return () => {
    subscriptions.delete(sub);
  };
}

// --- Active Document Coordination ---
let activeDocumentId = "default";
const activeDocListeners = new Set<(id: string) => void>();

export function getActiveDocumentId(): string {
  return activeDocumentId;
}

export function setActiveDocumentId(id: string): void {
  if (activeDocumentId === id) return;
  activeDocumentId = id;
  for (const listener of activeDocListeners) {
    try {
      listener(id);
    } catch (e) {
      console.error("[json-bus] active document listener threw:", e);
    }
  }
}

export function onActiveDocumentIdChange(listener: (id: string) => void): () => void {
  activeDocListeners.add(listener);
  return () => {
    activeDocListeners.delete(listener);
  };
}

// --- Connection / Decouple Coordination ---
let graphsConnected = true; // Default to connected
const connectionListeners = new Set<(connected: boolean) => void>();

export function areGraphsConnected(): boolean {
  return graphsConnected;
}

export function setGraphsConnected(connected: boolean): void {
  if (graphsConnected === connected) return;
  graphsConnected = connected;
  for (const listener of connectionListeners) {
    try {
      listener(connected);
    } catch (e) {
      console.error("[json-bus] connection listener threw:", e);
    }
  }
}

export function onGraphsConnectionChange(listener: (connected: boolean) => void): () => void {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

// --- Selection Synchronization ---
export interface SelectionEvent {
  documentId: string;
  nodeId: string | null;
  sourcePanelId: string;
  label?: string;
}
type SelectionHandler = (event: SelectionEvent) => void;
const selectionListeners = new Set<SelectionHandler>();
let currentSelectedNode: { nodeId: string | null; label?: string } = { nodeId: null };

export function getSelectedNode() {
  return currentSelectedNode;
}

export function broadcastNodeSelection(documentId: string, nodeId: string | null, sourcePanelId: string, label?: string): void {
  currentSelectedNode = { nodeId, label };
  const event: SelectionEvent = { documentId, nodeId, sourcePanelId, label };
  for (const listener of selectionListeners) {
    try {
      listener(event);
    } catch (e) {
      console.error("[json-bus] selection listener threw:", e);
    }
  }
}

export function onNodeSelectionBroadcast(handler: SelectionHandler): () => void {
  selectionListeners.add(handler);
  return () => {
    selectionListeners.delete(handler);
  };
}

// --- Focus / Zoom Synchronization ---
export interface FocusEvent {
  documentId: string;
  nodeId: string;
  sourcePanelId: string;
}
type FocusHandler = (event: FocusEvent) => void;
const focusListeners = new Set<FocusHandler>();

export function broadcastNodeFocus(documentId: string, nodeId: string, sourcePanelId: string): void {
  const event: FocusEvent = { documentId, nodeId, sourcePanelId };
  for (const listener of focusListeners) {
    try {
      listener(event);
    } catch (e) {
      console.error("[json-bus] focus listener threw:", e);
    }
  }
}

export function onNodeFocusBroadcast(handler: FocusHandler): () => void {
  focusListeners.add(handler);
  return () => {
    focusListeners.delete(handler);
  };
}

