import type { SuiteManifest } from "../../suite-manifest";
import {
  controlManifest,
  bouncingBallsManifest,
  fountainManifest,
  recursiveManifest,
  topologicalManifest,
} from "./manifest";

export const proceduralVisualsSuite: SuiteManifest = {
  id: "procedural-visuals",
  title: "Procedural Visuals Lab",
  description: "Suite of dynamic algorithmic visualizers and 3D topological manifolds driven by a central OSC control hub.",
  accent: "#f5a623",
  glyph: "🎛️",
  oscPrefix: "/procedural-suite",
  panels: [
    controlManifest,
    topologicalManifest,
    bouncingBallsManifest,
    fountainManifest,
    recursiveManifest,
  ],
  defaultLayout: [
    // Controller anchors left side
    {
      panelId: "procedural-visuals-control",
      position: { direction: "left" },
    },
    // Main 3D topological surface visualizer right of the controller
    {
      panelId: "procedural-visuals-topological",
      position: { direction: "right", reference: "procedural-visuals-control" },
    },
    // Companion visualizers docked within the right group as tabs
    {
      panelId: "procedural-visuals-balls",
      position: { direction: "within", reference: "procedural-visuals-topological" },
    },
    {
      panelId: "procedural-visuals-fountain",
      position: { direction: "within", reference: "procedural-visuals-topological" },
    },
    {
      panelId: "procedural-visuals-recursive",
      position: { direction: "within", reference: "procedural-visuals-topological" },
    },
  ],
};
