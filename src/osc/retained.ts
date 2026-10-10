// The one place retention is declared.
//
// This must run at module init, before any panel mounts. A retain() rule only
// caches values sent *after* it is registered, so a rule added inside a
// consumer's effect silently loses everything broadcast before that consumer
// appeared — strictly worse than the module-level variables this replaced,
// which were live from first import.
//
// Imported for side effect by src/osc/channels/index.ts, which every consumer
// of these channels goes through. Registration therefore cannot be forgotten
// by a panel author, and cannot be duplicated (retain() is idempotent).
//
// What is NOT here matters as much as what is:
//
//   /json/*\/focus            focus is a verb; nothing asks what is focused
//   /exoskeleton/clock/tick   24 PPQ of pure churn
//   /exoskeleton/piano/*      notes are events; a retained note-on is a bug
//
// Retention is opt-in precisely so this list stays short and arguable.

import { retain } from "./retainer.ts";
import { ADDR } from "./channels/codecs.ts";

retain(ADDR.selectAny); // StatusBarPanel reads current selection on mount
retain(ADDR.activeDoc); // panels mounting later need the current document
retain(ADDR.graphsConnected); // the status bar renders this toggle on mount

export {};
