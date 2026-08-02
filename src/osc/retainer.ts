// The OSC retainer: a local cache that remembers the last args seen at an
// address, for the panels that need a current value on mount rather than an
// event stream.
//
// Three properties matter, and each one is load-bearing:
//
// 1. SEPARATE FROM THE MESSAGE. Retention is not a flag on the message
//    (MQTT-style). The OSC wire has no broker to honor such a flag, so a
//    "retained" message would work in-process and silently vanish across the
//    UDP bridge — divergent semantics across a boundary. Keeping the cache
//    local means sendOsc and the bridge stay exactly as they were, and any
//    process that wants memory keeps its own.
//
// 2. PRIVILEGED, NOT AN ORDINARY SUBSCRIBER. retainIfRegistered() is called
//    from inside dispatchLocal BEFORE the subscriber loop. If the retainer
//    registered via subscribeOsc, dispatch order would decide whether a
//    handler re-reading getLast() sees the new value or the previous one.
//
// 3. OPT-IN PER ADDRESS PATTERN. A retainer that cached everything would also
//    cache /exoskeleton/clock/tick at 24 PPQ — meaningless churn. Callers
//    declare what is worth remembering via retain().
//
// No @tauri-apps imports here, deliberately: this module must be unit-testable
// under `node --test` without the Tauri environment that src/osc/index.ts
// needs at module scope.

import type { OscArg } from "./types.ts";
// Explicit .ts extension: this module is reachable from `node --test`, which
// does not resolve extensionless relative specifiers the way Vite does.
import { oscPatternToRegExp } from "./pattern.ts";

interface RetainRule {
  source: string;
  pattern: RegExp;
}

interface Entry {
  args: OscArg[];
  // Monotonic write counter. Lets "most recent match for a pattern" be
  // answered from the cache itself rather than by a subscriber tracking it
  // on the side — a subscriber would reintroduce exactly the dispatch-order
  // race that makes the retainer privileged in the first place.
  seq: number;
}

const rules: RetainRule[] = [];
const cache = new Map<string, Entry>();
let seqCounter = 0;

/**
 * Declare that addresses matching this pattern should be remembered.
 *
 * Register at module init (see src/osc/retained.ts), not from a consumer's
 * effect. A rule added when a panel mounts cannot retroactively capture
 * values broadcast before that mount — which would be strictly worse than
 * the module-level state it replaces.
 *
 * Idempotent: registering the same pattern twice is a no-op, so an accidental
 * double import doesn't duplicate matching work on every dispatch.
 */
export function retain(pattern: string): void {
  if (rules.some((r) => r.source === pattern)) return;
  rules.push({ source: pattern, pattern: oscPatternToRegExp(pattern) });
}

/**
 * Record args if any retain() rule matches. Called by dispatchLocal before
 * the subscriber loop — not part of the public API.
 *
 * Inbound bridge traffic reaches this too, since it also flows through
 * dispatchLocal. That is intended: an external controller setting selection
 * should update what a late-mounting panel reads.
 */
export function retainIfRegistered(address: string, args: OscArg[]): void {
  for (const rule of rules) {
    if (rule.pattern.test(address)) {
      cache.set(address, { args, seq: ++seqCounter });
      return;
    }
  }
}

/**
 * Last args seen at a concrete address, or undefined if nothing has been
 * sent there (or the address isn't retained).
 */
export function getLast(address: string): OscArg[] | undefined {
  return cache.get(address)?.args;
}

/**
 * Every retained entry whose address matches a pattern, most recent first.
 *
 * getLast() covers the common case — a panel that knows its document id asks
 * for "/json/{id}/select". This covers the pattern case: a panel subscribing
 * to "/json/*\/select" on mount needs current values it cannot name the
 * addresses of.
 */
export function getLastMatching(pattern: string): Array<[string, OscArg[]]> {
  const re = oscPatternToRegExp(pattern);
  const out: Array<[string, Entry]> = [];
  for (const [address, entry] of cache) {
    if (re.test(address)) out.push([address, entry]);
  }
  out.sort((a, b) => b[1].seq - a[1].seq);
  return out.map(([address, entry]) => [address, entry.args]);
}

/**
 * The single most recently written entry matching a pattern, or undefined.
 *
 * This is what "what is selected right now, in whichever document it
 * happened in" resolves to.
 */
export function getMostRecent(pattern: string): [string, OscArg[]] | undefined {
  const re = oscPatternToRegExp(pattern);
  let bestAddress: string | undefined;
  let bestEntry: Entry | undefined;
  for (const [address, entry] of cache) {
    if (re.test(address) && (bestEntry === undefined || entry.seq > bestEntry.seq)) {
      bestAddress = address;
      bestEntry = entry;
    }
  }
  return bestEntry === undefined ? undefined : [bestAddress as string, bestEntry.args];
}

/** Drop retained values. Test-support and document-teardown; not routine. */
export function clearRetained(pattern?: string): void {
  if (pattern === undefined) {
    cache.clear();
    return;
  }
  const re = oscPatternToRegExp(pattern);
  for (const address of [...cache.keys()]) {
    if (re.test(address)) cache.delete(address);
  }
}

/** Registered retain patterns, in registration order. Introspection/tests. */
export function retainedPatterns(): string[] {
  return rules.map((r) => r.source);
}

/** Test-support: forget every retain() rule. Not used by app code. */
export function resetRetainRules(): void {
  rules.length = 0;
  cache.clear();
}
