import { useEffect, useState } from "react";
import { tauriStorage } from "../../persistence/tauri-storage";
import "./SettingsPanel.css";

/**
 * A raw JSON editor showing the full app state on disk
 * (~/Library/Application Support/dev.harold.exoskeleton/exoskeleton.json).
 *
 * MVP scope: refresh + apply. The user can read, edit, and apply changes
 * to layout, sideGrid, and preferences. Invalid JSON shows an error; apply
 * is disabled until JSON parses. Future iteration: a friendlier preferences-
 * focused UI for non-developers, plus live sync of the editor when state
 * changes from elsewhere (currently you hit Refresh).
 */
export default function SettingsPanel() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  async function loadFromDisk() {
    const state = await tauriStorage.load();
    setText(JSON.stringify(state ?? {}, null, 2));
    setError(null);
    setDirty(false);
  }

  useEffect(() => {
    loadFromDisk();
  }, []);

  function onChange(next: string) {
    setText(next);
    setDirty(true);
    try {
      JSON.parse(next);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function apply() {
    try {
      const parsed = JSON.parse(text);
      await tauriStorage.save(parsed);
      setDirty(false);
      setError(null);
      // Note: the main grid won't re-render to reflect layout changes
      // automatically — those are read on app startup. For now, mention
      // the need to relaunch in the hint area.
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel__toolbar">
        <button onClick={loadFromDisk} title="reread state from disk">
          refresh
        </button>
        <button
          onClick={apply}
          disabled={!dirty || error !== null}
          title="parse + write state back to disk"
        >
          apply
        </button>
        <span className="settings-panel__status">
          {error ? (
            <span className="settings-panel__error">{error}</span>
          ) : dirty ? (
            <span className="settings-panel__dirty">unsaved</span>
          ) : (
            <span className="settings-panel__clean">in sync</span>
          )}
        </span>
      </div>
      <textarea
        className="settings-panel__textarea"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      <div className="settings-panel__hint">
        layout changes apply on next launch. preferences changes apply immediately on next render.
      </div>
    </div>
  );
}
