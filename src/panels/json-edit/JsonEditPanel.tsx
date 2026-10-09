import { useCallback, useEffect, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState, EditorSelection, Prec } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { json } from "@codemirror/lang-json";
import { indentUnit } from "@codemirror/language";
import {
  deleteJson,
  getJson,
  getJsonMeta,
  listJson,
  onJsonChange,
  onJsonListChange,
  setJson,
  uniqueJsonId,
  updateJsonMeta,
  type DocEntry,
  type JsonValue,
} from "../../data/json-bus";
import {
  getActiveDocumentId,
  onActiveDocumentIdChange,
  onNodeSelectionBroadcast,
  setActiveDocumentId,
} from "../../osc/channels";
import {
  copyText,
  errorText,
  fileNameFor,
  inTauri,
  openTextFiles,
  readTextFileAt,
  saveTextFile,
} from "../../utils/file-io";
import { useFlash } from "../../utils/useFlash";
import { midnightAlaskaExtension, MIDNIGHT_ALASKA } from "./themes/midnight-alaska";
import "./JsonEditPanel.css";

export interface JsonEditParams {
  /** json-bus document this panel edits (when not following the active one). */
  documentId: string;
  /** Edit whichever document is active (picked here, in the library, or
   *  pushed by topology-extract). Off = stay on `documentId`. */
  followActive: boolean;
  /** Legacy: path of a backing file, from before the bus kept documents.
   *  Read once on mount (desktop app) into an empty document. */
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
  followActive: true,
  debounceMs: 250,
  theme: MIDNIGHT_ALASKA,
  fontSize: 13,
  lineWrapping: true,
  tabSize: 2,
  lineNumbers: "on",
  formatOnPaste: true,
};

const JSON_FILTERS = [{ name: "JSON", extensions: ["json"] }];

function textFor(documentId: string, tabSize: number): string {
  const fromBus = getJson(documentId);
  if (fromBus === undefined) return "";
  try {
    return JSON.stringify(fromBus, null, tabSize);
  } catch {
    return "";
  }
}

