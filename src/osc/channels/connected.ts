// Whether the graph panels track each other's selection/focus, on OSC.
//
// Address:  /json/graphs/connected   [connected: bool]
// Retained: yes — the status bar renders the toggle state on mount.
//
// This is the channel that most obviously earns the bridge. "Decouple the
// graphs" is a foot-pedal gesture: you are already using both hands on a
// graph and you want the other panels to stop following. Nothing else in the
// app needed to be reachable from a footswitch; this one always did.
//
// Defaults to connected, matching the previous json-bus behaviour.

import { sendOsc, subscribeOsc } from "../index.ts";
import { getLast } from "../retainer.ts";
import { ADDR, decodeGraphsConnected, encodeGraphsConnected } from "./codecs.ts";

const DEFAULT_CONNECTED = true;

export function areGraphsConnected(): boolean {
  const args = getLast(ADDR.graphsConnected);
  if (args === undefined) return DEFAULT_CONNECTED;
  return decodeGraphsConnected(args) ?? DEFAULT_CONNECTED;
}

/** No-ops when unchanged, matching the previous behaviour. */
export function setGraphsConnected(connected: boolean): void {
  if (areGraphsConnected() === connected) return;
  void sendOsc(ADDR.graphsConnected, encodeGraphsConnected(connected));
}

export function onGraphsConnectionChange(
  listener: (connected: boolean) => void,
): () => void {
  return subscribeOsc(ADDR.graphsConnected, (_address, args) => {
    const connected = decodeGraphsConnected(args);
    if (connected === null) return;
    listener(connected);
  });
}
