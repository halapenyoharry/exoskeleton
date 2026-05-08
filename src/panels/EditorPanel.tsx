import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import "./EditorPanel.css";

// TODO: replace this textarea with @marktext/muya for live-preview markdown.
// Muya 0.2.5 on npm is the latest published but flagged "not for production"
// — leaving the textarea as the working stub until Muya is fork-stabilized
// or swapped for an alternative (milkdown, lexical, codemirror+remark, etc).

export default function EditorPanel() {
  const [path, setPath] = useState<string | null>(null);
  const [text, setText] = useState("# untitled\n\nstart writing.\n");
  const [dirty, setDirty] = useState(false);

  async function openFile() {
    const picked = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
    });
    if (!picked || typeof picked !== "string") return;
    const content = await readTextFile(picked);
    setPath(picked);
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
      setPath(picked);
    }
    await writeTextFile(target, text);
    setDirty(false);
  }

  return (
    <div className="panel-pad panel-pad--editor">
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
    </div>
  );
}
