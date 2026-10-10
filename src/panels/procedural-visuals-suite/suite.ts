import type { SuiteManifest } from "../../suite-manifest";
import {
  controlManifest,
  bouncingBallsManifest,
  fountainManifest,
  recursiveManifest,
  manifoldManifest,
} from "./manifest";

export const proceduralVisualsSuite: SuiteManifest = {
  id: "procedural-visuals",
  title: "Procedural Visuals Lab",
  description: "Suite of dynamic algorithmic visualizers and 3D manifolds driven by a central OSC control hub.",
  accent: "#f5a623",
  glyph: "▦",
  oscPrefix: "/procedural-suite",
  panels: [
    controlManifest,
    manifoldManifest,
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
    // Main 3D manifold visualizer right of the controller
    {
      panelId: "procedural-visuals-manifold",
      position: { direction: "right", reference: "procedural-visuals-control" },
    },
    // Companion visualizers docked within the right group as tabs
    {
      panelId: "procedural-visuals-balls",
      position: { direction: "within", reference: "procedural-visuals-manifold" },
    },
    {
      panelId: "procedural-visuals-fountain",
      position: { direction: "within", reference: "procedural-visuals-manifold" },
    },
    {
      panelId: "procedural-visuals-recursive",
      position: { direction: "within", reference: "procedural-visuals-manifold" },
    },
  ],
};
