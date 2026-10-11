// Pure helpers for the drawer grid (52px unit, 8px gap). No React.

export const CELL_UNIT = 52;
export const CELL_GAP = 8;
export type Span = [number, number];

const ALLOWED: Span[] = [[1, 1], [2, 1], [2, 2], [3, 1]];

/** Clamp a declared span to the vocabulary and to the available columns. */
export function normalizeSpan(span: Span | undefined, columns: number): Span {
  const [c, r] = span ?? [1, 1];
  const ok = ALLOWED.find(([ac, ar]) => ac === c && ar === r) ?? [1, 1];
  return [Math.min(ok[0], Math.max(1, columns)), ok[1]];
}

/** CSS grid placement for a cell (auto-placed; pair with grid-auto-flow: dense). */
export function spanToPlacement(span: Span | undefined, columns: number): { gridColumn: string; gridRow: string } {
  const [c, r] = normalizeSpan(span, columns);
  return { gridColumn: `span ${c}`, gridRow: `span ${r}` };
}

/** Pixel size of a span (for tests / sizing hints). */
export function spanToPixels(span: Span | undefined): { width: number; height: number } {
  const [c, r] = span ?? [1, 1];
  return { width: c * CELL_UNIT + (c - 1) * CELL_GAP, height: r * CELL_UNIT + (r - 1) * CELL_GAP };
}

/** Columns of the grid: vertical orientation is 2-up; horizontal fits the width. */
export function gridColumns(orientation: "horizontal" | "vertical", widthPx: number): number {
  if (orientation === "vertical") return 2;
  return Math.max(3, Math.floor((widthPx + CELL_GAP) / (CELL_UNIT + CELL_GAP)));
}
