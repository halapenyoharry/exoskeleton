// Node selection, on OSC.
//
// Address:  /json/{documentId}/select   [nodeId: string|nil, sourcePanelId: string, label: string?]
// Retained: yes — StatusBarPanel needs the current value on mount, and a
//           graph panel opened after a hover should not show nothing.
//
// The signatures here are identical to the ones this replaced in
// src/data/json-bus.ts. That is deliberate: panels keep typed values and
// change only their import line, and the positional-arg layout is confined
// to ./codecs.ts where tests can assert it.

import { sendOsc, subscribeOsc } from "../index.ts";
import type { OscArg } from "../types.ts";
import { getLast, getMostRecent } from "../retainer.ts";
import { isEcho, registerLocalSource } from "../local-sources.ts";
import {
  ADDR,
  decodeSelection,
  encodeSelection,
  type SelectionEvent,
} from "./codecs.ts";

export type { SelectionEvent };

export function broadcastNodeSelection(
  documentId: string,
  nodeId: string | null,
  sourcePanelId: string,
  label?: string,
): void {
  registerLocalSource(sourcePanelId);
  void sendOsc(ADDR.select(documentId), encodeSelection(nodeId, sourcePanelId, label));
}

export function onNodeSelectionBroadcast(
  handler: (event: SelectionEvent) => void,
): () => void {
  return subscribeOsc(ADDR.selectAny, (address, args) => {
    const event = decodeSelection(address, args);
    if (event === null) return; // malformed, likely off the wire
    if (isEcho(event.sourcePanelId)) return; // our own message, looped back
    handler(event);
  });
}

/**
 * Current selection.
 *
 * With a documentId, the retained selection for that document. Without one,
 * the most recent selection in any document — which is what the status bar
 * wants, and what the module-level `currentSelectedNode` this replaced did.
 *
 * Answered from the retainer, which updates inside dispatch before any
 * subscriber runs, so a handler calling this always sees the value that
 * triggered it.
 */
export function getSelectedNode(documentId?: string): {
  nodeId: string | null;
  label?: string;
} {
  let address: string;
  let args: OscArg[] | undefined;
  if (documentId === undefined) {
    const hit = getMostRecent(ADDR.selectAny);
    if (hit === undefined) return { nodeId: null };
    [address, args] = hit;
  } else {
    address = ADDR.select(documentId);
    args = getLast(address);
  }
  if (args === undefined) return { nodeId: null };
  const event = decodeSelection(address, args);
  if (event === null) return { nodeId: null };
  return event.label === undefined
    ? { nodeId: event.nodeId }
    : { nodeId: event.nodeId, label: event.label };
}
