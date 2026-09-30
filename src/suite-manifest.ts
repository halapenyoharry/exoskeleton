import type { PanelManifest } from "./panel-manifest";

export interface SuiteLayoutSlot {
  panelId: string;
  position: {
    direction: "left" | "right" | "above" | "below" | "within";
    reference?: string;
  };
}

/**
 * A suite's complete integration contract.
 * Represents a cooperating constellation of panels that share a workflow,
 * bus namespace, and coordinated layout.
 */
export interface SuiteManifest {
  /** Stable identifier for the suite, e.g. "procedural-visuals" */
  id: string;

  /** Human title for presets and menus, e.g. "Procedural Lab" */
  title: string;

  /** One-line description of the suite's purpose */
  description: string;

  /** Primary accent color representing the suite */
  accent: string;

  /** Single-character glyph for the suite's preset icon */
  glyph: string;

  /** Base OSC address prefix, e.g. "/procedural-suite" */
  oscPrefix?: string;

  /** Member panels belonging to this suite */
  panels: PanelManifest<any>[];

  /** Default relative layout geometry when opening this suite preset */
  defaultLayout: SuiteLayoutSlot[];
}
