import { useEffect, useState } from "react";
import { appStorage } from "../../persistence/app-storage";
import "./SettingsPanel.css";

/**
 * A raw JSON editor showing the full app state on disk
 * (~/Library/Application Support/dev.harold.exoskeleton/exoskeleton.json).
 *
 * Allows viewing, editing, and live-applying changes to layout and preferences.
 */
export default function SettingsPanel() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  async function loadFromDisk() {
    const state = await appStorage.load();
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
      await appStorage.save(parsed);
      setDirty(false);
      setError(null);
      window.dispatchEvent(
        new CustomEvent("exoskeleton:state-applied", { detail: parsed }),
      );
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
          title="parse + write state back to disk and apply live"
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
        Edits to workspace layout and preferences take effect live on apply.
      </div>
    </div>
  );
}
