import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DockviewDefaultTab, type IDockviewPanelHeaderProps } from "dockview";
import editorManifest from "./panels/editor.manifest";
import webviewManifest from "./panels/webview.manifest";
import dyadicManifest from "./panels/json-dyadic/manifest";
import "./ColoredTab.css";

// Panels that declare `toolbar: true` in their manifest get a toggle in the pill.
// (Only core manifests with a toolbar are listed; extend as panels adopt the field.)
const toolbarPanels = new Set(
  [editorManifest, webviewManifest, dyadicManifest]
    .filter((m) => m.toolbar)
    .map((m) => m.id),
);

// Customize Dockview's default tab without replacing it. The default tab
// carries the drag-and-drop plumbing (pointer event handlers, drag start /
// data transfer setup). Building a tab from scratch means re-implementing
// that — easy to get wrong, breaks when Dockview ships internal changes.
//
// Instead we pass color + a CSS variable carrying the glyph through to the
// default tab's root div. ColoredTab.css uses the variable in a ::before
// pseudo-element. Result: drag works because we touched nothing important.

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
  const [single, setSingle] = useState(
    () => props.api.group.panels.length === 1,
  );

  useEffect(() => {
    const update = () => setSingle(props.api.group.panels.length === 1);
    update();
    const subs = [
      props.containerApi.onDidAddPanel(update),
      props.containerApi.onDidRemovePanel(update),
      props.containerApi.onDidLayoutChange(update),
    ];
    return () => subs.forEach((d) => d.dispose());
  }, [props.api, props.containerApi]);

  if (single) return <PillTab {...props} />;
  return <PlainTab {...props} />;
}

function PlainTab(props: IDockviewPanelHeaderProps) {
  const id = props.api.id;
  const key = resolveComponentKey(id) ?? id;
  const accent = accents[key] ?? "inherit";
  const glyph = glyphs[key] ?? '"·"';

  return (
    <DockviewDefaultTab
      {...props}
      style={
        {
          color: accent,
          "--tab-glyph": glyph,
        } as React.CSSProperties
      }
    />
  );
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function PillTab(props: IDockviewPanelHeaderProps) {
  const id = props.api.id;
  const key = resolveComponentKey(id) ?? id;
  const accent = accents[key] ?? "inherit";
  const glyph = panelGlyph(id);
  const hasToolbar = toolbarPanels.has(key);

  const pillRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(props.api.title ?? id);
  const [toolbarVisible, setToolbarVisible] = useState(
    () => props.api.getParameters<{ toolbarVisible?: boolean }>().toolbarVisible !== false,
  );
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const d = props.api.onDidTitleChange((e) => setTitle(e.title));
    return () => d.dispose();
  }, [props.api]);

  // Mark the group root so CSS can overlay the header on the content.
  useEffect(() => {
    const pill = pillRef.current;
    const root = pill?.closest(".dv-groupview") as HTMLElement | null;
    if (!pill || !root) return;
    root.classList.add("exo-single-tab");
    // Publish the pill's width so panel headers underneath can pad past it.
    const ro = new ResizeObserver(() => {
      root.style.setProperty("--exo-pill-w", `${Math.ceil(pill.getBoundingClientRect().width)}px`);
    });
    ro.observe(pill);
    return () => {
      ro.disconnect();
      root.classList.remove("exo-single-tab");
      root.style.removeProperty("--exo-pill-w");
    };
  }, []);

  // Escape / outside-click close the menu.
  useEffect(() => {
    if (!menu) return;
    const doc = pillRef.current?.ownerDocument ?? document;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const onDown = (e: Event) => {
      if (!(e.target as Element).closest?.(".exo-pill-menu")) setMenu(null);
    };
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("pointerdown", onDown, true);
    return () => {
      doc.removeEventListener("keydown", onKey);
      doc.removeEventListener("pointerdown", onDown, true);
    };
  }, [menu]);

  const group = props.api.group;
  const guard = {
    draggable: false,
    onPointerDown: stop,
    onMouseDown: stop,
  } as const;

  function openMenu() {
    const r = pillRef.current!.getBoundingClientRect();
    setMenu(menu ? null : { x: r.left, y: r.bottom + 4 });
  }
  function toggleToolbar() {
    const next = !toolbarVisible;
    setToolbarVisible(next);
    props.api.updateParameters({ toolbarVisible: next });
  }
  const act = (fn: () => void) => () => {
    setMenu(null);
    fn();
  };

  return (
    <div
      ref={pillRef}
      className="exo-pill"
      style={{ color: accent }}
      title={title}
    >
      <button
        className="exo-pill__btn"
        aria-label="Pane menu"
        aria-expanded={!!menu}
        {...guard}
        onClick={openMenu}
      >
        ☰
      </button>
      <span className="exo-pill__label">
        <span className="exo-pill__glyph">{glyph}</span>
        <span className="exo-pill__title">{title}</span>
      </span>
      {hasToolbar && (
        <button
          className={`exo-pill__btn exo-pill__toolbar${toolbarVisible ? " is-on" : ""}`}
          aria-label="Toggle toolbar"
          aria-pressed={toolbarVisible}
          title="Toggle toolbar"
          {...guard}
          onClick={toggleToolbar}
        >
          ▭
        </button>
      )}
      <button
        className="exo-pill__btn"
        aria-label="Close panel"
        {...guard}
        onClick={() => props.api.close()}
      >
        ×
      </button>
      {menu &&
        createPortal(
          <div
            className="exo-pill-menu"
            role="menu"
            style={{ left: menu.x, top: menu.y, color: accent }}
          >
            <button
              role="menuitem"
              onClick={act(() =>
                group.api.isMaximized()
                  ? group.api.exitMaximized()
                  : group.api.maximize(),
              )}
            >
              {group.api.isMaximized() ? "Restore" : "Maximize"}
            </button>
            <button
              role="menuitem"
              onClick={act(() => void props.containerApi.addPopoutGroup(group))}
            >
              Pop out
            </button>
            <button role="menuitem" onClick={act(() => props.api.close())}>
              Close
            </button>
            <button role="menuitem" disabled>
              Panel menu…
            </button>
          </div>,
          (pillRef.current?.ownerDocument ?? document).body,
        )}
    </div>
  );
}
