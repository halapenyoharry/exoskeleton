import { useEffect, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import {
  errorText,
  fileNameFor,
  inTauri,
  openTextFiles,
  readTextFileAt,
  saveTextFile,
} from "../utils/file-io";
import { useFlash } from "../utils/useFlash";
import "./EditorPanel.css";

// TODO: replace this textarea with @marktext/muya for live-preview markdown.
// Muya 0.2.5 on npm is the latest published but flagged "not for production"
// — leaving the textarea as the working stub until Muya is fork-stabilized
// or swapped for an alternative (milkdown, lexical, codemirror+remark, etc).

/** Persisted via Dockview params (same pattern as LanWebview's url):
 *  the open file's PATH survives restarts; unsaved buffer contents don't. */
export interface EditorParams {
  filePath?: string;
}

export default function EditorPanel(props: IDockviewPanelProps<EditorParams>) {
  const [path, setPath] = useState<string | null>(null);
  const [text, setText] = useState("# untitled\n\nstart writing.\n");
  const [dirty, setDirty] = useState(false);
  const { flash, show, clear } = useFlash();

  // Reopen the persisted file on mount. If it's gone (moved/deleted),
  // fall back to the untitled buffer and drop the stale param.
  useEffect(() => {
    const initial = props.params?.filePath;
    if (!initial || !inTauri()) return;
    readTextFileAt(initial)
      .then((content) => {
        setPath(initial);
        setText(content);
        setDirty(false);
      })
      .catch((e) => {
        show("error", `Couldn't reopen ${initial}: ${errorText(e)}`);
        props.api.updateParameters({ filePath: undefined });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rememberPath(picked: string) {
    setPath(picked);
    props.api.updateParameters({ filePath: picked });
  }

  async function openFile() {
    try {
      const [file] = await openTextFiles([
        { name: "Markdown", extensions: ["md", "markdown", "txt"] },
      ]);
      if (!file) return;
      if (file.path) rememberPath(file.path);
      else setPath(file.name);
      setText(file.text);
      setDirty(false);
      show("ok", `Opened ${file.name}`);
    } catch (err) {
      show("error", errorText(err));
    }
  }

  async function saveFile() {
    try {
      const result = await saveTextFile(
        text,
        fileNameFor(path?.split(/[/\\]/).pop() ?? "untitled", "md"),
        [{ name: "Markdown", extensions: ["md"] }],
        inTauri() ? path : null,
      );
      if (!result) return;
      if (result.method === "dialog") rememberPath(result.path);
      setDirty(false);
      show("ok", result.method === "dialog" ? `Saved to ${result.path}` : `Downloaded ${result.path}`);
    } catch (err) {
      show("error", errorText(err));
    }
  }

  // Pure content — the host wraps this in PanelRoot via exoPanel().
  return (
    <>
      <div className="panel-header">editor</div>
      <div className="panel-toolbar">
        <button onClick={openFile}>open</button>
        <button onClick={saveFile} disabled={!dirty && !!path}>
          save
        </button>
        <span style={{ flex: 1, color: "#4a6a78", fontStyle: dirty ? "italic" : "normal" }}>
          {path ?? "untitled"}{dirty ? " •" : ""}
        </span>
        {flash && (
          <span
            onClick={clear}
            title="Click to dismiss"
            style={{ cursor: "pointer", color: flash.kind === "error" ? "#ff6b6b" : "#7ee2a8" }}
          >
            {flash.kind === "error" ? "⚠ " : "✓ "}
            {flash.text}
          </span>
        )}
      </div>
      <textarea
        className="editor-textarea"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        spellCheck={false}
      />
    </>
  );
}
