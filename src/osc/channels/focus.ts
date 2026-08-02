// Node focus (fly the camera to a node), on OSC.
//
// Address:  /json/{documentId}/focus   [nodeId: string, sourcePanelId: string]
// Retained: NO. Focus is a verb, not a state — nothing in the app asks "what
//           is focused." Retaining it would mean a graph panel opened an hour
//           later would immediately fly its camera somewhere, which is not
//           what anyone means by opening a panel.

import { sendOsc, subscribeOsc } from "../index.ts";
import { isEcho, registerLocalSource } from "../local-sources.ts";
import { ADDR, decodeFocus, encodeFocus, type FocusEvent } from "./codecs.ts";

export type { FocusEvent };

export function broadcastNodeFocus(
  documentId: string,
  nodeId: string,
  sourcePanelId: string,
): void {
  registerLocalSource(sourcePanelId);
  void sendOsc(ADDR.focus(documentId), encodeFocus(nodeId, sourcePanelId));
}

export function onNodeFocusBroadcast(handler: (event: FocusEvent) => void): () => void {
  return subscribeOsc(ADDR.focusAny, (address, args) => {
    const event = decodeFocus(address, args);
    if (event === null) return;
    if (isEcho(event.sourcePanelId)) return;
    handler(event);
  });
}
