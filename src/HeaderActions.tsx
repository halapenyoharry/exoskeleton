import type { IDockviewHeaderActionsProps } from "dockview";
import "./HeaderActions.css";

const accents: Record<string, string> = {
  editor: "var(--accent-editor)",
  terminal: "var(--accent-terminal)",
  webview: "var(--accent-webview)",
};

/**
 * prefixHeaderActionsComponent — renders BEFORE the tabs in the header bar.
 * Demo: a small colored dot that mirrors the active panel's accent color.
 * Shows the slot exists and that you can read the group's active panel.
 */
export function PrefixHeaderActions(props: IDockviewHeaderActionsProps) {
  const activeId = props.activePanel?.id;
  const baseId = activeId?.split("-")[0] ?? "";
  const accent = accents[baseId] ?? "transparent";
  return (
    <div className="header-actions header-actions--prefix">
      <span className="header-dot" style={{ background: accent }} />
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
    const baseId = active.id.split("-")[0];
    const newId = `${baseId}-${Math.random().toString(36).slice(2, 6)}`;
    props.containerApi.addPanel({
      id: newId,
      component: baseId,
      title: baseId,
      position: { referenceGroup: props.group },
    });
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
 * Demo: an × button that closes the entire group (all panels in it).
 * Shows: access to the group api, group-level destructive action.
 */
export function RightHeaderActions(props: IDockviewHeaderActionsProps) {
  function closeGroup() {
    [...props.panels].forEach((p) => p.api.close());
  }
  return (
    <div className="header-actions header-actions--right">
      <button className="header-btn header-btn--danger" title="close all panels in this group" onClick={closeGroup}>
        ⨯
      </button>
    </div>
  );
}
