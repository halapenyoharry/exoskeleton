import { test } from "node:test";
import assert from "node:assert";
import {
  ADDR,
  encodeDocSegment,
  decodeDocSegment,
  documentIdFromAddress,
  encodeSelection,
  decodeSelection,
  encodeFocus,
  decodeFocus,
  encodeActiveDoc,
  decodeActiveDoc,
  encodeGraphsConnected,
  decodeGraphsConnected,
} from "./codecs.ts";
import { oscPatternToRegExp } from "../pattern.ts";
import type { OscArg } from "../types.ts";

// --- Address construction -------------------------------------------------

test("a plain document id passes through unchanged", () => {
  assert.strictEqual(ADDR.select("default"), "/json/default/select");
  assert.strictEqual(ADDR.focus("default"), "/json/default/focus");
});

test("a document id containing / cannot invent an address segment", () => {
  const address = ADDR.select("/Users/harold/data.json");
  assert.ok(!address.slice("/json/".length, -"/select".length).includes("/"));
  assert.ok(oscPatternToRegExp(ADDR.selectAny).test(address));
  assert.strictEqual(documentIdFromAddress(address), "/Users/harold/data.json");
});

test("OSC-reserved characters in a document id are escaped and survive a round trip", () => {
  for (const id of ["a b", "a#b", "a*b", "a,b", "a?b", "a[b]", "a{b}", "a/b"]) {
    const segment = encodeDocSegment(id);
    assert.ok(
      !/[ #*,/?[\]{}]/.test(segment),
      `segment for ${JSON.stringify(id)} still holds a reserved char: ${segment}`,
    );
    assert.strictEqual(decodeDocSegment(segment), id);
    assert.ok(oscPatternToRegExp(ADDR.selectAny).test(ADDR.select(id)));
  }
});

test("documentIdFromAddress rejects shapes that are not this channel", () => {
  assert.strictEqual(documentIdFromAddress("/json/a/b/select"), null);
  assert.strictEqual(documentIdFromAddress("/json/active"), null);
  assert.strictEqual(documentIdFromAddress("/other/a/select"), null);
});

test("a malformed percent-escape decodes verbatim rather than throwing", () => {
  assert.strictEqual(decodeDocSegment("%zz"), "%zz");
});

// --- Selection ------------------------------------------------------------

test("selection round-trips with a label", () => {
  const address = ADDR.select("default");
  const event = decodeSelection(address, encodeSelection("node-1", "panel-a", "Root"));
  assert.deepStrictEqual(event, {
    documentId: "default",
    nodeId: "node-1",
    sourcePanelId: "panel-a",
    label: "Root",
  });
});

test("selection round-trips without a label", () => {
  const address = ADDR.select("default");
  const args = encodeSelection("node-1", "panel-a");
  assert.strictEqual(args.length, 2, "the optional arg is last, so it is simply absent");
  const event = decodeSelection(address, args);
  assert.deepStrictEqual(event, {
    documentId: "default",
    nodeId: "node-1",
    sourcePanelId: "panel-a",
  });
});

test("a null nodeId (mouseout) round-trips as nil", () => {
  const args = encodeSelection(null, "panel-a");
  assert.deepStrictEqual(args[0], { type: "nil", value: null });
  const event = decodeSelection(ADDR.select("default"), args);
  assert.strictEqual(event?.nodeId, null);
});

test("an external sender may use an empty string for no-node", () => {
  const args: OscArg[] = [
    { type: "string", value: "" },
    { type: "string", value: "touchosc" },
  ];
  const event = decodeSelection(ADDR.select("default"), args);
  assert.strictEqual(event?.nodeId, null);
  assert.strictEqual(event?.sourcePanelId, "touchosc");
});

test("a missing sourcePanelId decodes as external, so every panel reacts", () => {
  const args: OscArg[] = [{ type: "string", value: "node-1" }];
  const event = decodeSelection(ADDR.select("default"), args);
  assert.strictEqual(event?.sourcePanelId, "external");
});

test("selection on a foreign address decodes to null", () => {
  assert.strictEqual(decodeSelection("/nope", encodeSelection("n", "p")), null);
});

test("selection tolerates junk arg types off the wire", () => {
  const args: OscArg[] = [{ type: "float", value: 1.5 }, { type: "int", value: 7 }];
  const event = decodeSelection(ADDR.select("default"), args);
  assert.deepStrictEqual(event, {
    documentId: "default",
    nodeId: null,
    sourcePanelId: "external",
  });
});

// --- Focus ----------------------------------------------------------------

test("focus round-trips", () => {
  const event = decodeFocus(ADDR.focus("doc-2"), encodeFocus("node-9", "panel-b"));
  assert.deepStrictEqual(event, {
    documentId: "doc-2",
    nodeId: "node-9",
    sourcePanelId: "panel-b",
  });
});

test("focus without a node id is not a message", () => {
  assert.strictEqual(decodeFocus(ADDR.focus("d"), []), null);
  assert.strictEqual(
    decodeFocus(ADDR.focus("d"), [{ type: "nil", value: null }]),
    null,
  );
});

// --- Active document ------------------------------------------------------

test("active document round-trips", () => {
  assert.strictEqual(decodeActiveDoc(encodeActiveDoc("doc-3")), "doc-3");
});

test("active document rejects a non-string", () => {
  assert.strictEqual(decodeActiveDoc([{ type: "int", value: 1 }]), null);
  assert.strictEqual(decodeActiveDoc([]), null);
});

// --- Graphs connected -----------------------------------------------------

test("graphs-connected round-trips both ways", () => {
  assert.strictEqual(decodeGraphsConnected(encodeGraphsConnected(true)), true);
  assert.strictEqual(decodeGraphsConnected(encodeGraphsConnected(false)), false);
});

test("graphs-connected accepts the 0/1 a hardware toggle sends", () => {
  assert.strictEqual(decodeGraphsConnected([{ type: "int", value: 1 }]), true);
  assert.strictEqual(decodeGraphsConnected([{ type: "int", value: 0 }]), false);
  assert.strictEqual(decodeGraphsConnected([{ type: "float", value: 1 }]), true);
  assert.strictEqual(decodeGraphsConnected([{ type: "float", value: 0 }]), false);
});

test("graphs-connected rejects what it cannot read", () => {
  assert.strictEqual(decodeGraphsConnected([]), null);
  assert.strictEqual(decodeGraphsConnected([{ type: "string", value: "yes" }]), null);
});
