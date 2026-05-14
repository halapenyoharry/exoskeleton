# scope

Receives OSC piano notes, synthesizes them via Web Audio, shows the live waveform on an oscilloscope canvas plus a scrolling note log. The receiver half of the [piano + scope](../piano/) OSC demo.

## What it does

- Listens for `/exoskeleton/piano/note-on` on the OSC bus.
- On each note: creates a sine `OscillatorNode` with attack–decay envelope, routes it through an `AnalyserNode` to the audio output, and logs the note name + MIDI number + velocity.
- The bottom-half canvas shows the live time-domain waveform from the AnalyserNode — *current sound*, not a scrolling trace. Like a real oscilloscope.

Why this shape: scope makes the OSC layer visible *and* audible. You click a piano key on the other panel, the sound comes out of scope, the wave shape appears on scope's canvas. The OSC carrying the message is unambiguous — if the bus broke, nothing here would happen.

## OSC addresses subscribed to

| Address | Args | Description |
|---|---|---|
| `/exoskeleton/piano/note-on` | `int, int` | MIDI note number, velocity (0–127). Triggers synthesis + log entry. |

## Params (persisted)

```ts
{}  // no persistent state today
```

## Audio details

- One AudioContext per panel mount.
- `AnalyserNode.fftSize = 2048` — enough resolution for a clear single-octave wave.
- Envelope: 10 ms linear attack to `velocity/127 * 0.25` gain, then 900 ms exponential decay to silence.
- Voices are self-cleaning — `OscillatorNode.stop(now + 1.0)` releases each one. No manual bookkeeping.

## Default styling

- Accent color: `#00ff7f` (CRT-scope green).
- Glyph: `∿` (sine wave).
- Default layout: dropped into the terminal tab group on first launch.

## What's not built yet

- Multi-source listening. Today scope is hardcoded to piano. Easy to broaden to `/exoskeleton/*/note-on` or any `/instrument/*/play` style address.
- Frequency-domain view (FFT spectrum) alongside the time-domain waveform.
- Velocity-curved decay (loud notes ring longer). Trivial — adjust the exponential ramp by velocity.
- Sustain (note-off). Notes auto-decay over 1s right now.
- Configurable timbre (square / saw / triangle, or even a sample). Currently sine.
- Recording / playback.