function kb(text: string): string {
  return `${Math.max(1, Math.round(text.length / 1024)).toLocaleString()} KB`;
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

  // Start on the document this panel last had open (saved in its params);
  // the mount effect below reconciles it with the active document.
  const [docId, setDocId] = useState<string>(() => params.documentId);
  const [value, setValue] = useState<string>(() =>
    textFor(docId, params.tabSize),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocEntry[]>(() => listJson());
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { flash, show, clear } = useFlash();

  // Refs read by callbacks that outlive a render (debounce timer, keymap).
  const docIdRef = useRef(docId);
  const valueRef = useRef(value);
  valueRef.current = value;
  // Text that came from the bus: publishing it again would be an echo.
  const fromBusTextRef = useRef(value);
  // The last object this panel published, to recognise its own echo.
  const lastPublishedRef = useRef<JsonValue | undefined>(undefined);
  const debounceRef = useRef<number | null>(null);

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
        setConfirmDelete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Publish the buffer now. Returns false if it doesn't parse.
  const publish = useCallback((): boolean => {
    const text = valueRef.current;
    if (text === fromBusTextRef.current || text.trim() === "") {
      setParseError(null);
      return true;
    }
    try {
      const parsed = JSON.parse(text) as JsonValue;
      lastPublishedRef.current = parsed;
      fromBusTextRef.current = text;
      setJson(docIdRef.current, parsed);
      setParseError(null);
      return true;
    } catch (err) {
      setParseError(errorText(err));
      return false;
    }
  }, []);

  // Move this editor to another document, publishing pending edits first.
  const switchTo = useCallback(
    (id: string) => {
      if (id === docIdRef.current) return;
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      publish();
      docIdRef.current = id;
      const text = textFor(id, params.tabSize);
      fromBusTextRef.current = text;
      lastPublishedRef.current = undefined;
      setDocId(id);
      setValue(text);
      setParseError(null);
      setRenaming(null);
      setConfirmDelete(false);
    },
    [publish, params.tabSize],
  );

  // Pick a document here: make it active so the viewers follow too.
  const selectDoc = useCallback(
    (id: string) => {
      switchTo(id);
      setActiveDocumentId(id);
    },
    [switchTo],
  );

  // Follow the active document (set by the library picker, other editors,
  // or topology-extract's push).
  useEffect(() => {
    if (!params.followActive) return;
    return onActiveDocumentIdChange((id) => switchTo(id));
  }, [params.followActive, switchTo]);

  // On mount: if another panel already chose an active document, follow it;
  // otherwise (a fresh launch) reopen this panel's last document and make it
  // active, so a reload lands where you left off.
  useEffect(() => {
    if (!params.followActive) return;
    const active = getActiveDocumentId();
    if (active !== "default" && active !== docIdRef.current) switchTo(active);
    else setActiveDocumentId(docIdRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focusing this editor makes its document the active one.
  useEffect(() => {
    if (props.api.isActive) {
      setActiveDocumentId(docIdRef.current);
    }
    const disposable = props.api.onDidActiveChange((e) => {
      if (e.isActive) {
        setActiveDocumentId(docIdRef.current);
      }
    });
    return () => {
      disposable.dispose();
    };
  }, [props.api]);

  // Show changes other panels publish to this document.
  useEffect(() => {
    return onJsonChange(docId, (incoming) => {
      if (incoming === lastPublishedRef.current) return; // our own echo
      let text: string;
      try {
        text = JSON.stringify(incoming, null, params.tabSize);
      } catch {
        return;
      }
      fromBusTextRef.current = text;
      setValue(text);
      setParseError(null);
    });
  }, [docId, params.tabSize]);

  // Keep the document picker current.
  useEffect(() => onJsonListChange(() => setDocs(listJson())), []);

  // ── File and clipboard actions ─────────────────────────────────────

  function newDocument() {
    setMenuOpen(false);
    const id = uniqueJsonId("untitled");
    setJson(id, {}, { title: id, source: "json-edit" });
    selectDoc(id);
    show("ok", `New document "${id}"`);
  }

  async function openFiles() {
    setMenuOpen(false);
    try {
      const files = await openTextFiles(JSON_FILTERS, true);
      if (files.length === 0) return;
      const failed: string[] = [];
      let lastId: string | null = null;
      for (const f of files) {
        try {
          const parsed = JSON.parse(f.text) as JsonValue;
          const id = uniqueJsonId(f.name);
          setJson(id, parsed, { title: f.name, source: `file: ${f.name}`, path: f.path });
          lastId = id;
        } catch (err) {
          failed.push(`${f.name} (${errorText(err)})`);
        }
      }
      if (lastId) selectDoc(lastId);
      if (failed.length > 0) {
        show("error", `Not valid JSON: ${failed.join("; ")}`);
      } else {
        show("ok", files.length === 1 ? `Opened ${files[0].name}` : `Opened ${files.length} files`);
      }
    } catch (err) {
      show("error", errorText(err));
    }
  }

  async function saveToFile(saveAs: boolean) {
    setMenuOpen(false);
    const id = docIdRef.current;
    const text = valueRef.current;
    const meta = getJsonMeta(id);
    try {
      const result = await saveTextFile(
        text,
        fileNameFor(meta?.title ?? id, "json"),
        JSON_FILTERS,
        saveAs ? null : meta?.path,
      );
      if (!result) return;
      if (result.method === "dialog") {
        updateJsonMeta(id, { path: result.path });
        show("ok", `Saved to ${result.path}`);
      } else {
        show("ok", `Downloaded ${result.path} (${kb(text)}) — check your Downloads folder`);
      }
    } catch (err) {
      show("error", errorText(err));
    }
  }

  async function copyJson() {
    setMenuOpen(false);
    try {
      await copyText(valueRef.current);
      show("ok", `Copied ${kb(valueRef.current)} to the clipboard`);
    } catch (err) {
      show("error", errorText(err));
    }
  }

  function commitRename() {
    if (renaming === null) return;
    const title = renaming.trim();
    setRenaming(null);
    if (title === "") return;
    if (getJson(docIdRef.current) === undefined) publish();
    updateJsonMeta(docIdRef.current, { title });
  }

  function deleteDocument() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setMenuOpen(false);
    setConfirmDelete(false);
    const id = docIdRef.current;
    const title = getJsonMeta(id)?.title ?? id;
    deleteJson(id);
    const next = listJson()[0]?.id ?? "default";
    fromBusTextRef.current = valueRef.current; // the deleted text must not republish
    selectDoc(next);
    show("ok", `Deleted "${title}"`);
  }

  // Keyboard shortcuts while the editor has focus.
  const actionsRef = useRef({ open: openFiles, save: () => saveToFile(false), saveAs: () => saveToFile(true) });
  actionsRef.current = { open: openFiles, save: () => saveToFile(false), saveAs: () => saveToFile(true) };

  // Mount CodeMirror 6 EditorView. Recreated per document so undo history
  // never crosses documents.
  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      Prec.highest(
        keymap.of([
          { key: "Mod-s", preventDefault: true, run: () => (void actionsRef.current.save(), true) },
          { key: "Mod-Alt-s", preventDefault: true, run: () => (void actionsRef.current.saveAs(), true) },
          { key: "Mod-o", preventDefault: true, run: () => (void actionsRef.current.open(), true) },
        ]),
      ),
      basicSetup,
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
          valueRef.current = docText;
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
      doc: valueRef.current,
      extensions,
    });
    lastExternalValueRef.current = valueRef.current;

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
    docId,
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

  // Subscribe to OSC node selection
  useEffect(() => {
    const unsubscribe = onNodeSelectionBroadcast((evt) => {
      if (evt.documentId !== docId) return;
      const view = editorViewRef.current;
      if (!view) return;
      const docStr = view.state.doc.toString();
      // Try to find the exact id line
      const targetStr = `"id": "${evt.nodeId}"`;
      const pos = docStr.indexOf(targetStr);
      if (pos >= 0) {
        view.dispatch({
          selection: EditorSelection.single(pos, pos + targetStr.length),
          effects: EditorView.scrollIntoView(pos, { y: "center" })
        });
      }
    });
    return () => unsubscribe();
  }, [docId]);

  // Legacy filePath param (desktop app): read once into an empty document.
  useEffect(() => {
    const legacyPath = rawParams.filePath;
    if (!legacyPath || typeof legacyPath !== "string" || !inTauri()) return;
    if (getJson(docIdRef.current) !== undefined) return;
    readTextFileAt(legacyPath)
      .then((content) => {
        const parsed = JSON.parse(content) as JsonValue;
        const name = legacyPath.split(/[/\\]/).pop() ?? legacyPath;
        setJson(docIdRef.current, parsed, { title: name, source: `file: ${name}`, path: legacyPath });
      })
      .catch((err) => show("error", `Could not reopen ${legacyPath}: ${errorText(err)}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist params to the dockview layout file so they survive a reload.
  // filePath is dropped: documents now persist on the bus itself.
  useEffect(() => {
    const { filePath: _legacy, ...rest } = params;
    props.api.updateParameters({ ...rest, documentId: docId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    docId,
    params.followActive,
    params.debounceMs,
    params.theme,
    params.fontSize,
    params.lineWrapping,
    params.tabSize,
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
      debounceRef.current = null;
      publish();
    }, params.debounceMs);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [value, docId, params.debounceMs, publish]);

  const currentMeta = docs.find((d) => d.id === docId)?.meta;
  const pickerEntries: DocEntry[] = currentMeta
    ? docs
    : [{ id: docId, meta: { title: `${docId} (empty)`, createdAt: "", updatedAt: "" } }, ...docs];

  return (
    <>
      <div className="panel-header">
        <div className="json-edit-header-container">
          <div className="json-edit-header-left">
            <span>json-edit</span>
            {renaming !== null ? (
              <input
                className="json-edit-rename"
                autoFocus
                value={renaming}
                onChange={(e) => setRenaming(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenaming(null);
                }}
              />
            ) : (
              <select
                className="json-edit-doc-picker"
                value={docId}
                onChange={(e) => selectDoc(e.target.value)}
                title={currentMeta?.source ? `${docId} · from ${currentMeta.source}` : docId}
              >
                {pickerEntries.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.meta.title}
                    {d.meta.title !== d.id ? `  ·  ${d.id}` : ""}
                  </option>
                ))}
              </select>
            )}
            {parseError && (
              <span className="json-edit-parse-error" title={parseError}>
                ⚠ JSON parse error
              </span>
            )}
            {flash && (
              <span
                className={`json-edit-flash json-edit-flash--${flash.kind}`}
                title="Click to dismiss"
                onClick={clear}
              >
                {flash.kind === "error" ? "⚠ " : "✓ "}
                {flash.text}
              </span>
            )}
          </div>
          <div className="json-edit-menu-wrapper" ref={menuRef}>
            <button
              className="json-edit-hamburger-btn"
              onClick={() => {
                setMenuOpen(!menuOpen);
                setConfirmDelete(false);
              }}
              title="Documents and files"
            >
              ☰
            </button>
            {menuOpen && (
              <div className="json-edit-dropdown">
                <button className="json-edit-dropdown-item" onClick={newDocument}>
                  New document
                </button>
                <button className="json-edit-dropdown-item" onClick={openFiles}>
                  Open file(s)… <span>⌘O</span>
                </button>
                <div className="json-edit-dropdown-sep" />
                <button className="json-edit-dropdown-item" onClick={() => saveToFile(false)}>
                  {inTauri() ? "Save" : "Download"} <span>⌘S</span>
                </button>
                {inTauri() && (
                  <button className="json-edit-dropdown-item" onClick={() => saveToFile(true)}>
                    Save As… <span>⌥⌘S</span>
                  </button>
                )}
                <button className="json-edit-dropdown-item" onClick={copyJson}>
                  Copy JSON
                </button>
                <div className="json-edit-dropdown-sep" />
                <button
                  className="json-edit-dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    setRenaming(currentMeta?.title ?? docId);
                  }}
                >
                  Rename…
                </button>
                <button
                  className={`json-edit-dropdown-item ${confirmDelete ? "json-edit-dropdown-item--danger" : ""}`}
                  onClick={deleteDocument}
                >
                  {confirmDelete ? "Click again to delete" : "Delete document"}
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
