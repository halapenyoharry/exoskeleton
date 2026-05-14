# piano

Clickable one-octave piano keyboard. Emits OSC `note-on` messages when keys are pressed. Paired with the [scope](../scope/) panel makes a complete "see/hear OSC working" demo without leaving the app.

## What it does

- Renders one octave (C4 through B4 — MIDI 60–71) with 7 white keys and 5 black keys.
- On mousedown, emits `/exoskeleton/piano/note-on` with args `[midi_note, velocity]`. Velocity is currently fixed at 100.
- Does not play sound itself. The receiving panel (typically scope) synthesizes audio. This is intentional — it makes the OSC carrying the message visible.

## OSC addresses emitted

| Address | Args | Description |
|---|---|---|
| `/exoskeleton/piano/note-on` | `int, int` | MIDI note number (60–71 by default), velocity (0–127) |

## Params (persisted)

```ts
{}  // no persistent state today
```

## How to listen

```ts
import { useEffect } from "react";
import { onOsc } from "../../osc";

useEffect(() => {
  const unsubP = onOsc("/exoskeleton/piano/note-on", (_addr, args) => {
    const midi = args[0]?.value as number;
    const velocity = args[1]?.value as number;
    // synthesize / log / route / whatever
  });
  return () => { void unsubP.then((fn) => fn()); };
}, []);
```

## Default styling

- Accent color: `#f4c075` (warm ivory).
- Glyph: `♬` (eighth-note pair).
- Default layout: dropped into the terminal tab group on first launch.

## What's not built yet

- Note-off events (notes don't have a "release"). When we need sustained notes, add `/exoskeleton/piano/note-off`.
- Velocity sensitivity (mouse position on key → velocity). Today it's fixed at 100.
- Multi-octave or configurable starting note. One octave is enough for a demo.
- Keyboard-key bindings (Z = C4, X = D4, etc.). Easy to add when needed.
- Sustained polyphony from MIDI input. The whole panel is mouse-only right now.
