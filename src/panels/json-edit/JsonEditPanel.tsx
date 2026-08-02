import { useEffect, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { indentUnit } from "@codemirror/language";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { setJson, getJson, type JsonValue } from "../../data/json-bus";
import { setActiveDocumentId } from "../../osc/channels";
import { midnightAlaskaExtension, MIDNIGHT_ALASKA } from "./themes/midnight-alaska";
import "./JsonEditPanel.css";

export interface JsonEditParams {
  /** json-bus document id to write into. Defaults to "default". */
  documentId: string;
  /** Active JSON file path if loaded from or saved to disk. */
  filePath?: string;
  /** Debounce window (ms) between editor edits and json-bus publishes. */
  debounceMs: number;
  /** Theme id. "midnight-alaska" is the bundled default. */
  theme: string;
  /** Editor font size (px). */
  fontSize: number;
  /** Enable line wrapping. */
  lineWrapping: boolean;
  /** Indent width in spaces. */
  tabSize: number;
  /** Line-numbers mode. "on" | "off". */
  lineNumbers: "on" | "off";
  /** Auto-format the buffer on paste. */
  formatOnPaste: boolean;
}

export const jsonEditDefaults: JsonEditParams = {
  documentId: "default",
  debounceMs: 250,
  theme: MIDNIGHT_ALASKA,
  fontSize: 13,
  lineWrapping: true,
  tabSize: 2,
  lineNumbers: "on",
  formatOnPaste: true,
};

function initialValue(documentId: string): string {
  const fromBus = getJson(documentId);
  if (fromBus === undefined) return "";
  try {
    return JSON.stringify(fromBus, null, 2);
  } catch {
    return "";
  }
}

export default function JsonEditPanel(
  props: IDockviewPanelProps<JsonEditParams>,
) {
  const rawParams = props.params ?? {};
  // Handle layout migration gracefully if saved params carry legacy keys
  const params: JsonEditParams = {
    ...jsonEditDefaults,
    ...rawParams,
    lineWrapping:
      typeof rawParams.lineWrapping === "boolean"
        ? rawParams.lineWrapping
        : (rawParams as unknown as Record<string, unknown>).wordWrap === "on" || jsonEditDefaults.lineWrapping,
  };

  const [value, setValue] = useState<string>(() =>
    initialValue(params.documentId),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const lastExternalValueRef = useRef<string>(value);

  // Close menu on click outside
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Active tab coordination
  useEffect(() => {
    if (props.api.isActive) {
      setActiveDocumentId(params.documentId);
    }
    const disposable = props.api.onDidActiveChange((e) => {
      if (e.isActive) {
        setActiveDocumentId(params.documentId);
      }
    });
    return () => {
      disposable.dispose();
    };
  }, [props.api, params.documentId]);

  // Mount CodeMirror 6 EditorView
  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      json(),
      midnightAlaskaExtension,
      indentUnit.of(" ".repeat(params.tabSize)),
      EditorState.tabSize.of(params.tabSize),
      EditorView.theme({
        "&": {
          fontSize: `${params.fontSize}px`,
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const docText = update.state.doc.toString();
          lastExternalValueRef.current = docText;
          setValue(docText);
        }
      }),
      EditorView.domEventHandlers({
        paste(event, view) {
          if (!params.formatOnPaste) return false;
          const text = event.clipboardData?.getData("text/plain");
          if (!text) return false;
          try {
            const parsed = JSON.parse(text);
            const formatted = JSON.stringify(parsed, null, params.tabSize);
            event.preventDefault();
            view.dispatch(view.state.replaceSelection(formatted));
            return true;
          } catch {
            return false;
          }
        },
      }),
    ];

    if (params.lineNumbers !== "off") {
      extensions.push(lineNumbers());
    }
    if (params.lineWrapping) {
      extensions.push(EditorView.lineWrapping);
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
    // Recreate EditorView when key settings change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.fontSize,
    params.lineWrapping,
    params.tabSize,
    params.lineNumbers,
    params.formatOnPaste,
  ]);

  // Sync external value changes into CodeMirror without echo loops
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    if (value !== lastExternalValueRef.current) {
      lastExternalValueRef.current = value;
      const currentDoc = view.state.doc.toString();
      if (currentDoc !== value) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
        });
      }
    }
  }, [value]);

  // On mount, restore file content if filePath param exists
  useEffect(() => {
    const initialPath = rawParams.filePath;
    if (initialPath && typeof initialPath === "string") {
      setFilePath(initialPath);
      readTextFile(initialPath)
        .then((content) => {
          setValue(content);
        })
        .catch((err) => {
          console.warn("[json-edit] failed to restore file:", initialPath, err);
        });
    }
  }, []);

  async function openFile() {
    setMenuOpen(false);
    try {
      const picked = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!picked || typeof picked !== "string") return;
      const content = await readTextFile(picked);
      setFilePath(picked);
      setValue(content);
      props.api.updateParameters({ ...params, filePath: picked });
    } catch (err) {
      console.error("[json-edit] failed to open file:", err);
    }
  }

  async function saveFile() {
    setMenuOpen(false);
    let target = filePath;
    if (!target) {
      const picked = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!picked) return;
      target = picked;
      setFilePath(picked);
      props.api.updateParameters({ ...params, filePath: picked });
    }
    try {
      await writeTextFile(target, value);
    } catch (err) {
      console.error("[json-edit] failed to save file:", err);
    }
  }

  async function saveFileAs() {
    setMenuOpen(false);
    try {
      const picked = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!picked) return;
      setFilePath(picked);
      props.api.updateParameters({ ...params, filePath: picked });
      await writeTextFile(picked, value);
    } catch (err) {
      console.error("[json-edit] failed to save file as:", err);
    }
  }

  // Persist params to the dockview layout file so they survive a reload.
  useEffect(() => {
    props.api.updateParameters({
      ...params,
      ...(filePath ? { filePath } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.documentId,
    params.debounceMs,
    params.theme,
    params.fontSize,
    params.lineWrapping,
    params.tabSize,
    params.lineNumbers,
    params.formatOnPaste,
    filePath,
    props.api,
  ]);

  // Debounced publish to json-bus.
  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      if (value.trim() === "") {
        setParseError(null);
        return;
      }
      try {
        const parsed = JSON.parse(value) as JsonValue;
        setJson(params.documentId, parsed);
        setParseError(null);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : String(err));
      }
    }, params.debounceMs);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [value, params.documentId, params.debounceMs]);

  // Extract just the filename to show in the header for cleanliness
  const displayFileName = filePath
    ? filePath.split(/[/\\]/).pop()
    : null;

  return (
    <>
      <div className="panel-header">
        <div className="json-edit-header-container">
          <div style={{ display: "flex", alignItems: "center" }}>
            <span>json-edit</span>
            <span className="json-edit-doc-id"> · {params.documentId}</span>
            {displayFileName && (
              <span className="json-edit-filepath-indicator" title={filePath ?? ""}>
                ({displayFileName})
              </span>
            )}
            {parseError && (
              <span className="json-edit-parse-error" title={parseError}>
                ⚠ JSON parse error
              </span>
            )}
          </div>
          <div className="json-edit-menu-wrapper" ref={menuRef}>
            <button
              className="json-edit-hamburger-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              title="File Actions"
            >
              ☰
            </button>
            {menuOpen && (
              <div className="json-edit-dropdown">
                <button className="json-edit-dropdown-item" onClick={openFile}>
                  Open File <span>⌘O</span>
                </button>
                <button className="json-edit-dropdown-item" onClick={saveFile}>
                  Save File <span>⌘S</span>
                </button>
                <button className="json-edit-dropdown-item" onClick={saveFileAs}>
                  Save As... <span>⌥⌘S</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="panel-body json-edit-body" ref={containerRef} />
    </>
  );
}
