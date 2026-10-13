import type { IDockviewPanelProps } from "dockview";
import { openUrl } from "@tauri-apps/plugin-opener";
import PanelPicker from "../PanelPicker";
import pkg from "../../package.json";
import { useMenuActions } from "./menu-context";
import "./MenuPanel.css";

const REPO_URL = "https://github.com/halapenyoharry/exoskeleton";

const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Menu panel — lives in a Dockview floating group, toggled by the ⊞ button.
 * Add panel, workspaces, export/import, reset, and About.
 */
export default function MenuPanel(_props: IDockviewPanelProps) {
  const m = useMenuActions();
  if (!m) return null;

  return (
    <div className="menu-panel">
      <section className="menu-section">
        <h3 className="menu-heading">Workspaces</h3>
        <div className="menu-list">
          {m.workspaces.map((ws) => (
            <div key={ws.id} className="menu-row-group">
              <button
                className={`menu-row menu-row--grow${ws.id === m.activeWorkspaceId ? " menu-row--active" : ""}`}
                onClick={() => m.switchWorkspace(ws.id)}
              >
                <span className="menu-row-label">{ws.name}</span>
                {ws.id === m.activeWorkspaceId && <span className="menu-row-mark">●</span>}
              </button>
              {inTauri() && (
                <button
                  className="menu-row menu-row--icon"
                  title="Open workspace in new window"
                  onClick={() => m.openWorkspaceInNewWindow(ws.id)}
                >
                  ❐
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="menu-actions">
          <button className="menu-row" onClick={m.createWorkspace}>+ New</button>
          <button className="menu-row" onClick={m.renameWorkspace}>Rename</button>
          <button className="menu-row menu-row--danger" onClick={m.deleteWorkspace}>Delete</button>
        </div>
        <div className="menu-actions">
          <button className="menu-row" onClick={m.exportWorkspace}>Export</button>
          <button className="menu-row" onClick={m.importWorkspace}>Import</button>
        </div>
      </section>

      <section className="menu-section">
        <h3 className="menu-heading">Add panel</h3>
        <PanelPicker variant="list" onPick={m.addPanel} />
      </section>

      {m.phone && (
        <section className="menu-section">
          <h3 className="menu-heading">Deck</h3>
          <button className="menu-row" onClick={m.toggleDeck} aria-pressed={m.deckOptIn}>
            <span className="menu-row-label">One pane at a time</span>
            <span className="menu-row-mark">{m.deckOptIn ? "●" : "○"}</span>
          </button>
          {m.deckMode && (
            <button className="menu-row" onClick={m.toggleStatusBar}>
              <span className="menu-row-label">Status bar</span>
              <span className="menu-row-mark">{m.statusBarVisible ? "●" : "○"}</span>
            </button>
          )}
          <button className="menu-row" onClick={m.toggleSettings}>
            <span className="menu-row-label">Settings</span>
          </button>
        </section>
      )}

      <section className="menu-section">
        <button className="menu-row menu-row--danger" onClick={m.resetLayout}>
          ↺ Reset layout...
        </button>
      </section>

      <section className="menu-section menu-about">
        <h3 className="menu-heading">About</h3>
        <div className="menu-about-line">
          {pkg.name} <span className="menu-dim">v{pkg.version}</span>
        </div>
        <a
          className="menu-row menu-link"
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (inTauri()) {
              e.preventDefault();
              openUrl(REPO_URL).catch((err) => console.error("[exoskeleton] openUrl failed:", err));
            }
          }}
        >
          Source on GitHub
        </a>
        <div className="menu-dim">License: AGPL-3.0-or-later</div>
      </section>
    </div>
  );
}
