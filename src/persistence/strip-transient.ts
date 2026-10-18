import type { SerializedDockview } from "dockview-react";

/** Panel ids that are transient UI and must never be persisted. */
export const TRANSIENT_PANEL_IDS = ["menu"] as const;

/**
 * Returns a copy of a serialized layout without transient panels (the
 * floating menu) and without any floating group that only held them.
 */
export function stripTransientPanels(layout: SerializedDockview): SerializedDockview {
  const transient = new Set<string>(TRANSIENT_PANEL_IDS);
  const panels = Object.fromEntries(
    Object.entries(layout.panels ?? {}).filter(([id]) => !transient.has(id)),
  );
  // Dockview 8: a floating entry carries `data` (one group) or `grid`
  // (nested layout); only the `data` form is filtered here.
  const floatingGroups = layout.floatingGroups
    ?.map((g) =>
      g.data ? { ...g, data: { ...g.data, views: g.data.views.filter((v) => !transient.has(v)) } } : g,
    )
    .filter((g) => !g.data || g.data.views.length > 0);
  const out: SerializedDockview = { ...layout, panels };
  if (floatingGroups) out.floatingGroups = floatingGroups;
  return out;
}
