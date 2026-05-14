import type { IDockviewPanelProps } from "dockview";
import { sendOsc } from "../../osc";
import "./PianoPanel.css";

// One octave starting at middle C. Enough to play melodies, small enough
// to fit in any panel size. Extending to two+ octaves is a CSS edit away.
const KEYS = [
  { midi: 60, name: "C",  black: false },
  { midi: 61, name: "C♯", black: true  },
  { midi: 62, name: "D",  black: false },
  { midi: 63, name: "D♯", black: true  },
  { midi: 64, name: "E",  black: false },
  { midi: 65, name: "F",  black: false },
  { midi: 66, name: "F♯", black: true  },
  { midi: 67, name: "G",  black: false },
  { midi: 68, name: "G♯", black: true  },
  { midi: 69, name: "A",  black: false },
  { midi: 70, name: "A♯", black: true  },
  { midi: 71, name: "B",  black: false },
];

// Black keys are positioned absolutely over the white keys. Each black key
// sits between two whites; the white-index column tells the renderer where
// to place its left edge. For one octave of 7 whites this is fixed.
const BLACK_LEFT_PERCENT: Record<number, number> = {
  61: 1, // C♯ — right of white #0
  63: 2, // D♯ — right of white #1
  66: 4, // F♯ — right of white #3
  68: 5, // G♯ — right of white #4
  70: 6, // A♯ — right of white #5
};

export interface PianoParams {}

export default function PianoPanel(_props: IDockviewPanelProps<PianoParams>) {
  function play(midi: number) {
    sendOsc("/exoskeleton/piano/note-on", [
      { type: "int", value: midi },
      { type: "int", value: 100 },
    ]);
  }

  const whites = KEYS.filter((k) => !k.black);
  const blacks = KEYS.filter((k) => k.black);
  const whiteCount = whites.length;

  return (
    <>
      <div className="panel-header">piano</div>
      <div className="piano-body">
        <div className="piano-hint">click a key — sends OSC <code>/exoskeleton/piano/note-on [midi, velocity]</code></div>
        <div className="piano-keyboard">
          {whites.map((key) => (
            <button
              key={key.midi}
              className="piano-key piano-key--white"
              onMouseDown={() => play(key.midi)}
              type="button"
            >
              <span className="piano-key__label">{key.name}</span>
            </button>
          ))}
          {blacks.map((key) => {
            const col = BLACK_LEFT_PERCENT[key.midi] ?? 0;
            // Black key is centred on the boundary between two whites:
            // its left edge sits at `col / whiteCount` of the keyboard width,
            // offset back by half its own width.
            const left = `calc(${(col / whiteCount) * 100}% - var(--piano-black-half))`;
            return (
              <button
                key={key.midi}
                className="piano-key piano-key--black"
                style={{ left }}
                onMouseDown={() => play(key.midi)}
                type="button"
              >
                <span className="piano-key__label">{key.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
