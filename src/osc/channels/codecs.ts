// Wire codecs for the cross-panel coordination channels.
//
// This is the layer the two-part rule lands on: "fits in an OSC arg AND is
// cheap to send." Everything here fits and is cheap. The JSON document does
// not (it fits only as JSON.stringify, which is not cheap), so it stays in
// src/data/json-bus.ts.
//
// Encoding lives in exactly one module because moving to positional OscArg[]
// trades compiler-checked structs for indices. Confining that trade here
// means panels keep typed values and the layout is asserted by tests rather
// than by reading three graph panels.
//
// Decoders are deliberately lenient: once these addresses cross the UDP
// bridge, anything on the network can send them. A malformed message returns
// null and is skipped, never throws into a subscriber.
//
// Pure module — no imports from src/osc/index.ts, so `node --test` can reach
// it without the Tauri environment.

import type { OscArg } from "../types.ts";

// --- Address construction -------------------------------------------------

// OSC 1.0 reserves these in address patterns: space # * , / ? [ ] { }
// A documentId is a user-settable panel param ("default", but a file path is
// plausible), so it cannot be interpolated raw — a "/" would silently invent
// an extra address segment and break pattern matching.
const RESERVED = /[ #*,/?[\]{}!'()]/g;

export function encodeDocSegment(documentId: string): string {
  return encodeURIComponent(documentId).replace(
    RESERVED,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"),
  );
}

export function decodeDocSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // Malformed percent-escape from an external sender. Use it verbatim
    // rather than throwing — worst case it matches no open document.
    return segment;
  }
}

export const ADDR = {
  select: (documentId: string) => `/json/${encodeDocSegment(documentId)}/select`,
  focus: (documentId: string) => `/json/${encodeDocSegment(documentId)}/focus`,
  selectAny: "/json/*/select",
  focusAny: "/json/*/focus",
  activeDoc: "/json/active",
  graphsConnected: "/json/graphs/connected",
} as const;

/** Pull the documentId back out of "/json/{doc}/select" or ".../focus". */
export function documentIdFromAddress(address: string): string | null {
  const parts = address.split("/");
  // ["", "json", "{doc}", "select"]
  if (parts.length !== 4 || parts[1] !== "json") return null;
  return decodeDocSegment(parts[2]);
}

// --- Arg helpers ----------------------------------------------------------

function str(value: string): OscArg {
  return { type: "string", value };
}

function nilOrStr(value: string | null): OscArg {
  return value === null ? { type: "nil", value: null } : str(value);
}

/**
 * Read an arg as a string, or null.
 *
 * Lenient on the null case: our own encoder emits {type:"nil"}, but an
 * external controller that cannot send a nil type will send "" instead, and
 * both plainly mean "no node."
 */
function readNullableString(arg: OscArg | undefined): string | null {
  if (arg === undefined) return null;
  if (arg.type === "nil") return null;
  if (arg.type === "string") return arg.value === "" ? null : arg.value;
  return null;
}

function readString(arg: OscArg | undefined): string | null {
  if (arg === undefined) return null;
  if (arg.type === "string") return arg.value === "" ? null : arg.value;
  return null;
}

function readBool(arg: OscArg | undefined): boolean | null {
  if (arg === undefined) return null;
  if (arg.type === "bool") return arg.value;
  // TouchOSC and friends commonly send 0/1 as int or float for a toggle.
  if (arg.type === "int" || arg.type === "float") return arg.value !== 0;
  return null;
}

// --- Selection ------------------------------------------------------------
// /json/{documentId}/select   [nodeId: string|nil, sourcePanelId: string, label: string?]
//
// Optional arg last, so an external sender can send two args and omit the
// label. sourcePanelId is always present (it is what suppresses echo back to
// the originating panel) and therefore precedes the optional one.

export interface SelectionEvent {
  documentId: string;
  nodeId: string | null;
  sourcePanelId: string;
  label?: string;
}

export function encodeSelection(
  nodeId: string | null,
  sourcePanelId: string,
  label?: string,
): OscArg[] {
  const args: OscArg[] = [nilOrStr(nodeId), str(sourcePanelId)];
  if (label !== undefined) args.push(str(label));
  return args;
}

export function decodeSelection(address: string, args: OscArg[]): SelectionEvent | null {
  const documentId = documentIdFromAddress(address);
  if (documentId === null) return null;
  // sourcePanelId is required for echo suppression, but an external sender
  // has no panel id. Treat a missing one as "external" — a source that
  // matches no panel, so every panel reacts.
  const sourcePanelId = readString(args[1]) ?? "external";
  const label = readString(args[2]);
  return {
    documentId,
    nodeId: readNullableString(args[0]),
    sourcePanelId,
    ...(label === null ? {} : { label }),
  };
}

// --- Focus ----------------------------------------------------------------
// /json/{documentId}/focus   [nodeId: string, sourcePanelId: string]
// Not retained — nothing asks "what is focused," it is a fly-the-camera verb.

export interface FocusEvent {
  documentId: string;
  nodeId: string;
  sourcePanelId: string;
}

export function encodeFocus(nodeId: string, sourcePanelId: string): OscArg[] {
  return [str(nodeId), str(sourcePanelId)];
}

export function decodeFocus(address: string, args: OscArg[]): FocusEvent | null {
  const documentId = documentIdFromAddress(address);
  if (documentId === null) return null;
  const nodeId = readString(args[0]);
  if (nodeId === null) return null; // focusing nothing is not a thing
  return {
    documentId,
    nodeId,
    sourcePanelId: readString(args[1]) ?? "external",
  };
}

// --- Active document ------------------------------------------------------
// /json/active   [documentId: string]   retained

export function encodeActiveDoc(documentId: string): OscArg[] {
  return [str(documentId)];
}

export function decodeActiveDoc(args: OscArg[]): string | null {
  return readString(args[0]);
}

// --- Graphs connected -----------------------------------------------------
// /json/graphs/connected   [connected: bool]   retained
// Externally settable on purpose: a footswitch decoupling the graphs is the
// kind of thing the bridge exists for.

export function encodeGraphsConnected(connected: boolean): OscArg[] {
  return [{ type: "bool", value: connected }];
}

export function decodeGraphsConnected(args: OscArg[]): boolean | null {
  return readBool(args[0]);
}
