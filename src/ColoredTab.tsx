import { useEffect, useRef, useState } from "react";
import "./chrome-settings";
import { initPaneChrome, registerBackCloser, setPaneOpen, setPanePinned, usePaneChrome } from "./pane-chrome-state";
import { createPortal } from "react-dom";
import type { IDockviewPanelHeaderProps } from "dockview-react";
import editorManifest from "./panels/editor.manifest";
import webviewManifest from "./panels/webview.manifest";
import dyadicManifest from "./panels/json-dyadic/manifest";
import jsonEditManifest from "./panels/json-edit/manifest";
import { emitPanelMenu, getPanelMenu, registerPanelMenu } from "./panel-menu";
import { getStrip } from "./chrome/strip-registry";
import { getToolbarText, onToolbarText } from "./chrome/runtime-options";
import { DOCUMENT_EDGE_ID } from "./persistence/document-edge";
import { getToolbar } from "./chrome/toolbar-registry";
import "./chrome/toolbars";
import "./chrome/strips";
import type { PanelMenuItem } from "./panel-manifest";
import "./ColoredTab.css";
import "./DocumentEdge.css";

// Manifests whose declared `menu` shows in the pill's ☰ menu.
for (const m of [editorManifest, webviewManifest, dyadicManifest, jsonEditManifest]) {
  registerPanelMenu(m.id, m.menu);
}

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
  // Every tab is a pill; a lone pane is a row of one.
  return <PillTab {...props} />;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function PillTab(props: IDockviewPanelHeaderProps) {
  const id = props.api.id;
  const key = resolveComponentKey(id) ?? id;
  const accent = accents[key] ?? "inherit";
  const glyph = panelGlyph(id);
  const pinnedParam = props.api.getParameters<{ drawerPinned?: boolean }>().drawerPinned === true;
  initPaneChrome(id, pinnedParam);
  const { open, pinned } = usePaneChrome(id);
  const [active, setActive] = useState(() => props.api.group.activePanel?.id === props.api.id);

  const hasMenu = !!getPanelMenu(key);
  const hasStrip = !!getStrip(key);
  const hasToolbar = !!getToolbar(key);
  const pillRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(props.api.title ?? id);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [toolbarOn, setToolbarOn] = useState(
    () => props.api.getParameters<{ toolbarVisible?: boolean }>().toolbarVisible !== false,
  );
  const [moveOpen, setMoveOpen] = useState(false);
  // The document edge (left): a one-pill group that is the loaded document.
  // Its × collapses it (the document stays plugged in); collapsed, the group
  // is a narrow strip and the pill becomes a vertical tab (see DocumentEdge.css),
  // which Dockview expands when clicked.
  const isDocEdge = props.api.group.id === DOCUMENT_EDGE_ID;
  const [collapsed, setCollapsed] = useState(false);
  const [docTitle, setDocTitle] = useState(() => (isDocEdge ? getToolbarText(id, "doc") : ""));
  // Phone tap-to-focus: was this pill already active when the press began?
  // (Dockview activates on press, so by click time `active` is always true.)
  const wasActiveRef = useRef(false);

  useEffect(() => {
    const d = props.api.onDidTitleChange((e) => setTitle(e.title));
    const sync = () => setActive(props.api.group.activePanel?.id === props.api.id);
    sync();
    const d2 = props.api.group.api.onDidActivePanelChange(sync);
    const d3 = props.api.onDidGroupChange(sync);
    return () => {
      d.dispose();
      d2.dispose();
      d3.dispose();
    };
  }, [props.api]);

  // Document edge: the strip's text is the document chip text (the same
  // text json-edit publishes for its toolbar chip).
  useEffect(() => {
    if (!isDocEdge) return;
    setDocTitle(getToolbarText(id, "doc"));
    return onToolbarText(id, "doc", setDocTitle);
  }, [isDocEdge, id]);

  // Document edge: tag the group root and follow Dockview's collapsed class
  // (it is toggled on every path: collapse()/expand(), fromJSON, auto-collapse).
  useEffect(() => {
    if (!isDocEdge) return;
    const root = pillRef.current?.closest(".dv-groupview") as HTMLElement | null;
    if (!root) return;
    root.classList.add("exo-doc-edge");
    const sync = () => setCollapsed(root.classList.contains("dv-edge-collapsed"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mo.disconnect();
      root.classList.remove("exo-doc-edge");
    };
  }, [isDocEdge]);

  // Mark the group root so CSS can overlay the header on the content.
  useEffect(() => {
    const pill = pillRef.current;
    const root = pill?.closest(".dv-groupview") as HTMLElement | null;
    if (!pill || !root) return;
    root.classList.add("exo-single-tab");
    // Publish the pill's width so panel headers underneath can pad past it.
    // The whole row (tabs container) is what toolbars must clear.
    const row = (pill.closest(".dv-tabs-container") as HTMLElement | null) ?? pill;
    const ro = new ResizeObserver(() => {
      root.style.setProperty("--exo-pill-w", `${Math.ceil(row.getBoundingClientRect().width)}px`);
    });
    ro.observe(row);
    // Compact mode: if the pill row can't fit, inactive pills go glyph-only
    // (measured by removing the flag, checking overflow, and re-applying).
    const checkCompact = () => {
      root.removeAttribute("data-compact");
      const over = () => row.scrollWidth > row.clientWidth + 1;
      if (!over()) return;
      root.setAttribute("data-compact", "true");
      // Still too wide with glyph-only inactive pills: tighten the active one too.
      if (over()) root.setAttribute("data-compact", "tight");
    };
    const scroller = (row.parentElement as HTMLElement | null) ?? row;
    const ro3 = new ResizeObserver(checkCompact);
    ro3.observe(scroller);
    ro3.observe(root);
    const mo2 = new MutationObserver(checkCompact);
    mo2.observe(row, { childList: true, subtree: true, characterData: true });
    checkCompact();
    // Publish the corner controls' width the same way (the container may
    // mount after the pill, so watch for it).
    let corner: HTMLElement | null = null;
    const ro2 = new ResizeObserver(() => {
      if (corner) {
        root.style.setProperty("--exo-corner-w", `${Math.ceil(corner.getBoundingClientRect().width)}px`);
        checkCompact(); // the row's room depends on the cluster's width
      }
    });
    const attach = () => {
      const c = root.querySelector(".dv-right-actions-container") as HTMLElement | null;
      if (c && c !== corner) {
        if (corner) ro2.unobserve(corner);
        corner = c;
        ro2.observe(c);
      }
    };
    attach();
    const mo = new MutationObserver(attach);
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      ro2.disconnect();
      ro3.disconnect();
      mo2.disconnect();
      mo.disconnect();
      // Other pills of the same group may remain; only the last one cleans up.
      queueMicrotask(() => {
        if (root.querySelector(".exo-pill")) return;
        root.style.removeProperty("--exo-corner-w");
        root.classList.remove("exo-single-tab");
        root.style.removeProperty("--exo-pill-w");
        root.removeAttribute("data-compact");
      });
    };
  }, []);

  // Deck: keep the active pill in view as the row scrolls horizontally.
  useEffect(() => {
    const el = pillRef.current;
    if (active && el?.closest(".exo-deck")) {
      el.scrollIntoView?.({ inline: "nearest", block: "nearest" });
    }
  }, [active]);

  // Escape / outside-click close the menu; back (deck) closes it too.
  useEffect(() => {
    if (!menu) return;
    const unregister = registerBackCloser(() => setMenu(null));
    const doc = pillRef.current?.ownerDocument ?? document;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const onDown = (e: Event) => {
      if (!(e.target as Element).closest?.(".exo-pill-menu, .exo-pill__menu")) setMenu(null);
    };
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("pointerdown", onDown, true);
    return () => {
      doc.removeEventListener("keydown", onKey);
      doc.removeEventListener("pointerdown", onDown, true);
      unregister();
    };
  }, [menu]);

  const group = props.api.group;
  const guard = {
    draggable: false,
    onPointerDown: stop,
    onMouseDown: stop,
  } as const;

  function onLabelClick() {
    const el = pillRef.current;
    if (isDocEdge) return; // never maximized; Dockview expands the collapsed strip on click
    if (!wasActiveRef.current || !el) return;
    // Phone grid only: the deck is one group, so there is nothing to focus.
    if (!el.closest(".exo-phone") || el.closest(".exo-deck")) return;
    if (group.api.isMaximized()) group.api.exitMaximized();
    else group.api.maximize();
  }

  function toggleDrawer() {
    if (!active) {
      props.api.setActive();
      return;
    }
    setPaneOpen(id, !open);
  }
  function toggleMenu(e: React.MouseEvent<HTMLElement>) {
    if (menu) return setMenu(null);
    const r = e.currentTarget.getBoundingClientRect();
    setMoveOpen(false);
    setMenu({ x: r.left, y: r.bottom + 4 });
  }
  function toggleToolbar() {
    const next = !toolbarOn;
    setToolbarOn(next);
    props.api.updateParameters({ toolbarVisible: next });
  }
  const act = (fn: () => void) => () => {
    setMenu(null);
    fn();
  };

  const otherGroups = props.containerApi.groups.filter((g) => g.id !== group.id);
  const renderItem = (item: PanelMenuItem, nested = false): React.ReactNode =>
    item.children ? (
      <div key={item.id} className="exo-pill-menu__group">
        <div className="exo-pill-menu__heading">{item.label}</div>
        {item.children.map((c) => renderItem(c, true))}
      </div>
    ) : (
      <button
        key={item.id}
        role="menuitem"
        className={nested ? "exo-pill-menu__sub" : undefined}
        disabled={item.disabled}
        onClick={act(() => emitPanelMenu(id, item.id))}
      >
        {item.label}
        {item.shortcut && <span className="exo-pill-menu__kbd">{item.shortcut}</span>}
      </button>
    );

  const stripTip = "The loaded document — edit, switch, or load from the Library";
  return (
    <div
      ref={pillRef}
      data-pane-chrome
      className={`exo-pill${active ? " is-active" : ""}${open ? " is-open" : ""}${
        isDocEdge ? " exo-pill--doc" : ""
      }${isDocEdge && collapsed ? " is-collapsed" : ""}`}
      style={{ color: accent, "--pill-accent": accent } as React.CSSProperties}
      title={isDocEdge && collapsed ? stripTip : title}
      role={isDocEdge && collapsed ? "button" : undefined}
      aria-label={isDocEdge && collapsed ? `Document: ${docTitle || "untitled"}. Expand` : undefined}
      // Dockview toggles an edge group when its active tab is clicked. Collapsed,
      // that is exactly the strip's job (click to expand), so let it through.
      // Expanded, only × / Cmd+J / the ⊞ menu collapse: the ☰ menu, the label
      // and the drawer buttons must not.
      onClick={
        isDocEdge
          ? (e) => {
              if (!collapsed) e.preventDefault();
            }
          : undefined
      }
    >
      {hasMenu && (
        <button
          className="exo-pill__btn exo-pill__menu"
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={!!menu}
          {...guard}
          onClick={toggleMenu}
        >
          ≡
        </button>
      )}
      {hasStrip && (
        <button
          className="exo-pill__btn exo-pill__tri"
          aria-label={open ? "Close drawer" : "Open drawer"}
          aria-expanded={open}
          {...guard}
          onClick={toggleDrawer}
        >
          △
        </button>
      )}
      <span
        className="exo-pill__label"
        onPointerDownCapture={() => {
          wasActiveRef.current = props.api.group.activePanel?.id === props.api.id;
        }}
        onClick={onLabelClick}
      >
        <span className="exo-pill__glyph">{glyph}</span>
        <span className="exo-pill__title">{title}</span>
        {isDocEdge && <span className="exo-pill__doc">{docTitle || "untitled"}</span>}
      </span>
      {hasStrip && open && (
        <button
          className={`exo-pill__btn exo-pill__pin${pinned ? " is-on" : ""}`}
          aria-label="Pin drawer open"
          aria-pressed={pinned}
          title="Keep the drawer open"
          {...guard}
          onClick={() => setPanePinned(id, !pinned, props.api)}
        >
          📌
        </button>
      )}
      <button
        className="exo-pill__btn"
        aria-label={isDocEdge ? "Collapse document" : "Close panel"}
        title={isDocEdge ? "Collapse the document (⌘J)" : undefined}
        {...guard}
        onClick={() => (isDocEdge ? group.api.collapse() : props.api.close())}
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
            {(getPanelMenu(key) ?? []).map((item) => renderItem(item))}
            {!hasStrip && !isDocEdge && (
              <>
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
            <button
              role="menuitem"
              aria-expanded={moveOpen}
              onClick={() => setMoveOpen(!moveOpen)}
            >
              Move to… {moveOpen ? "▾" : "▸"}
            </button>
            {moveOpen &&
              (otherGroups.length === 0 ? (
                <div className="exo-pill-menu__heading">No other panes</div>
              ) : (
                otherGroups.map((g) => (
                  <div key={g.id} className="exo-pill-menu__group">
                    <div className="exo-pill-menu__heading">
                      {g.activePanel?.title ?? g.id}
                    </div>
                    {(
                      [
                        ["left", "Left of"],
                        ["right", "Right of"],
                        ["top", "Above"],
                        ["bottom", "Below"],
                        ["center", "Into"],
                      ] as const
                    ).map(([position, label]) => (
                      <button
                        key={position}
                        role="menuitem"
                        className="exo-pill-menu__sub"
                        onClick={act(() => props.api.moveTo({ group: g, position }))}
                      >
                        {label} {g.activePanel?.title ?? "pane"}
                      </button>
                    ))}
                  </div>
                ))
              ))}
            {hasToolbar && (
              <button role="menuitem" onClick={act(toggleToolbar)}>
                {toolbarOn ? "✓ " : ""}Show toolbar
              </button>
            )}
            <button role="menuitem" onClick={act(() => props.api.close())}>
              Close
            </button>
              </>
            )}
          </div>,
          (pillRef.current?.ownerDocument ?? document).body,
        )}
    </div>
  );
}
