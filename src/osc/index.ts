import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { OscArg, OscEvent } from "./types.ts";
import { retainIfRegistered } from "./retainer.ts";
import { oscPatternToRegExp } from "./pattern.ts";
import { beginBridgeDispatch, endBridgeDispatch } from "./local-sources.ts";

// Exoskeleton's OSC is self-contained by default — see
// docs/research/osc-self-contained-by-default.md.
//
// Panels call sendOsc / onOsc on this module. The default backend is an
// in-process pub/sub bus: sendOsc dispatches directly to any onOsc subscribers
// whose address pattern matches. No UDP socket is opened, no packets leave the
// app, no risk of colliding with whatever else the user has running.
//
// External integration (TouchOSC, Sonic Pi, SC, reachz, M4L, etc.) is opt-in
// via the "osc.bridge.enabled" flag in the Tauri store. When that's true at
// startup, the Rust-side UDP layer binds a port and mirrors traffic both ways
// between the bus and the network.

interface Subscription {
  pattern: RegExp;
  handler: (address: string, args: OscArg[]) => void;
}

const subscriptions: Set<Subscription> = new Set();

// Whether to also send messages out over UDP. Read once at module load from
// the Tauri store. Toggling at runtime requires a reload — see the white
// paper for the rationale (loud opt-in, sticky behaviour).
let bridgeEnabled = false;

(async () => {
  try {
    const store = new LazyStore("store.json");
    const v = await store.get<boolean>("osc.bridge.enabled");
    bridgeEnabled = v === true;
  } catch {
    // Not in a Tauri environment, or store unreachable. Stay in-process only.
  }
})();

function dispatchLocal(address: string, args: OscArg[]) {
  // The retainer is privileged: it updates BEFORE the subscriber loop, not as
  // an ordinary subscriber. If it registered via subscribeOsc, dispatch order
  // would decide whether a handler re-reading getLast() sees the new value or
  // the previous one. See docs/AGENTS-FAQ.md.
  retainIfRegistered(address, args);
  // Iterate a snapshot — handlers may unsubscribe mid-dispatch.
  for (const sub of [...subscriptions]) {
    if (sub.pattern.test(address)) {
      try {
        sub.handler(address, args);
      } catch (e) {
        console.error("[osc] subscriber threw:", e);
      }
    }
  }
}

// Always-on: relay inbound UDP packets (only emitted when bridge mode is
// active on the Rust side) into the in-process bus. If Rust never emits,
// this listener is dormant — no cost.
listen<OscEvent>("osc://message", (event) => {
  const { address, args } = event.payload;
  // Mark the dispatch as inbound so the coordination channels can drop our
  // own messages coming home through a loopback bridge config. See
  // src/osc/local-sources.ts.
  beginBridgeDispatch();
  try {
    dispatchLocal(address, args);
  } finally {
    endBridgeDispatch();
  }
}).catch(() => {
  // Running outside Tauri (vitest, storybook, etc.). Skip silently.
});

/**
 * Send an OSC message.
 *
 * Default: dispatches in-process to any panel that called onOsc with a
 * matching address pattern. No network traffic.
 *
 * If osc.bridge.enabled is true in the Tauri store at app launch, the same
 * message is ALSO sent out over UDP to the configured target. See
 * docs/research/osc-self-contained-by-default.md for the design decision.
 */
export async function sendOsc(address: string, args: OscArg[]): Promise<void> {
  dispatchLocal(address, args);
  if (bridgeEnabled) {
    try {
      await invoke("send_osc", { address, args });
    } catch (e) {
      console.warn("[osc] bridge send failed:", e);
    }
  }
}

/**
 * Subscribe to OSC messages whose address matches the given pattern.
 *
 * Pattern syntax (OSC convention):
 *   *  matches any sequence of characters within a single path segment
 *   ?  matches any single character within a single path segment
 *
 * Returns the unsubscribe function directly, so it drops straight into a
 * React effect:
 *
 *   useEffect(() => subscribeOsc("/json/*\/select", handler), []);
 *
 * Prefer this over onOsc(). Registration was always synchronous — onOsc's
 * Promise wrapper only ever deferred the *unsubscribe* by a microtask, which
 * let a handler fire once after unmount.
 */
export function subscribeOsc(
  pattern: string,
  handler: (address: string, args: OscArg[]) => void,
): () => void {
  const sub: Subscription = {
    pattern: oscPatternToRegExp(pattern),
    handler,
  };
  subscriptions.add(sub);
  return () => {
    subscriptions.delete(sub);
  };
}

/**
 * Back-compat wrapper around subscribeOsc.
 *
 * The async signature exists only to match Tauri's listen() return, so code
 * written as `unlistenP.then(fn => fn())` keeps working. There is nothing to
 * await — new code should call subscribeOsc directly.
 */
export async function onOsc(
  pattern: string,
  handler: (address: string, args: OscArg[]) => void,
): Promise<UnlistenFn> {
  return subscribeOsc(pattern, handler);
}

export * from "./types.ts";
export { retain, getLast, getLastMatching, getMostRecent, clearRetained } from "./retainer.ts";
