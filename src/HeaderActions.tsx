import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IDockviewHeaderActionsProps } from "dockview-react";
import { ensureCompanions } from "./persistence/default-layout";
import { DOCUMENT_EDGE_ID } from "./persistence/document-edge";
import { emitPanelMenu, getPanelMenu, registerPanelMenu } from "./panel-menu";
import { getPanes } from "./chrome/panes-registry";
import { resolveComponentKey } from "./ColoredTab";
import { getPanesVisibility, subscribePanesVisibility } from "./panes-visibility";
import type { PanelMenuItem } from "./panel-manifest";
import editorManifest from "./panels/editor.manifest";
import webviewManifest from "./panels/webview.manifest";
import dyadicManifest from "./panels/json-dyadic/manifest";
import jsonEditManifest from "./panels/json-edit/manifest";
import "./chrome/panes";
import "./HeaderActions.css";

// Manifests whose declared `menu` shows in the ≡ menu.
for (const m of [editorManifest, webviewManifest, dyadicManifest, jsonEditManifest]) {
  registerPanelMenu(m.id, m.menu);
}

/** Back-gesture closers for transient popovers (the ≡ menu). */
const backClosers = new Set<() => void>();
export function closeBackClosers(): boolean {
  if (backClosers.size === 0) return false;
  const fns = [...backClosers];
  backClosers.clear();
  fns.forEach((f) => f());
  return true;
}

/**
 * leftHeaderActionsComponent — renders right after the tabs, for the
 * ACTIVE panel: its ≡ menu (manifest.menu) and the action buttons among
 * its declared panes (e.g. fit). Everything the tab used to carry besides
 * its name lives here, in Dockview's own slot.
 */
export function LeftHeaderActions(props: IDockviewHeaderActionsProps) {
  const active = props.activePanel;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    backClosers.add(close);
    const doc = rootRef.current?.ownerDocument ?? document;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const onDown = (e: Event) => {
      if (!(e.target as Element).closest?.(".exo-menu, .header-btn--menu")) setMenu(null);
    };
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("pointerdown", onDown, true);
    return () => {
      doc.removeEventListener("keydown", onKey);
      doc.removeEventListener("pointerdown", onDown, true);
      backClosers.delete(close);
    };
  }, [menu]);

  // Re-render when any panel's controls cell is snapped away / restored.
  const [, bump] = useState(0);
  useEffect(() => subscribePanesVisibility(() => bump((v) => v + 1)), []);

  if (!active) return null;
  const id = active.id;
  const key = resolveComponentKey(id) ?? id;
  const menuItems = getPanelMenu(key);
  const paneActions = (getPanes(key) ?? []).filter((p) => p.kind === "action");
  const isDocEdge = props.group.id === DOCUMENT_EDGE_ID;
  const panesVis = getPanesVisibility(id);
  const showRestore = !!panesVis && !panesVis.visible;
  if (!menuItems && paneActions.length === 0 && !showRestore) return null;

  const act = (fn: () => void) => () => {
    setMenu(null);
    fn();
  };
  const toggleMenu = (e: React.MouseEvent<HTMLElement>) => {
    if (menu) return setMenu(null);
    const r = e.currentTarget.getBoundingClientRect();
    setMoveOpen(false);
    setMenu({ x: r.left, y: r.bottom + 4 });
  };
  const group = props.group;
  const otherGroups = props.containerApi.groups.filter((g) => g.id !== group.id);
  const renderItem = (item: PanelMenuItem, nested = false): React.ReactNode =>
    item.children ? (
      <div key={item.id} className="exo-menu__group">
        <div className="exo-menu__heading">{item.label}</div>
        {item.children.map((c) => renderItem(c, true))}
      </div>
    ) : (
      <button
        key={item.id}
        role="menuitem"
        className={nested ? "exo-menu__sub" : undefined}
        disabled={item.disabled}
        onClick={act(() => emitPanelMenu(id, item.id))}
      >
        {item.label}
        {item.shortcut && <span className="exo-menu__kbd">{item.shortcut}</span>}
      </button>
    );

  return (
    <div className="header-actions header-actions--left" ref={rootRef}>
      {menuItems && (
        <button
          className="header-btn header-btn--menu"
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={!!menu}
          title="Menu"
          onClick={toggleMenu}
        >
          ≡
        </button>
      )}
      {showRestore && (
        <button
          type="button"
          className="header-btn header-btn--icon"
          aria-label="Show controls"
          title="Show controls"
          onClick={() => panesVis!.show()}
        >
          ▤
        </button>
      )}
      {paneActions.map((a) => (
        <button
          key={a.id}
          type="button"
          className="header-btn header-btn--icon"
          aria-label={a.label}
          title={a.tooltip ?? a.label}
          onClick={() => emitPanelMenu(id, a.id)}
        >
          {a.icon}
        </button>
      ))}
      {menu &&
        createPortal(
          <div className="exo-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
            {(menuItems ?? []).map((item) => renderItem(item))}
            {!isDocEdge && (
              <>
                <hr className="exo-menu__rule" />
                <button
                  role="menuitem"
                  onClick={act(() =>
                    group.api.isMaximized() ? group.api.exitMaximized() : group.api.maximize(),
                  )}
                >
                  {group.api.isMaximized() ? "Restore" : "Maximize"}
                </button>
                <button role="menuitem" onClick={act(() => void props.containerApi.addPopoutGroup(group))}>
                  Pop out
                </button>
                <button role="menuitem" aria-expanded={moveOpen} onClick={() => setMoveOpen(!moveOpen)}>
                  Move to… {moveOpen ? "▾" : "▸"}
                </button>
                {moveOpen &&
                  (otherGroups.length === 0 ? (
                    <div className="exo-menu__heading">No other groups</div>
                  ) : (
                    otherGroups.map((g) => (
                      <div key={g.id} className="exo-menu__group">
                        <div className="exo-menu__heading">{g.activePanel?.title ?? g.id}</div>
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
                            className="exo-menu__sub"
                            onClick={act(() => active.api.moveTo({ group: g, position }))}
                          >
                            {label} {g.activePanel?.title ?? "group"}
                          </button>
                        ))}
                      </div>
                    ))
                  ))}
                <button role="menuitem" onClick={act(() => active.api.close())}>
                  Close
                </button>
              </>
            )}
          </div>,
          (rootRef.current?.ownerDocument ?? document).body,
        )}
    </div>
  );
}

