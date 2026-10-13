import { useEffect, useState } from "react";
import type { IDockviewHeaderActionsProps } from "dockview";
import { ensureCompanions } from "./persistence/default-layout";
import "./HeaderActions.css";

/**
 * rightHeaderActionsComponent — renders at the far right of the header bar.
 * Two buttons:
 *   - ⤴ popout: tears the whole group out into its own OS-level window
 *     (Tauri spawns a fresh WebviewWindow; the panels keep their content,
 *     but they're now in a separate top-level window the user can move,
 *     resize, or close independently of the main one).
 *   - ⨯ close-group: closes every panel in this group at once.
 */
export function RightHeaderActions(props: IDockviewHeaderActionsProps) {
  // While this group is maximized (phone tap-to-focus) a visible "⤡ all"
  // button restores the grid.
  const [maximized, setMaximized] = useState(() => props.group.api.isMaximized());
  useEffect(() => {
    const sync = () => setMaximized(props.group.api.isMaximized());
    sync();
    const d = props.containerApi.onDidMaximizedGroupChange(sync);
    return () => d.dispose();
  }, [props.containerApi, props.group]);
  // Default "+": a blank pane with a component picker, as a new active tab.
  function addBlank() {
    const id = `blank-${Math.random().toString(36).slice(2, 6)}`;
    props.containerApi.addPanel({
      id,
      component: "blank",
      title: "new",
      position: { referenceGroup: props.group },
    });
  }
  // Alt/option-click: the old behavior, clone the active panel's component.
  function cloneTab() {
    const active = props.activePanel;
    if (!active) return;
    // The panel's real component name — NOT a substring of its id.
    // (The old `id.split("-")[0]` produced "json"/"tempo" for every
    // hyphenated panel, which isn't a registered component, so + threw
    // for the whole json-* family. Hypergraph observation #3.)
    const component = active.view.contentComponent;
    const newId = `${component}-${Math.random().toString(36).slice(2, 6)}`;
    props.containerApi.addPanel({
      id: newId,
      component,
      title: active.title ?? component,
      position: { referenceGroup: props.group },
    });
    // A cloned json viewer needs its json-bus producer too.
    ensureCompanions(props.containerApi, component);
  }
  function closeGroup() {
    [...props.panels].forEach((p) => p.api.close());
  }
  function popoutGroup() {
    props.containerApi.addPopoutGroup(props.group);
  }
  return (
    <div className="header-actions header-actions--right">
      {maximized && (
        <button
          className="header-btn header-btn--all"
          title="show all panes again"
          onClick={() => props.group.api.exitMaximized()}
        >
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
      <button
        className="header-btn header-btn--popout"
        title="pop out this group into its own window"
        onClick={popoutGroup}
      >
        ⤴
      </button>
      <button
        className="header-btn header-btn--danger"
        title="close all panels in this group"
        onClick={closeGroup}
      >
        ⨯
      </button>
    </div>
  );
}
