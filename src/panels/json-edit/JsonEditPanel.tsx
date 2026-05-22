import { useEffect, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import MonacoEditor from "@monaco-editor/react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { setJson, getJson, setActiveDocumentId, type JsonValue } from "../../data/json-bus";
import { midnightAlaska, MIDNIGHT_ALASKA } from "./themes/midnight-alaska";
import "./JsonEditPanel.css";

export interface JsonEditParams {
  /** json-bus document id to write into. Defaults to "default". */
  documentId: string;
  /** Debounce window (ms) between editor edits and json-bus publishes. */
  debounceMs: number;
  /** Monaco theme id. "midnight-alaska" is the bundled default. */
  theme: string;
  /** Editor font size (px). */
  fontSize: number;
  /** Word wrap mode: "on" | "off" | "bounded" | "wordWrapColumn". */
  wordWrap: "on" | "off" | "bounded" | "wordWrapColumn";
  /** Indent width in spaces. */
  tabSize: number;
  /** Show / hide Monaco's minimap. */
  minimap: boolean;
  /** Line-numbers mode. "on" | "off" | "relative" | "interval". */
  lineNumbers: "on" | "off" | "relative" | "interval";
  /** Auto-format the buffer on paste. */
  formatOnPaste: boolean;
}

export const jsonEditDefaults: JsonEditParams = {
  documentId: "default",
  debounceMs: 250,
  theme: MIDNIGHT_ALASKA,
  fontSize: 13,
  wordWrap: "on",
  tabSize: 2,
  minimap: false,
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
  const params: JsonEditParams = {
    ...jsonEditDefaults,
    ...(props.params ?? {}),
  };

  const [value, setValue] = useState<string>(() =>
    initialValue(params.documentId),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);

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
      await writeTextFile(picked, value);
    } catch (err) {
      console.error("[json-edit] failed to save file as:", err);
    }
  }

  // Persist params to the dockview layout file so they survive a reload.
  useEffect(() => {
    props.api.updateParameters(params);
    // intentionally omitting `params` from deps — params object identity
    // changes on every render, but its contents are stable across renders
    // unless something below updates them. updateParameters is idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.documentId,
    params.debounceMs,
    params.theme,
    params.fontSize,
    params.wordWrap,
    params.tabSize,
    params.minimap,
    params.lineNumbers,
    params.formatOnPaste,
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
      <div className="panel-body json-edit-body">
        <MonacoEditor
          language="json"
          value={value}
          onChange={(v) => setValue(v ?? "")}
          theme={params.theme}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme(MIDNIGHT_ALASKA, midnightAlaska);
          }}
          options={{
            minimap: { enabled: params.minimap },
            fontSize: params.fontSize,
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: params.tabSize,
            wordWrap: params.wordWrap,
            lineNumbers: params.lineNumbers,
            padding: { top: 12 },
            renderLineHighlight: "gutter",
            guides: {
              indentation: true,
              bracketPairs: true,
            },
            bracketPairColorization: { enabled: true },
            formatOnPaste: params.formatOnPaste,
          }}
        />
      </div>
    </>
  );
}
