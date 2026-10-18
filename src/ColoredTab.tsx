import { useEffect, useRef } from "react";
import { DockviewDefaultTab, type IDockviewPanelHeaderProps } from "dockview-react";
import { DOCUMENT_EDGE_ID } from "./persistence/document-edge";
import "./ColoredTab.css";
import "./DocumentEdge.css";

// Dockview's default tab, customized without being replaced. The default
// tab carries the drag-and-drop plumbing; we only pass a color, a glyph
// CSS variable, and — for the document edge — a close override that
// collapses the edge group instead of closing the panel. Everything the
// tab used to carry besides its name (menu, controls, pin) now lives in
// Dockview's header-actions slots (HeaderActions.tsx) and the panel's
// Paneview (PanelPanes.tsx).

const accents: Record<string, string> = {
  blank: "var(--accent-settings)",
  editor: "var(--accent-editor)",
  terminal: "var(--accent-terminal)",
  webview: "var(--accent-webview)",
  "tempo-clock": "var(--accent-tempo-clock)",
  settings: "var(--accent-settings)",
  piano: "var(--accent-piano)",
  scope: "var(--accent-scope)",
  "json-edit": "var(--accent-json-edit)",
  menu: "var(--accent-settings)",
  "json-tree": "var(--accent-json-tree)",
  "json-circles": "var(--accent-json-circles)",
  "json-mass": "var(--accent-json-mass)",
  "json-cytoscape": "var(--accent-json-cytoscape)",
  "json-graph": "var(--accent-json-graph)",
  "json-graph3d": "var(--accent-json-graph3d)",
  "json-graph3d-inspect": "var(--accent-json-graph3d-inspect)",
  "json-dyadic": "var(--accent-json-dyadic)",
  "topology-extract": "var(--accent-topology-extract)",
  "procedural-visuals-control": "var(--accent-procedural-control)",
  "procedural-visuals-balls": "var(--accent-procedural-balls)",
  "procedural-visuals-fountain": "var(--accent-procedural-fountain)",
  "procedural-visuals-recursive": "var(--accent-procedural-recursive)",
  "procedural-visuals-manifold": "var(--accent-procedural-manifold)",
};

const glyphs: Record<string, string> = {
  blank: '"+"',
  editor: '"◆"',
  terminal: '"▸"',
  webview: '"◯"',
  settings: '"⚙"',
  "tempo-clock": '"♩"',
  piano: '"♬"',
  scope: '"∿"',
  "json-edit": '"{}"',
  menu: '"⊞"',
  "json-tree": '"ϟ"',
  "json-circles": '"◯"',
  "json-mass": '"M"',
  "json-cytoscape": '"⬢"',
  "json-graph": '"✦"',
  "json-graph3d": '"⌬"',
  "json-graph3d-inspect": '"⌖"',
  "json-dyadic": '"◬"',
  "topology-extract": '"⚗"',
  "procedural-visuals-control": '"▦"',
  "procedural-visuals-balls": '"○"',
  "procedural-visuals-fountain": '"≈"',
  "procedural-visuals-recursive": '"▣"',
  "procedural-visuals-manifold": '"◎"',
};

/** Resolve a panel id to the component key the accent/glyph maps use.
 *  Exact match first; then longest-prefix match so spawned clones
 *  ("json-tree-x3f9" from the header + button) inherit their family's
 *  identity instead of falling back to the neutral dot. */
export function resolveComponentKey(id: string): string | undefined {
  if (id in glyphs || id in accents) return id;
  let best: string | undefined;
  for (const key of Object.keys(glyphs)) {
    if (id.startsWith(`${key}-`) && (!best || key.length > best.length)) {
      best = key;
    }
  }
  return best;
}

/** Accent CSS value for a panel id (clone-aware). */
export function panelAccent(id: string): string {
  const key = resolveComponentKey(id);
  return key ? (accents[key] ?? "inherit") : "inherit";
}

/** Bare glyph character for a panel id (clone-aware, no CSS quoting). */
export function panelGlyph(id: string): string {
  const key = resolveComponentKey(id);
  return (key ? (glyphs[key] ?? '"·"') : '"·"').replace(/"/g, "");
}

export default function ColoredTab(props: IDockviewPanelHeaderProps) {
  const id = props.api.id;
  const key = resolveComponentKey(id) ?? id;
  const accent = accents[key] ?? "inherit";
  const glyph = glyphs[key] ?? '"·"';
  const isDocEdge = props.api.group.id === DOCUMENT_EDGE_ID;
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Phone tap-to-focus: was this tab already active when the press began?
  const wasActiveRef = useRef(false);

  // Document edge: tag the group root so DocumentEdge.css can style the
  // collapsed strip (Dockview toggles .dv-edge-collapsed on it).
  useEffect(() => {
    if (!isDocEdge) return;
    const root = rootRef.current?.closest(".dv-groupview") as HTMLElement | null;
    if (!root) return;
    root.classList.add("exo-doc-edge");
    return () => root.classList.remove("exo-doc-edge");
  }, [isDocEdge]);

  function onClick() {
    if (isDocEdge) return; // Dockview expands the collapsed strip on click
    if (!wasActiveRef.current) return;
    const el = rootRef.current;
    // Phone grid only: tap the active tab to maximize, tap again to restore.
    if (!el?.closest(".exo-phone") || el.closest(".exo-deck")) return;
    const g = props.api.group.api;
    if (g.isMaximized()) g.exitMaximized();
    else g.maximize();
  }

  return (
    <div
      ref={rootRef}
      className={`exo-tab${isDocEdge ? " exo-tab--doc" : ""}`}
      style={{ color: accent, "--tab-glyph": glyph, "--tab-accent": accent } as React.CSSProperties}
      onPointerDownCapture={() => {
        wasActiveRef.current = props.api.group.activePanel?.id === props.api.id;
      }}
      onClick={onClick}
    >
      <DockviewDefaultTab
        {...props}
        closeActionOverride={isDocEdge ? () => props.api.group.api.collapse() : undefined}
      />
    </div>
  );
}