/**
 * rightHeaderActionsComponent — renders at the far right of the header bar:
 *   - ⤡ all: while this group is maximized (phone tap-to-focus), restores the grid.
 *   - +: a blank tab with a component picker (alt-click: clone the active tab's type).
 *   - ⤴ popout: tears the whole group out into its own window.
 *   - ⨯ close-group: closes every panel in this group at once.
 */
export function RightHeaderActions(props: IDockviewHeaderActionsProps) {
  const [maximized, setMaximized] = useState(() => props.group.api.isMaximized());
  useEffect(() => {
    const sync = () => setMaximized(props.group.api.isMaximized());
    sync();
    const d = props.containerApi.onDidMaximizedGroupChange(sync);
    return () => d.dispose();
  }, [props.containerApi, props.group]);
  function addBlank() {
    const id = `blank-${Math.random().toString(36).slice(2, 6)}`;
    props.containerApi.addPanel({
      id,
      component: "blank",
      title: "new",
      position: { referenceGroup: props.group },
    });
  }
  function cloneTab() {
    const active = props.activePanel;
    if (!active) return;
    const component = active.view.contentComponent;
    const newId = `${component}-${Math.random().toString(36).slice(2, 6)}`;
    props.containerApi.addPanel({
      id: newId,
      component,
      title: active.title ?? component,
      position: { referenceGroup: props.group },
    });
    ensureCompanions(props.containerApi, component);
  }
  function closeGroup() {
    [...props.panels].forEach((p) => p.api.close());
  }
  function popoutGroup() {
    props.containerApi.addPopoutGroup(props.group);
  }
  // The document edge is structural: no + / popout / close-all. Its tab's ×
  // collapses the edge (ColoredTab.tsx).
  if (props.group.id === DOCUMENT_EDGE_ID) return null;
  return (
    <div className="header-actions header-actions--right">
      {maximized && (
        <button className="header-btn header-btn--all" title="show all panes again" onClick={() => props.group.api.exitMaximized()}>
          ⤡ all
        </button>
      )}
      <button
        className="header-btn"
        title="new blank tab (pick a component) — alt-click: duplicate this tab's type"
        onClick={(e) => (e.altKey ? cloneTab() : addBlank())}
      >
        +
      </button>
      <button className="header-btn header-btn--popout" title="pop out this group into its own window" onClick={popoutGroup}>
        ⤴
      </button>
      <button className="header-btn header-btn--danger" title="close all panels in this group" onClick={closeGroup}>
        ⨯
      </button>
    </div>
  );
}
