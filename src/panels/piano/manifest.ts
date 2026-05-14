import type { PanelManifest } from "../../panel-manifest";
import PianoPanel from "./PianoPanel";

export interface PianoParams {}

const manifest: PanelManifest<PianoParams> = {
  // identity
  id: "piano",
  title: "piano",
  component: PianoPanel,
  description:
    "Clickable one-octave keyboard. Emits OSC note-on messages — the simplest possible OSC sender for testing/demoing the bus.",

  // chrome
  accent: "#f4c075",
  glyph: "♬",

  // layout — default visible position for the demo flow alongside scope
  defaultLayout: { direction: "within", reference: "terminal" },
  paramsDefault: {},

  // OSC integration
  osc: {
    emits: [
      {
        address: "/exoskeleton/piano/note-on",
        args: ["int", "int"],
        description: "Note pressed. Args: MIDI note number (0–127), velocity (0–127).",
      },
    ],
  },
};

export default manifest;
