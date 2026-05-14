import { useEffect, useRef } from "react";
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

// Black keys are positioned absolutely over the white keys. The number here
// is the white-key index after which this black sits (0..whiteCount).
const BLACK_LEFT_COL: Record<number, number> = {
  61: 1, // C♯ — right of white #0 (C)
  63: 2, // D♯ — right of white #1 (D)
  66: 4, // F♯ — right of white #3 (F)
  68: 5, // G♯ — right of white #4 (G)
  70: 6, // A♯ — right of white #5 (A)
};

export interface PianoParams {}

export default function PianoPanel(_props: IDockviewPanelProps<PianoParams>) {
  // Active notes: midi numbers currently being held. Used so a global
  // pointerup or window blur can release any in-flight notes that didn't
  // get their own pointerup (cursor dragged off, system stole focus, etc.).
  const activeRef = useRef<Set<number>>(new Set());

  function noteOn(midi: number, velocity: number) {
    if (activeRef.current.has(midi)) {
      // Re-trigger guard: release the prior voice first so scope's voice
      // map doesn't accumulate zombies.
      sendOsc("/exoskeleton/piano/note-off", [{ type: "int", value: midi }]);
    }
    activeRef.current.add(midi);
    sendOsc("/exoskeleton/piano/note-on", [
      { type: "int", value: midi },
      { type: "int", value: velocity },
    ]);
  }

  function noteOff(midi: number) {
    if (!activeRef.current.has(midi)) return;
    activeRef.current.delete(midi);
    sendOsc("/exoskeleton/piano/note-off", [{ type: "int", value: midi }]);
  }

  // Defensive: if pointerup or focus-loss happens with notes still held
  // (cursor dragged off the panel, alt-tab, etc.), release everything so
  // no note hangs forever.
  useEffect(() => {
    function releaseAll() {
      for (const midi of [...activeRef.current]) {
        noteOff(midi);
      }
    }
    window.addEventListener("pointerup", releaseAll);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("pointerup", releaseAll);
      window.removeEventListener("blur", releaseAll);
    };
  }, []);

  // Velocity = mouse-Y within the key. Top edge → soft (30); bottom edge →
  // loud (127). 30 is the floor so soft notes are still audible.
  function velocityFromY(e: React.PointerEvent<HTMLButtonElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const t = Math.min(1, Math.max(0, y / Math.max(1, rect.height)));
    return Math.round(30 + t * 97);
  }

  function onPress(midi: number, e: React.PointerEvent<HTMLButtonElement>) {
    // Capture the pointer so subsequent move/up events route to this key
    // even if the cursor wanders out — needed for sustained holds.
    e.currentTarget.setPointerCapture(e.pointerId);
    noteOn(midi, velocityFromY(e));
  }
  function onRelease(midi: number, e: React.PointerEvent<HTMLButtonElement>) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer wasn't captured (cancelled, etc.); fine
    }
    noteOff(midi);
  }

  const whites = KEYS.filter((k) => !k.black);
  const blacks = KEYS.filter((k) => k.black);
  const whiteCount = whites.length;

  return (
    <>
      <div className="panel-header">piano</div>
      <div className="piano-body">
        <div className="piano-hint">
          click + hold a key — sends OSC{" "}
          <code>/exoskeleton/piano/note-on [midi, velocity]</code> on press,{" "}
          <code>note-off [midi]</code> on release. velocity = mouse-Y in key.
        </div>
        <div className="piano-keyboard">
          {whites.map((key) => (
            <button
              key={key.midi}
              className="piano-key piano-key--white"
              onPointerDown={(e) => onPress(key.midi, e)}
              onPointerUp={(e) => onRelease(key.midi, e)}
              onPointerCancel={(e) => onRelease(key.midi, e)}
              type="button"
            >
              <span className="piano-key__label">{key.name}</span>
            </button>
          ))}
          {blacks.map((key) => {
            const col = BLACK_LEFT_COL[key.midi] ?? 0;
            const left = `calc(${(col / whiteCount) * 100}% - var(--piano-black-half))`;
            return (
              <button
                key={key.midi}
                className="piano-key piano-key--black"
                style={{ left }}
                onPointerDown={(e) => onPress(key.midi, e)}
                onPointerUp={(e) => onRelease(key.midi, e)}
                onPointerCancel={(e) => onRelease(key.midi, e)}
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
