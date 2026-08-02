// End-to-end wiring test for the coordination channels.
//
// The other suites test pieces in isolation — pattern matching, the retainer,
// the codecs, the echo guard. This one tests the composition, which is where
// the two constraints from issue #4 actually live: the retainer updating
// before subscribers run, and retention being registered at module init
// rather than by a consumer.
//
// It imports the real facades, which pull in src/osc/index.ts and therefore
// @tauri-apps. That is fine outside Tauri: listen() rejects and is caught,
// the store read fails and leaves bridgeEnabled false, and sendOsc's local
// dispatch — the path under test — runs unconditionally.

import { test } from "node:test";
import assert from "node:assert";

import {
  broadcastNodeSelection,
  onNodeSelectionBroadcast,
  getSelectedNode,
  broadcastNodeFocus,
  onNodeFocusBroadcast,
  getActiveDocumentId,
  setActiveDocumentId,
  onActiveDocumentIdChange,
  areGraphsConnected,
  setGraphsConnected,
  onGraphsConnectionChange,
  ADDR,
} from "./index.ts";
import { sendOsc } from "../index.ts";
import { clearRetained } from "../retainer.ts";
import {
  beginBridgeDispatch,
  endBridgeDispatch,
  resetLocalSources,
} from "../local-sources.ts";
import type { OscArg } from "../types.ts";

/** sendOsc without its promise, for readability in synchronous assertions. */
function sendOscForTest(address: string, args: OscArg[]): void {
  void sendOsc(address, args);
}

function reset() {
  clearRetained();
  resetLocalSources();
}

// --- Selection ------------------------------------------------------------

test("selection reaches a subscriber with its fields intact", () => {
  reset();
  const seen: unknown[] = [];
  const off = onNodeSelectionBroadcast((e) => seen.push(e));
  broadcastNodeSelection("default", "node-1", "panel-a", "Root");
  off();
  assert.deepStrictEqual(seen, [
    { documentId: "default", nodeId: "node-1", sourcePanelId: "panel-a", label: "Root" },
  ]);
});

test("a subscriber added after the broadcast reads it from the retainer", () => {
  reset();
  broadcastNodeSelection("default", "node-1", "panel-a", "Root");
  // This is the whole reason retention exists: StatusBarPanel mounting after
  // a hover must not render blank.
  assert.deepStrictEqual(getSelectedNode(), { nodeId: "node-1", label: "Root" });
  assert.deepStrictEqual(getSelectedNode("default"), { nodeId: "node-1", label: "Root" });
});

test("selection is retained per document, and getSelectedNode() is the latest", () => {
  reset();
  broadcastNodeSelection("doc-a", "node-a", "panel-a");
  broadcastNodeSelection("doc-b", "node-b", "panel-b");
  assert.strictEqual(getSelectedNode("doc-a").nodeId, "node-a");
  assert.strictEqual(getSelectedNode("doc-b").nodeId, "node-b");
  assert.strictEqual(getSelectedNode().nodeId, "node-b");
});

test("a handler reading getSelectedNode() sees the value that triggered it", () => {
  reset();
  // Constraint 1 from issue #4. If the retainer were an ordinary subscriber,
  // dispatch order would decide whether this reads new or previous.
  broadcastNodeSelection("default", "old", "panel-a");
  let observed: string | null = "unset";
  const off = onNodeSelectionBroadcast(() => {
    observed = getSelectedNode().nodeId;
  });
  broadcastNodeSelection("default", "new", "panel-a");
  off();
  assert.strictEqual(observed, "new");
});

test("mouseout clears the retained selection", () => {
  reset();
  broadcastNodeSelection("default", "node-1", "panel-a", "Root");
  broadcastNodeSelection("default", null, "panel-a");
  assert.deepStrictEqual(getSelectedNode(), { nodeId: null });
});

test("with nothing retained, selection reads as empty rather than throwing", () => {
  reset();
  assert.deepStrictEqual(getSelectedNode(), { nodeId: null });
  assert.deepStrictEqual(getSelectedNode("never-used"), { nodeId: null });
});

test("selection in one document does not wake a subscriber filtering another", () => {
  reset();
  // Panels filter by documentId themselves, as they did before the move.
  const seen: string[] = [];
  const off = onNodeSelectionBroadcast((e) => {
    if (e.documentId === "doc-a") seen.push(e.nodeId ?? "null");
  });
  broadcastNodeSelection("doc-b", "node-b", "panel-b");
  broadcastNodeSelection("doc-a", "node-a", "panel-a");
  off();
  assert.deepStrictEqual(seen, ["node-a"]);
});

test("a document id containing a slash survives the round trip", () => {
  reset();
  const id = "/Users/harold/data.json";
  const seen: string[] = [];
  const off = onNodeSelectionBroadcast((e) => seen.push(e.documentId));
  broadcastNodeSelection(id, "node-1", "panel-a");
  off();
  assert.deepStrictEqual(seen, [id]);
  assert.strictEqual(getSelectedNode(id).nodeId, "node-1");
});

test("unsubscribing is synchronous — no handler fires after it returns", () => {
  reset();
  // The reason subscribeOsc exists. onOsc's promise deferred this by a
  // microtask, which let a handler fire once after unmount.
  let calls = 0;
  const off = onNodeSelectionBroadcast(() => calls++);
  off();
  broadcastNodeSelection("default", "node-1", "panel-a");
  assert.strictEqual(calls, 0);
});

// --- Focus ----------------------------------------------------------------

