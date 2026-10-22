import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DockviewApi, DockviewPanelApi } from "dockview-react";
import { emitPanelMenu, getPanelMenu } from "./panel-menu";
import { resolveComponentKey } from "./ColoredTab";
import type { PanelMenuItem } from "./panel-manifest";
import "./PanelMenuButton.css";

// The ≡ menu of a panel: a button that opens the panel's declared menu
// (manifest.menu: New, Open, Library…) followed by the panel section
// (Maximize, Pop out, Move to…, Close). Rendered either in the group's
// header actions (HeaderActions.tsx) or as a cell in the panel's controls
// (PanelPanes.tsx, cell type "menu"). The dropdown is the pre-existing
// menu, kept as it was.

/** Back-gesture closers for the open dropdown (phone). */
const backClosers = new Set<() => void>();
export function closeBackClosers(): boolean {
  if (backClosers.size === 0) return false;
  const fns = [...backClosers];
  backClosers.clear();
  fns.forEach((f) => f());
  return true;
}

/** Does this panel declare a "menu" cell among its controls? Then the
 *  header actions leave the ≡ to the controls. */
export function panelHasMenuCell(panes: { body?: { cells: { type: string }[] } }[] | undefined): boolean {
  return !!panes?.some((p) => p.body?.cells.some((c) => c.type === "menu"));
}

export interface PanelMenuButtonProps {
  panelId: string;
  api: DockviewPanelApi;
  containerApi: DockviewApi;
  /** The document edge's panel: no window section (it is structural). */
  structural?: boolean;
  className?: string;
}

export function PanelMenuButton({ panelId, api, containerApi, structural, className }: PanelMenuButtonProps) {
  const key = resolveComponentKey(panelId) ?? panelId;
  const items = getPanelMenu(key);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const rootRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    backClosers.add(close);
    const doc = rootRef.current?.ownerDocument ?? document;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const onDown = (e: Event) => {
      if (!(e.target as Element).closest?.(".exo-menu, .exo-menu-btn")) setMenu(null);
    };
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("pointerdown", onDown, true);
    return () => {
      doc.removeEventListener("keydown", onKey);
      doc.removeEventListener("pointerdown", onDown, true);
      backClosers.delete(close);
    };
  }, [menu]);

  const act = (fn: () => void) => () => {
    setMenu(null);
    fn();
  };
  const toggle = (e: React.MouseEvent<HTMLElement>) => {
    if (menu) return setMenu(null);
    const r = e.currentTarget.getBoundingClientRect();
    setMoveOpen(false);
    setMenu({ x: r.left, y: r.bottom + 4 });
  };
  const group = api.group;
  const otherGroups = containerApi.groups.filter((g) => g.id !== group.id);
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
        onClick={act(() => emitPanelMenu(panelId, item.id))}
      >
        {item.label}
        {item.shortcut && <span className="exo-menu__kbd">{item.shortcut}</span>}
      </button>
    );

  return (
    <>
      <button
        ref={rootRef}
        type="button"
        className={["exo-menu-btn", className].filter(Boolean).join(" ")}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        title="Menu"
        onClick={toggle}
      >
        ≡
      </button>
      {menu &&
        createPortal(
          <div className="exo-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
            {(items ?? []).map((item) => renderItem(item))}
            {!structural && (
              <>
                {items && <hr className="exo-menu__rule" />}
                <button
                  role="menuitem"
                  onClick={act(() => (group.api.isMaximized() ? group.api.exitMaximized() : group.api.maximize()))}
                >
                  {group.api.isMaximized() ? "Restore" : "Maximize"}
                </button>
                <button role="menuitem" onClick={act(() => void containerApi.addPopoutGroup(group))}>
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
                            onClick={act(() => api.moveTo({ group: g, position }))}
                          >
                            {label} {g.activePanel?.title ?? "group"}
                          </button>
                        ))}
                      </div>
                    ))
                  ))}
                <button role="menuitem" onClick={act(() => api.close())}>
                  Close
                </button>
              </>
            )}
          </div>,
          (rootRef.current?.ownerDocument ?? document).body,
        )}
    </>
  );
}
