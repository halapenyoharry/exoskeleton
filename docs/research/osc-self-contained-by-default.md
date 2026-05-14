# OSC is self-contained by default

**Status:** decision, 2026-05-14.
**Scope:** Exoskeleton's OSC layer (`src/osc/`, `src-tauri/src/osc.rs`).

## The decision

Exoskeleton's OSC layer operates on an **in-process pub/sub bus by default**. The Tauri/Rust UDP socket is **dormant unless the user explicitly opts in** to "bridge mode" via the settings JSON. A fresh install never binds a network port, never sends a UDP packet, never touches anything else on the user's machine that speaks OSC.

If a user has existing OSC infrastructure (TouchOSC, Sonic Pi, SuperCollider, reachz, Max/MSP, Ableton M4L, etc.), they wire their stuff to ours by enabling the bridge and configuring its ports. The default user — the one cloning Exoskeleton to see what it does — never has to know what a UDP port is.

## Why

1. **No collision with the user's existing OSC.** Default-binding port 9000 or sending to 8000 means a coin-toss whether Exoskeleton spams someone else's OSC receiver, or fails silently because someone else already grabbed the port. Many of these tools are *already* on those ports because they're convention. We learned this concretely the first time: reachz held port 9000 on Harold's machine; Exoskeleton's listener had to fall back to an ephemeral port nobody could route to.

2. **Principle of least surprise.** A fork-and-build template shouldn't open network sockets at first launch without telling the user. Even on localhost. The user fired up a workspace; they did not consent to inbound or outbound UDP traffic.

3. **No accidental cross-talk.** Hitting Play on a Tempo Clock panel that ships in Exoskeleton should not start broadcasting `/exoskeleton/clock/tick` 48 times per second to whatever already-running OSC tool happens to be listening on the default target port. Even if the bytes are technically harmless, surprise side-effects from clicking buttons are not good defaults.

4. **Auditable privacy.** Default install has zero network behavior, period. Easy to verify with `lsof`; easy to explain to anyone wondering what an Exoskeleton fork does on first launch.

5. **The common case doesn't need it.** Panels-talking-to-each-other — the schema this whole architecture is built around — is by definition in-window. Two panels in the same Dockview don't need to traverse the OS kernel's UDP stack to communicate. Local pub/sub is faster *and* simpler *and* survives even if the user's firewall or another process makes UDP unavailable.

6. **Power users will bridge themselves.** Anyone with OSC infrastructure already knows what ports their tools want, what addresses they emit, what the wire looks like. Asking them to flip one config flag to enable the bridge is not a burden; it's an interface they're already fluent in.

## What "default" and "bridge" mean concretely

**Default mode (out of the box):**
- `sendOsc(address, args)` from a panel publishes to an in-process bus inside the app's React tree.
- `onOsc(pattern, handler)` subscribes to the bus.
- No UDP socket binds.
- No outbound packets are sent.
- Nothing in `lsof -i UDP` for the Exoskeleton process.

**Bridge mode (opt-in):**
- User sets `osc.bridge.enabled = true` in the settings JSON (alongside `osc.bridge.listenPort`, `osc.bridge.targetHost`, `osc.bridge.targetPort`).
- On next launch (or on live re-init), the Rust side binds the listen port, opens a target socket, and runs in both directions:
  - All in-process bus messages are mirrored out to the configured UDP target.
  - All inbound UDP packets are mirrored into the in-process bus.
- From the panel's point of view, nothing changes — `sendOsc` and `onOsc` look the same. The bus is just being augmented.

## Tradeoffs

| Side | Pro | Con |
|---|---|---|
| Default | Zero collision risk on first launch; faster local dispatch; survives firewall / port-in-use | Tempo Clock and any current panel using `invoke('send_osc', ...)` needs to route via the new bus instead (small refactor — same `sendOsc` signature, different backend) |
| Bridge | Power users can integrate with anything OSC | One configuration step before external tools see Exoskeleton's traffic |

## What this changes for existing code

- **[src/osc/index.ts](../../src/osc/index.ts)** — `sendOsc` and `onOsc` get a new in-process backend (EventTarget or similar). The Tauri `invoke('send_osc', ...)` is called only when bridge mode is active. Panel-facing API unchanged.
- **[src-tauri/src/osc.rs](../../src-tauri/src/osc.rs)** — `setup()` reads `osc.bridge.enabled` from `tauri-plugin-store`. If false (default), the UDP socket is not bound, no listener task is spawned, the Rust module sits idle. If true, current behavior runs.
- **[src/panels/tempo-clock/](../../src/panels/tempo-clock/)** — no code change needed; `sendOsc` still works, it just dispatches locally now.
- **Settings panel** — surface the bridge config keys so users have a discoverable place to flip the bridge on. (Today the settings panel shows the full state JSON; bridge keys live in that JSON. Could grow a dedicated bridge section later.)
- **Library panels** that ship in `exoskeleton-component-library` — none affected, same `sendOsc` / `onOsc` API.

## What this rules out (deliberately)

- **Default external integrations.** No TouchOSC out of the box. No Sonic Pi connection by default. No "Exoskeleton automatically discovers and pairs with the user's OSC tools." All of that is bridge-mode territory.
- **Default broadcasting / discovery.** No mDNS, no broadcast packets, no service announcements. Same rationale as above.

If a user wants any of that, they enable the bridge and they configure it. Their network, their rules.

## See also

- [docs/research/dockview-constructive-vs-consumptive.md](dockview-constructive-vs-consumptive.md) — companion white paper on Dockview group API patterns.
- The original OSC Tauri command module: PR #3 (`feat: OSC Tauri command module`), with the port-fallback follow-up in commit `98ff601`.