test("focus reaches a subscriber", () => {
  reset();
  const seen: unknown[] = [];
  const off = onNodeFocusBroadcast((e) => seen.push(e));
  broadcastNodeFocus("default", "node-7", "panel-a");
  off();
  assert.deepStrictEqual(seen, [
    { documentId: "default", nodeId: "node-7", sourcePanelId: "panel-a" },
  ]);
});

test("focus is NOT retained — a panel opened later does not fly its camera", () => {
  reset();
  broadcastNodeFocus("default", "node-7", "panel-a");
  const seen: unknown[] = [];
  const off = onNodeFocusBroadcast((e) => seen.push(e));
  off();
  assert.deepStrictEqual(seen, [], "a late subscriber must receive nothing");
});

test("focus does not leak into the selection channel", () => {
  reset();
  const seen: unknown[] = [];
  const off = onNodeSelectionBroadcast((e) => seen.push(e));
  broadcastNodeFocus("default", "node-7", "panel-a");
  off();
  assert.deepStrictEqual(seen, []);
});

// --- Active document ------------------------------------------------------

test("active document defaults, then round-trips", () => {
  reset();
  assert.strictEqual(getActiveDocumentId(), "default");
  const seen: string[] = [];
  const off = onActiveDocumentIdChange((id) => seen.push(id));
  setActiveDocumentId("doc-2");
  off();
  assert.strictEqual(getActiveDocumentId(), "doc-2");
  assert.deepStrictEqual(seen, ["doc-2"]);
});

test("setting the active document to its current value is a no-op", () => {
  reset();
  setActiveDocumentId("doc-2");
  let calls = 0;
  const off = onActiveDocumentIdChange(() => calls++);
  setActiveDocumentId("doc-2");
  off();
  // JsonEditPanel calls this on focus; without the guard every click into the
  // editor would churn every subscriber.
  assert.strictEqual(calls, 0);
});

// --- Graphs connected -----------------------------------------------------

test("graphs-connected defaults to true, then round-trips", () => {
  reset();
  assert.strictEqual(areGraphsConnected(), true);
  const seen: boolean[] = [];
  const off = onGraphsConnectionChange((c) => seen.push(c));
  setGraphsConnected(false);
  assert.strictEqual(areGraphsConnected(), false);
  setGraphsConnected(true);
  off();
  assert.deepStrictEqual(seen, [false, true]);
});

test("setting graphs-connected to its current value is a no-op", () => {
  reset();
  let calls = 0;
  const off = onGraphsConnectionChange(() => calls++);
  setGraphsConnected(true); // already the default
  off();
  assert.strictEqual(calls, 0);
});

// --- Bridge echo ----------------------------------------------------------
// The failure mode json-bus made unreachable and OSC does not: a loopback
// bridge config (send target == listen port, or a controller that mirrors
// what it receives) feeding our own messages back in. Simulated by dispatching
// while the inbound-from-bridge flag is set, which is exactly what the
// "osc://message" listener in src/osc/index.ts does.

test("our own selection coming back over the bridge is dropped", () => {
  reset();
  const seen: unknown[] = [];
  const off = onNodeSelectionBroadcast((e) => seen.push(e));
  broadcastNodeSelection("default", "node-1", "panel-a");
  assert.strictEqual(seen.length, 1, "the local dispatch is delivered");

  beginBridgeDispatch();
  broadcastNodeSelection("default", "node-1", "panel-a");
  endBridgeDispatch();
  off();
  assert.strictEqual(seen.length, 1, "the echo is not delivered a second time");
});

test("our own focus coming back over the bridge is dropped", () => {
  reset();
  const seen: unknown[] = [];
  const off = onNodeFocusBroadcast((e) => seen.push(e));
  broadcastNodeFocus("default", "node-1", "panel-a");
  beginBridgeDispatch();
  broadcastNodeFocus("default", "node-1", "panel-a");
  endBridgeDispatch();
  off();
  assert.strictEqual(seen.length, 1);
});

test("an external controller's message is delivered, not mistaken for an echo", () => {
  reset();
  // A panel has broadcast before, so its id is known to be local.
  broadcastNodeSelection("default", "node-1", "panel-a");
  const seen: string[] = [];
  const off = onNodeSelectionBroadcast((e) => seen.push(e.sourcePanelId));
  // Inbound from the network, carrying no sourcePanelId — a TouchOSC layout
  // driving selection. Must reach every panel.
  beginBridgeDispatch();
  sendOscForTest(ADDR.select("default"), [{ type: "string", value: "node-9" }]);
  endBridgeDispatch();
  off();
  assert.deepStrictEqual(seen, ["external"]);
});

test("an inbound external selection updates what a late panel reads", () => {
  reset();
  beginBridgeDispatch();
  sendOscForTest(ADDR.select("default"), [{ type: "string", value: "node-9" }]);
  endBridgeDispatch();
  // Retention happens inside dispatch, so bridge traffic feeds it too.
  assert.strictEqual(getSelectedNode().nodeId, "node-9");
});

// --- Cross-channel isolation ----------------------------------------------

test("the four channels do not cross-talk", () => {
  reset();
  const hits = { selection: 0, focus: 0, active: 0, connected: 0 };
  const offs = [
    onNodeSelectionBroadcast(() => hits.selection++),
    onNodeFocusBroadcast(() => hits.focus++),
    onActiveDocumentIdChange(() => hits.active++),
    onGraphsConnectionChange(() => hits.connected++),
  ];
  broadcastNodeSelection("default", "n", "p");
  broadcastNodeFocus("default", "n", "p");
  setActiveDocumentId("other-doc");
  setGraphsConnected(false);
  offs.forEach((off) => off());
  assert.deepStrictEqual(hits, { selection: 1, focus: 1, active: 1, connected: 1 });
});
