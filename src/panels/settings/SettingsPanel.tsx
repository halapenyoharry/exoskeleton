import { useCallback, useEffect, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { appStorage } from "../../persistence/app-storage";
import "./SettingsPanel.css";

/**
 * A raw JSON editor showing the full app state on disk
 * (~/Library/Application Support/dev.harold.exoskeleton/exoskeleton.json).
 *
 * Allows viewing, editing, and live-applying changes to layout and preferences.
 */
export default function SettingsPanel(props: Partial<IDockviewPanelProps> = {}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const loadFromDisk = useCallback(async () => {
    dirtyRef.current = false;
    const state = await appStorage.load();
    setText(JSON.stringify(state ?? {}, null, 2));
    setError(null);
    setDirty(false);
  }, []);

  const loadIfClean = useCallback(async () => {
    if (dirtyRef.current) return;
    const state = await appStorage.load();
    if (dirtyRef.current) return;
    setText(JSON.stringify(state ?? {}, null, 2));
    setError(null);
    setDirty(false);
  }, []);

  // Re-read whenever the panel mounts, becomes visible, or becomes active
  // (plus after App's 400ms debounced save settles), unless unsaved edits exist.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      void loadIfClean();
      clearTimeout(timer);
      timer = setTimeout(() => void loadIfClean(), 450);
    };
    sync();
    const d1 = props.api?.onDidVisibilityChange((ev) => {
      if (ev.isVisible) sync();
    });
    const d2 = props.api?.onDidActiveChange((ev) => {
      if (ev.isActive) sync();
    });
    return () => {
      clearTimeout(timer);
      d1?.dispose();
      d2?.dispose();
    };
  }, [props.api, loadIfClean]);

  function onChange(next: string) {
    dirtyRef.current = true;
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
      dirtyRef.current = false;
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
