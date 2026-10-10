// Cross-panel coordination channels, carried on OSC.
//
// Panels import from here. The functions have the same names and signatures
// they had in src/data/json-bus.ts before the unification (issue #4) — the
// migration was an import-line change, on purpose, so the graph panels'
// hover/click paths were not rewritten to raw address strings while they have
// no automated test coverage.
//
// What changed underneath: these are OSC messages now, so they have addresses,
// they match patterns, and they cross the UDP bridge when it is enabled. An
// external controller can drive selection, focus, the active document, and the
// graphs-connected toggle; the app can drive an external one.
//
// The rule that decides what belongs here:
//
//   If it fits in an OSC arg and is cheap to send, send it as OSC.
//   If something needs to know the last value, retain the address.
//
// The JSON document fits only as JSON.stringify, which is not cheap, so it is
// the one exception and keeps its own holder in src/data/json-bus.ts.

// Side-effect import: registers which addresses are retained, at module init,
// before any panel mounts. See ../retained.ts for why the timing matters.
import "../retained.ts";

export {
  broadcastNodeSelection,
  onNodeSelectionBroadcast,
  getSelectedNode,
  type SelectionEvent,
} from "./selection.ts";

export { broadcastNodeFocus, onNodeFocusBroadcast, type FocusEvent } from "./focus.ts";

export {
  getActiveDocumentId,
  setActiveDocumentId,
  onActiveDocumentIdChange,
} from "./active-doc.ts";

export {
  areGraphsConnected,
  setGraphsConnected,
  onGraphsConnectionChange,
} from "./connected.ts";

export { ADDR } from "./codecs.ts";
