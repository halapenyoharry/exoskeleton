import { test } from "node:test";
import assert from "node:assert";
import {
  registerLocalSource,
  isLocalSource,
  beginBridgeDispatch,
  endBridgeDispatch,
  isBridgeDispatch,
  isEcho,
  resetLocalSources,
} from "./local-sources.ts";

test("a local in-process message is never an echo", () => {
  resetLocalSources();
  registerLocalSource("panel-a");
  // No bridge dispatch in progress: this is our own sendOsc dispatching
  // locally, which panels suppress by comparing sourcePanelId themselves.
  assert.strictEqual(isEcho("panel-a"), false);
});

test("our own message arriving back over the bridge is an echo", () => {
  resetLocalSources();
  registerLocalSource("panel-a");
  beginBridgeDispatch();
  assert.strictEqual(isEcho("panel-a"), true);
  endBridgeDispatch();
});

test("a genuine external controller is never suppressed", () => {
  resetLocalSources();
  registerLocalSource("panel-a");
  beginBridgeDispatch();
  assert.strictEqual(isEcho("touchosc"), false);
  assert.strictEqual(isEcho("external"), false);
  endBridgeDispatch();
});

test("the inbound flag is scoped to the dispatch", () => {
  resetLocalSources();
  registerLocalSource("panel-a");
  assert.strictEqual(isBridgeDispatch(), false);
  beginBridgeDispatch();
  assert.strictEqual(isBridgeDispatch(), true);
  endBridgeDispatch();
  assert.strictEqual(isBridgeDispatch(), false);
  assert.strictEqual(isEcho("panel-a"), false);
});

test("nesting balances, and an unmatched end cannot go negative", () => {
  resetLocalSources();
  beginBridgeDispatch();
  beginBridgeDispatch();
  endBridgeDispatch();
  assert.strictEqual(isBridgeDispatch(), true, "still inside the outer dispatch");
  endBridgeDispatch();
  assert.strictEqual(isBridgeDispatch(), false);
  endBridgeDispatch();
  assert.strictEqual(isBridgeDispatch(), false, "stray end must not underflow");
});

test("an unregistered id is not local", () => {
  resetLocalSources();
  assert.strictEqual(isLocalSource("panel-a"), false);
  registerLocalSource("panel-a");
  assert.strictEqual(isLocalSource("panel-a"), true);
});
