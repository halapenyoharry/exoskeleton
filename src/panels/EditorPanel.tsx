import { useEffect, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
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

  // Reopen the persisted file on mount. If it's gone (moved/deleted),
  // fall back to the untitled buffer and drop the stale param.
  useEffect(() => {
    const initial = props.params?.filePath;
    if (!initial) return;
    readTextFile(initial)
      .then((content) => {
        setPath(initial);
        setText(content);
        setDirty(false);
      })
      .catch((e) => {
        console.warn(`[exoskeleton] editor: couldn't reopen ${initial}:`, e);
        props.api.updateParameters({ filePath: undefined });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rememberPath(picked: string) {
    setPath(picked);
    props.api.updateParameters({ filePath: picked });
  }

  async function openFile() {
    const picked = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
    });
    if (!picked || typeof picked !== "string") return;
    const content = await readTextFile(picked);
    rememberPath(picked);
    setText(content);
    setDirty(false);
  }

  async function saveFile() {
    let target = path;
    if (!target) {
      const picked = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!picked) return;
      target = picked;
      rememberPath(picked);
    }
    await writeTextFile(target, text);
    setDirty(false);
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
