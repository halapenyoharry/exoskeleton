# tempo-clock

OSC master clock. Emits `/exoskeleton/clock/tick` at MIDI PPQ-24 rate and `/exoskeleton/clock/beat` at quarter-note boundaries. Configurable BPM, play/stop toggle, visible beat counter.

## What it does

When **playing**, the panel:
- Sends `/exoskeleton/clock/tick` (no args) at `BPM × 24 / 60` Hz. At the default 120 BPM that's 48 Hz — one tick every ~21 ms.
- Sends `/exoskeleton/clock/beat <i>` once per quarter note (every 24th tick). The argument `i` is the beat index counted from playback start (1, 2, 3, ...).
- Animates the on-screen beat counter on each beat.

When **stopped**, no OSC traffic. The beat counter resets to 0.

## OSC addresses emitted

| Address | Args | Rate (at 120 BPM) | Notes |
|---|---|---|---|
| `/exoskeleton/clock/tick` | — | 48 Hz | PPQ-rate pulse. Subdivide for finer timing. |
| `/exoskeleton/clock/beat` | `int` | 2 Hz | Quarter note. Arg = beat index from playback start. |

## Params (persisted)

```ts
{
  bpm: number,       // 20–300, default 120
  playing: boolean,  // default false
}
```

Both persist via Dockview panel params — they survive a reload.

## How to consume the clock from another panel

```tsx
import { useEffect } from "react";
import { onOsc } from "../../osc";

useEffect(() => {
  const unsubP = onOsc("/exoskeleton/clock/beat", (_addr, args) => {
    const beatIndex = args[0]?.value as number;
    // advance your sequencer / metronome / whatever
  });
  return () => { void unsubP.then((fn) => fn()); };
}, []);
```

If you want everything from the clock, subscribe to the wildcard:

```ts
onOsc("/exoskeleton/clock/*", (addr, args) => { ... });
```

## Timing notes

The internal timer uses `setInterval`. That's acceptable for OSC because:

- Receivers tolerate jitter. UDP and OSC are designed for it.
- Drift is uniform — every subscriber syncs to *this* panel as the master, so they all drift together.

That said, `setInterval` resolution is ~4 ms in browser foreground and **throttled** in background tabs. Music-grade precision (sample-accurate timing under 1 ms) needs a Web Audio `AudioContext`-based timer or a Tauri-side scheduler. For typical 60–180 BPM workflow timing this implementation is imperceptibly close.

## Default styling

- Accent color `#ff6b9d` (warm pink) — distinct from editor cyan, terminal amber, webview mint.
- Glyph `♩` (quarter note).
- Default layout position: directly below the editor panel.

## Installing this panel into your Exoskeleton fork

Copy this folder into `src/panels/tempo-clock/` of your fork. Then have an agent read `manifest.ts` and apply the install protocol from the library top-level README — App.tsx, ColoredTab.tsx, App.css, default-layout.ts.

Requires the Exoskeleton OSC bus (`src/osc/`) to be present (it is, on `main` since commit `0ecf16e`).
