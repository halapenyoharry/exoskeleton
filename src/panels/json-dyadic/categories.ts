import type { EdgeCategory } from "./types";

// Per-category visual tokens. The directive forbids a single connector
// style across edge kinds — these four idioms are the four-way visual
// switch. Adding a fifth category here without a corresponding rendering
// idiom is the same kind of mistake as drawing one of these as a line.

export interface CategoryTokens {
  /** Primary color, used as the category's signature in the UI. */
  color: string;
  /** Semi-transparent fill for containment regions / interactivity fields. */
  fill: string;
  /** Stroke for region borders. Reference layers leave this mostly unused. */
  stroke: string;
  /** Short label for the picker / legend. */
  label: string;
  /** Idiom name — useful as a CSS hook and for debugging. */
  idiom: "enclosure" | "gradient-flow" | "shared-field" | "floating-tag";
}

export const CATEGORY_TOKENS: Record<EdgeCategory, CategoryTokens> = {
  containment: {
    color: "#6dffaa",
    fill: "rgba(109, 255, 170, 0.08)",
    stroke: "rgba(109, 255, 170, 0.45)",
    label: "containment",
    idiom: "enclosure",
  },
  state_change: {
    // Source-end (saturated) color. The gradient runs to a faded warm end
    // defined inline at render time; the token here is the recognizable
    // signature color for legend/picker only.
    color: "#18ffff",
    fill: "rgba(24, 255, 255, 0.06)",
    stroke: "rgba(24, 255, 255, 0.35)",
    label: "state change",
    idiom: "gradient-flow",
  },
  interactivity: {
    color: "#ffb300",
    fill: "rgba(255, 179, 0, 0.10)",
    stroke: "rgba(255, 179, 0, 0.40)",
    label: "interactivity",
    idiom: "shared-field",
  },
  reference: {
    // Low chroma on purpose — references must not dominate the visual field.
    color: "#7f8aa8",
    fill: "rgba(127, 138, 168, 0.04)",
    stroke: "rgba(127, 138, 168, 0.18)",
    label: "reference",
    idiom: "floating-tag",
  },
};

// Order used in pickers and legends. Containment first (structural
// backbone), then state_change (events), interactivity (channels), and
// reference last (lowest visual weight per the spec).
export const CATEGORY_ORDER: EdgeCategory[] = [
  "containment",
  "state_change",
  "interactivity",
  "reference",
];

// Sort comparator: category order first, then by link count descending.
export function compareLayersForPicker(
  aCategory: EdgeCategory,
  aCount: number,
  bCategory: EdgeCategory,
  bCount: number,
): number {
  const ca = CATEGORY_ORDER.indexOf(aCategory);
  const cb = CATEGORY_ORDER.indexOf(bCategory);
  if (ca !== cb) return ca - cb;
  return bCount - aCount;
}
