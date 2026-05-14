import { useEffect, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import { onOsc } from "../../osc";
import "./ScopePanel.css";

interface NoteEvent {
  id: number;
  midi: number;
  noteName: string;
  velocity: number;
  at: number; // performance.now() timestamp
}

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

function midiToName(midi: number) {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${octave}`;
}

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface ScopeParams {}

const MAX_LOG = 24;

export default function ScopePanel(_props: IDockviewPanelProps<ScopeParams>) {
  const [log, setLog] = useState<NoteEvent[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logIdRef = useRef(0);

  // One AudioContext per panel instance. AnalyserNode taps the master bus
  // so the canvas can draw whatever the panel is currently playing.
  useEffect(() => {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      void ctx.close();
      audioCtxRef.current = null;
      analyserRef.current = null;
    };
  }, []);

  // Subscribe to piano note-ons. On each note, synthesize a short sine with
  // an AD envelope and log it. Voices are self-cleaning — gain ramps to 0
  // and the oscillator stops itself after the envelope decays.
  useEffect(() => {
    const unsubP = onOsc("/exoskeleton/piano/note-on", (_addr, args) => {
      const ctx = audioCtxRef.current;
      const analyser = analyserRef.current;
      if (!ctx || !analyser) return;

      const midi = args[0]?.value as number;
      const velocity = (args[1]?.value as number) ?? 100;
      if (typeof midi !== "number") return;

      // Browsers gate AudioContext until user gesture; first key press wakes it.
      if (ctx.state === "suspended") void ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = midiToFreq(midi);

      // Attack–decay envelope. Peak amplitude scaled by velocity.
      const peak = (velocity / 127) * 0.25;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.01); // 10ms attack
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9); // ~900ms decay

      osc.connect(gain);
      gain.connect(analyser);
      osc.start(now);
      osc.stop(now + 1.0);

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
    return () => {
      void unsubP.then((fn) => fn());
    };
  }, []);

  // Oscilloscope draw loop — reads the analyser's time-domain buffer every
  // frame and traces a single waveform across the canvas. Not a scrolling
  // trace; this is the *current* sound, like a real scope.
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

      // Resize the backing store to match CSS pixels at the device's DPR.
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

      // Waveform
      ctx2d!.strokeStyle = "var(--panel-accent)";
      // Read the CSS variable's computed value for stroke (Canvas can't use var()).
      const accent = getComputedStyle(canvas!).getPropertyValue("--panel-accent").trim() || "#00ff7f";
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
        <div className="scope-log">
          {log.length === 0 ? (
            <div className="scope-log__empty">
              waiting for OSC notes on <code>/exoskeleton/piano/note-on</code> …
            </div>
          ) : (
            log.map((entry) => (
              <div key={entry.id} className="scope-log__row">
                <span className="scope-log__note">{entry.noteName}</span>
                <span className="scope-log__midi">midi {entry.midi}</span>
                <div className="scope-log__vel">
                  <div
                    className="scope-log__vel-bar"
                    style={{ width: `${(entry.velocity / 127) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <canvas ref={canvasRef} className="scope-canvas" />
      </div>
    </>
  );
}
