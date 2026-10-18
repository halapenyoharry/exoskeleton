import { useContext, useEffect, useState } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { panelRegistry, addOrFocusPanel } from "../../persistence/default-layout";
import { listWorkspaces } from "../../persistence/storage";
import { panelAccent, panelGlyph } from "../../ColoredTab";
import { WorkspaceActionsContext } from "../../workspace-actions";
import "./AddPanelPanel.css";

/**
 * The panel roster + workspace manager, as an ordinary Dockview panel.
 * Replaces the floating ⊞ button and its popup menu (2026-10-18): same
 * contents, same actions, now living in a tab like everything else.
 */
export default function AddPanelPanel(props: IDockviewPanelProps) {
  const ws = useContext(WorkspaceActionsContext);
  const api = props.containerApi;

  // Re-render on layout changes so the ●/+ open markers stay accurate.
  const [, bump] = useState(0);
  useEffect(() => {
    const d = api.onDidLayoutChange(() => bump((v) => v + 1));
    return () => d.dispose();
  }, [api]);

  const { appState } = ws;

  return (
    <div className="add-panel">
      {appState && (
        <div className="workspace-menu-section">
          <div className="workspace-menu-header">
            <span className="workspace-menu-title">Workspaces</span>
            <div className="workspace-menu-actions">
              <button className="workspace-action-btn" onClick={ws.createWorkspace} title="Create new workspace">
                + New
              </button>
              <button className="workspace-action-btn" onClick={ws.exportWorkspace} title="Export active workspace (.exo.json)">
                Export
              </button>
              <button className="workspace-action-btn" onClick={ws.importWorkspace} title="Import workspace document (.exo.json)">
                Import
              </button>
              <button className="workspace-action-btn" onClick={ws.renameWorkspace} title="Rename active workspace">
                ✎
              </button>
              <button
                className="workspace-action-btn workspace-action-btn--danger"
                onClick={ws.deleteWorkspace}
                title="Delete active workspace"
              >
                🗑
              </button>
            </div>
          </div>
          <div className="workspace-list">
            {listWorkspaces(appState).map((w) => {
              const isActive = w.id === appState.activeWorkspaceId;
              return (
                <button
                  key={w.id}
                  className={`workspace-item ${isActive ? "workspace-item--active" : ""}`}
                  onClick={() => ws.switchWorkspace(w.id)}
                >
                  <span className="workspace-name">{w.name}</span>
                  <div className="workspace-item-controls">
                    <button
                      className="workspace-popout-btn"
                      onClick={(e) => ws.openWorkspaceInNewWindow(w.id, e)}
                      title="Open workspace in new window"
                    >
                      ❐
                    </button>
                    {isActive && <span className="workspace-indicator">●</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="add-panel-divider" />
        </div>
      )}
      <div className="workspace-menu-header">
        <span className="workspace-menu-title">Panels</span>
      </div>
      <div className="add-panel-list">
        {panelRegistry.map((entry) => {
          const open = !!api.getPanel(entry.id);
          return (
            <button key={entry.id} className="add-panel-item" onClick={() => addOrFocusPanel(api, entry.id)}>
              <span className="add-panel-glyph" style={{ color: panelAccent(entry.id) }}>
                {panelGlyph(entry.id)}
              </span>
              <span className="add-panel-name">{entry.id}</span>
              <span className="add-panel-state">{open ? "●" : "+"}</span>
            </button>
          );
        })}
      </div>
      <div className="add-panel-divider" />
      <button className="add-panel-item add-panel-reset" onClick={ws.resetLayout}>
        <span className="add-panel-glyph" style={{ color: "#ff5252" }}>
          ↺
        </span>
        <span className="add-panel-name">Reset layout...</span>
      </button>
    </div>
  );
}
