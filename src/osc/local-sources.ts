// Feedback-loop guard for bridged coordination channels.
//
// In-process, echo suppression is trivial: a panel ignores messages carrying
// its own sourcePanelId, and there is exactly one dispatcher. Once selection
// and focus cross the UDP bridge, that stops being sufficient. Any loopback
// configuration — send target equal to listen port, or an external controller
// that mirrors what it receives — turns hover-highlight into an unbounded
// loop. json-bus made this unreachable by construction; OSC does not, so the
// guard has to be explicit.
//
// Rule: drop an INBOUND-FROM-BRIDGE message whose sourcePanelId belongs to a
// panel in this process. If it claims to come from one of our own panels and
// it arrived over the network, it is our own message coming home.
//
// Messages from a genuinely external controller are unaffected — they carry
// an unknown sourcePanelId (or none, decoded as "external"), match no local
// panel, and dispatch normally.
//
// Pure module — no @tauri-apps imports, unit-testable under `node --test`.

const localSources = new Set<string>();

/**
 * Note a panel id as belonging to this process. Called by the channel
 * facades on every broadcast, so registration needs no separate lifecycle.
 *
 * Never pruned. Ids are small strings, a session creates tens of them, and
 * a stale id is harmless: the guard only ever suppresses a message that
 * claims to originate from a panel here, which a real external controller
 * would not do.
 */
export function registerLocalSource(sourcePanelId: string): void {
  localSources.add(sourcePanelId);
}

export function isLocalSource(sourcePanelId: string): boolean {
  return localSources.has(sourcePanelId);
}

// Set only for the duration of dispatching one inbound bridge message.
// Dispatch is fully synchronous, so a module-scoped flag is exact — there is
// no interleaving point between begin and end.
let inboundDepth = 0;

export function beginBridgeDispatch(): void {
  inboundDepth++;
}

export function endBridgeDispatch(): void {
  inboundDepth = Math.max(0, inboundDepth - 1);
}

export function isBridgeDispatch(): boolean {
  return inboundDepth > 0;
}

/** True when this message should be discarded as our own echo. */
export function isEcho(sourcePanelId: string): boolean {
  return isBridgeDispatch() && isLocalSource(sourcePanelId);
}

/** Test-support: forget known panel ids and reset dispatch depth. */
export function resetLocalSources(): void {
  localSources.clear();
  inboundDepth = 0;
}
