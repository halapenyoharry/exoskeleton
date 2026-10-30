import { useEffect, useState } from "react";
import type { IDockviewHeaderActionsProps } from "dockview-react";
import { ensureCompanions } from "./persistence/default-layout";
import { DOCUMENT_EDGE_ID } from "./persistence/document-edge";
import { emitPanelMenu, getPanelMenu, registerPanelMenu } from "./panel-menu";
import { getPanes } from "./chrome/panes-registry";
import { resolveComponentKey } from "./ColoredTab";
import { getPanesVisibility, subscribePanesVisibility } from "./panes-visibility";
import { PanelMenuButton, panelHasMenuCell } from "./PanelMenuButton";
import editorManifest from "./panels/editor.manifest";
import webviewManifest from "./panels/webview.manifest";
import dyadicManifest from "./panels/json-dyadic/manifest";
import jsonEditManifest from "./panels/json-edit/manifest";
import "./chrome/panes";
import "./HeaderActions.css";

export { closeBackClosers } from "./PanelMenuButton";

// Manifests whose declared `menu` shows in the ≡ menu.
for (const m of [editorManifest, webviewManifest, dyadicManifest, jsonEditManifest]) {
  registerPanelMenu(m.id, m.menu);
}

/**
 * leftHeaderActionsComponent — renders right after the tabs, for the
 * ACTIVE panel: its ≡ menu (manifest.menu) and the action buttons among
 * its declared panes (e.g. fit). Everything the tab used to carry besides
 * its name lives here, in Dockview's own slot.
 */
export function LeftHeaderActions(props: IDockviewHeaderActionsProps) {
  const active = props.activePanel;
  // Re-render when any panel's controls cell is snapped away / restored.
  const [, bump] = useState(0);
  useEffect(() => subscribePanesVisibility(() => bump((v) => v + 1)), []);

  if (!active) return null;
  const id = active.id;
  const key = resolveComponentKey(id) ?? id;
  const panes = getPanes(key);
  const showMenu = !!getPanelMenu(key) && !panelHasMenuCell(panes);
  const paneActions = (panes ?? []).filter((p) => p.kind === "action");
  const isDocEdge = props.group.id === DOCUMENT_EDGE_ID || props.group.api.location.type === "edge";
  const panesVis = getPanesVisibility(id);
  const showRestore = !!panesVis && !panesVis.visible;
  if (!showMenu && paneActions.length === 0 && !showRestore) return null;

  return (
    <div className="header-actions header-actions--left">
      {showMenu && (
        <PanelMenuButton panelId={id} api={active.api} containerApi={props.containerApi} structural={isDocEdge} className="header-btn header-btn--menu" />
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
        <button
          type="button"
          className="header-btn header-btn--all"
          aria-label="show all panes again"
          title="show all panes again"
          onClick={() => props.group.api.exitMaximized()}
        >
          ⤡
        </button>
      )}
      <button
        type="button"
        className="header-btn"
        aria-label="new blank tab (pick a component) — alt-click: duplicate this tab's type"
        title="new blank tab (pick a component) — alt-click: duplicate this tab's type"
        onClick={(e) => (e.altKey ? cloneTab() : addBlank())}
      >
        +
      </button>
      <button
        type="button"
        className="header-btn header-btn--popout"
        aria-label="pop out this group into its own window"
        title="pop out this group into its own window"
        onClick={popoutGroup}
      >
        ⤴
      </button>
      <button
        type="button"
        className="header-btn header-btn--danger"
        aria-label="close all panels in this group"
        title="close all panels in this group"
        onClick={closeGroup}
      >
        ⨯
      </button>
    </div>
  );
}
