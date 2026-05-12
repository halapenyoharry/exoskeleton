import { useEffect, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import { sendOsc } from "../../osc";
import "./TempoClockPanel.css";

// 24 pulses per quarter note — MIDI standard.
const PPQ = 24;

export interface TempoClockParams {
  bpm: number;
  playing: boolean;
}

export default function TempoClockPanel(
  props: IDockviewPanelProps<TempoClockParams>,
) {
  const [bpm, setBpm] = useState<number>(props.params?.bpm ?? 120);
  const [playing, setPlaying] = useState<boolean>(
    props.params?.playing ?? false,
  );
  const [beat, setBeat] = useState<number>(0);

  // Persist BPM + playing to panel params so they survive a reload.
  useEffect(() => {
    props.api.updateParameters({ bpm, playing });
  }, [bpm, playing, props.api]);

  // Tick timer: runs at PPQ * BPM / 60 Hz while playing.
  // setInterval drift is acceptable for OSC — receivers tolerate jitter,
  // and any drift affects all subscribers uniformly since this panel is
  // the master clock.
  useEffect(() => {
    if (!playing) {
      setBeat(0);
      return;
    }

    const tickMs = 60000 / (bpm * PPQ);
    let tickCount = 0;
    let beatCount = 0;

    const id = setInterval(() => {
      void sendOsc("/exoskeleton/clock/tick", []);
      tickCount++;
      if (tickCount % PPQ === 0) {
        beatCount++;
        setBeat(beatCount);
        void sendOsc("/exoskeleton/clock/beat", [
          { type: "int", value: beatCount },
        ]);
      }
    }, tickMs);

    return () => clearInterval(id);
  }, [playing, bpm]);

  function toggle() {
    setPlaying((p) => !p);
  }

  function onBpmChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = Number(e.target.value);
    if (!Number.isFinite(next) || next < 20 || next > 300) return;
    setBpm(next);
  }

  return (
    <>
      <div className="panel-header">tempo</div>
      <div className="tempo-clock-body">
        <div className="tempo-clock-controls">
          <button onClick={toggle} className="tempo-clock-play">
            {playing ? "■ stop" : "▶ play"}
          </button>
          <input
            type="number"
            min={20}
            max={300}
            step={1}
            value={bpm}
            onChange={onBpmChange}
            className="tempo-clock-bpm"
            aria-label="BPM"
          />
          <span className="tempo-clock-bpm-label">bpm</span>
        </div>
        <div
          key={beat}
          className={`tempo-clock-beat${playing ? " is-active" : ""}`}
          aria-label={playing ? `beat ${beat}` : "idle"}
        >
          {playing ? beat : "♩"}
        </div>
      </div>
    </>
  );
}
