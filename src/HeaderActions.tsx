import type { IDockviewHeaderActionsProps } from "dockview";
import { panelAccent } from "./ColoredTab";
import { ensureCompanions } from "./persistence/default-layout";
import "./HeaderActions.css";

/**
 * prefixHeaderActionsComponent — renders BEFORE the tabs in the header bar.
 * Demo: a small colored dot that mirrors the active panel's accent color.
 * Shows the slot exists and that you can read the group's active panel.
 */
export function PrefixHeaderActions(props: IDockviewHeaderActionsProps) {
  // panelAccent resolves the id (clone-aware: "json-tree-x3f9" → the
  // json-tree accent). "inherit" means unknown — render transparent.
  const accent = props.activePanel ? panelAccent(props.activePanel.id) : "inherit";
  return (
    <div className="header-actions header-actions--prefix">
      <span
        className="header-dot"
        style={{ background: accent === "inherit" ? "transparent" : accent }}
      />
    </div>
  );
}

/**
 * leftHeaderActionsComponent — renders to the right of the tabs, left of the right-actions slot.
 * Demo: a "+ tab" button that adds another panel of the active panel's type as a tab.
 * Shows: per-group action, access to activePanel and containerApi, programmatic addPanel.
 */
export function LeftHeaderActions(props: IDockviewHeaderActionsProps) {
  function addTab() {
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
  return (
    <div className="header-actions header-actions--left">
      <button className="header-btn" title="add another tab of this type" onClick={addTab}>
        +
      </button>
    </div>
  );
}

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
  function closeGroup() {
    [...props.panels].forEach((p) => p.api.close());
  }
  function popoutGroup() {
    props.containerApi.addPopoutGroup(props.group);
  }
  return (
    <div className="header-actions header-actions--right">
      <button
        className="header-btn"
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
