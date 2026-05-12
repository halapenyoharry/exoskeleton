import type { PanelManifest } from "../../panel-manifest";
import TempoClockPanel from "./TempoClockPanel";

export interface TempoClockParams {
  /** Beats per minute. Range 20–300. Default 120. */
  bpm: number;
  /** Whether the clock is currently emitting. Default false. */
  playing: boolean;
}

const manifest: PanelManifest<TempoClockParams> = {
  // identity
  id: "tempo-clock",
  title: "tempo",
  component: TempoClockPanel,
  description:
    "OSC master clock. Emits /clock/tick at PPQ=24 and /clock/beat at quarter notes; configurable BPM, play/stop, visible beat counter.",

  // chrome
  accent: "#ff6b9d",
  glyph: "♩",

  // layout
  defaultLayout: { direction: "below", reference: "editor" },
  paramsDefault: { bpm: 120, playing: false },

  // OSC integration
  osc: {
    emits: [
      {
        address: "/exoskeleton/clock/tick",
        args: [],
        description: "PPQ-rate pulse. 24 fire per quarter note.",
      },
      {
        address: "/exoskeleton/clock/beat",
        args: ["int"],
        description: "Quarter-note beat. Arg = beat index from playback start (1, 2, 3, ...).",
      },
    ],
  },
};

export default manifest;
