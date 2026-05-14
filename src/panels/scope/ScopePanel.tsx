import { useEffect, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import { onOsc } from "../../osc";
import "./ScopePanel.css";

interface NoteEvent {
  id: number;
  midi: number;
  noteName: string;
  velocity: number;
  at: number; // performance.now()
}

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

function midiToName(midi: number) {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${octave}`;
}

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface ScopeParams {
  /** Whether the note-log section is shown (default true). Persisted. */
  logVisible?: boolean;
}

const MAX_LOG = 24;
const ATTACK = 0.01;    // 10ms
const RELEASE = 0.15;   // 150ms

export default function ScopePanel(props: IDockviewPanelProps<ScopeParams>) {
  const [log, setLog] = useState<NoteEvent[]>([]);
  const [logVisible, setLogVisible] = useState<boolean>(
    props.params?.logVisible ?? true,
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Active voices keyed by midi note number. Sustained notes live here
  // between their note-on and note-off; releaseVoice ramps + stops + deletes.
  const voicesRef = useRef<Map<number, Voice>>(new Map());
  const logIdRef = useRef(0);

  // Persist logVisible into the panel's params so the next launch restores it.
  useEffect(() => {
    props.api.updateParameters({ logVisible });
  }, [logVisible, props.api]);

  // AudioContext + AnalyserNode per panel mount.
  useEffect(() => {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) {
      console.warn("[scope] no AudioContext available");
      return;
    }
    const ctx = new Ctor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    return () => {
      // Stop everything before tearing down the context so unmount doesn't
      // leak voices.
      for (const v of voicesRef.current.values()) {
        try {
          v.osc.stop();
        } catch {
          // already stopped
        }
      }
      voicesRef.current.clear();
      void ctx.close();
      audioCtxRef.current = null;
      analyserRef.current = null;
    };
  }, []);

  function releaseVoice(midi: number, releaseTime = RELEASE) {
    const ctx = audioCtxRef.current;
    const voice = voicesRef.current.get(midi);
    if (!ctx || !voice) return;
    const now = ctx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      // Anchor the ramp to the current value, then exponentially decay to
      // near-zero. exponentialRampToValueAtTime requires > 0, so use a
      // small floor instead of true 0.
      voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
      voice.osc.stop(now + releaseTime + 0.02);
    } catch {
      // osc may already be stopped (race condition); fine
    }
    voicesRef.current.delete(midi);
  }

  // Subscribe to piano OSC events.
  useEffect(() => {
    const unsubOnP = onOsc("/exoskeleton/piano/note-on", (_addr, args) => {
      const ctx = audioCtxRef.current;
      const analyser = analyserRef.current;
      if (!ctx || !analyser) return;

      const midi = args[0]?.value as number;
      const velocity = (args[1]?.value as number) ?? 100;
      if (typeof midi !== "number") return;

      // Browsers gate AudioContext until a user gesture; first key wakes it.
      if (ctx.state === "suspended") void ctx.resume();

      // Re-trigger: release any existing voice for this midi before starting
      // a new one. Fast release so the new note attacks cleanly.
      if (voicesRef.current.has(midi)) {
        releaseVoice(midi, 0.02);
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = midiToFreq(midi);

      // Sustain envelope: attack to peak then HOLD. No scheduled decay.
      // Release happens on note-off via releaseVoice.
      const peak = (velocity / 127) * 0.25;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + ATTACK);

      osc.connect(gain);
      gain.connect(analyser);
      osc.start(now);

      voicesRef.current.set(midi, { osc, gain });

      setLog((prev) => {
        const entry: NoteEvent = {
          id: ++logIdRef.current,
          midi,
          noteName: midiToName(midi),
          velocity,
          at: performance.now(),
        };
        return [entry, ...prev].slice(0, MAX_LOG);
      });
    });

    const unsubOffP = onOsc("/exoskeleton/piano/note-off", (_addr, args) => {
      const midi = args[0]?.value as number;
      if (typeof midi !== "number") return;
      releaseVoice(midi);
    });

    return () => {
      void unsubOnP.then((fn) => fn());
      void unsubOffP.then((fn) => fn());
    };
  }, []);

  // Oscilloscope draw loop. Single time-domain trace, refreshed every frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    let rafId = 0;
    const buffer = new Float32Array(2048);

    function draw() {
      rafId = requestAnimationFrame(draw);
      const analyser = analyserRef.current;
      if (!analyser) {
        ctx2d!.clearRect(0, 0, canvas!.width, canvas!.height);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }

      analyser.fftSize = 2048;
      analyser.getFloatTimeDomainData(buffer);

      ctx2d!.clearRect(0, 0, w, h);
      // Midline
      ctx2d!.strokeStyle = "rgba(255,255,255,0.05)";
      ctx2d!.lineWidth = 1;
      ctx2d!.beginPath();
      ctx2d!.moveTo(0, h / 2);
      ctx2d!.lineTo(w, h / 2);
      ctx2d!.stroke();

      const accent =
        getComputedStyle(canvas!).getPropertyValue("--panel-accent").trim() ||
        "#00ff7f";
      ctx2d!.strokeStyle = accent;
      ctx2d!.lineWidth = 2 * dpr;
      ctx2d!.beginPath();
      const slice = w / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const y = (1 - buffer[i]) * h * 0.5;
        if (i === 0) ctx2d!.moveTo(x, y);
        else ctx2d!.lineTo(x, y);
        x += slice;
      }
      ctx2d!.stroke();
    }
    draw();
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <>
      <div className="panel-header">scope</div>
      <div className="scope-body">
        <div className="scope-toolbar">
          <button
            type="button"
            className="scope-toolbar__toggle"
            onClick={() => setLogVisible((v) => !v)}
            title={logVisible ? "hide log" : "show log"}
          >
            {logVisible ? "▾" : "▸"} log
          </button>
          <span className="scope-toolbar__hint">
            {logVisible
              ? "last 24 notes — name, midi #, velocity bar"
              : "log hidden — click ▸ to show"}
          </span>
        </div>
        {logVisible && (
          <div className="scope-log">
            {log.length === 0 ? (
              <div className="scope-log__empty">
                waiting for OSC notes on <code>/exoskeleton/piano/note-on</code>{" "}
                …
              </div>
            ) : (
              log.map((entry) => (
                <div key={entry.id} className="scope-log__row">
                  <span className="scope-log__note">{entry.noteName}</span>
                  <span className="scope-log__midi">midi {entry.midi}</span>
                  <div
                    className="scope-log__vel"
                    title={`velocity ${entry.velocity} / 127`}
                  >
                    <div
                      className="scope-log__vel-bar"
                      style={{ width: `${(entry.velocity / 127) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        <canvas ref={canvasRef} className="scope-canvas" />
      </div>
    </>
  );
}
