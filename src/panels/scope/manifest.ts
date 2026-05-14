import type { PanelManifest } from "../../panel-manifest";
import ScopePanel from "./ScopePanel";

export interface ScopeParams {}

const manifest: PanelManifest<ScopeParams> = {
  // identity
  id: "scope",
  title: "scope",
  component: ScopePanel,
  description:
    "Receives piano note-on messages over OSC, synthesizes them via Web Audio, and shows a live oscilloscope of the current sound plus a scrolling note log. The receiver half of the piano+scope OSC demo.",

  // chrome
  accent: "#00ff7f",
  glyph: "∿",

  // layout — visible next to piano on first launch
  defaultLayout: { direction: "within", reference: "terminal" },
  paramsDefault: {},

  // OSC integration
  osc: {
    listens: [
      {
        address: "/exoskeleton/piano/note-on",
        args: ["int", "int"],
        description:
          "MIDI note + velocity. Scope synthesizes a sine note with AD envelope and shows the waveform.",
      },
    ],
  },
};

export default manifest;
