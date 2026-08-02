// Which JSON document is active, on OSC.
//
// Address:  /json/active   [documentId: string]
// Retained: yes — a panel mounting later must know which document is current.
//
// Note this address carries the document *id*, not the document. The id is a
// string and cheap; the document is neither, and stays in
// src/data/json-bus.ts. That split is the whole rule in one channel.
//
// Externally settable, deliberately but with a caveat: an outside sender can
// point every panel at an id no editor has opened. Panels already tolerate an
// unknown id (getJson returns undefined, viewers render empty), so this
// degrades to "shows nothing" rather than breaking.

import { sendOsc, subscribeOsc } from "../index.ts";
import { getLast } from "../retainer.ts";
import { ADDR, decodeActiveDoc, encodeActiveDoc } from "./codecs.ts";

const DEFAULT_DOCUMENT_ID = "default";

export function getActiveDocumentId(): string {
  const args = getLast(ADDR.activeDoc);
  if (args === undefined) return DEFAULT_DOCUMENT_ID;
  return decodeActiveDoc(args) ?? DEFAULT_DOCUMENT_ID;
}

/**
 * Announce the active document.
 *
 * No-ops when unchanged, matching the previous behaviour — JsonEditPanel
 * calls this on focus, which would otherwise churn every subscriber on every
 * click into the editor.
 */
export function setActiveDocumentId(id: string): void {
  if (getActiveDocumentId() === id) return;
  void sendOsc(ADDR.activeDoc, encodeActiveDoc(id));
}

export function onActiveDocumentIdChange(listener: (id: string) => void): () => void {
  return subscribeOsc(ADDR.activeDoc, (_address, args) => {
    const id = decodeActiveDoc(args);
    if (id === null) return;
    listener(id);
  });
}
