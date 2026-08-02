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
// (e.g. editor A → viewers A; editor B → viewers B). Pick an id convention
// that fits your panel pair — "default" is fine for a single-document app.
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
