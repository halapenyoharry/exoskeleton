import { useCallback, useEffect, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview-react";
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
  publishRestoredText,
  uniqueJsonId,
  updateJsonMeta,
  type DocEntry,
  type JsonValue,
} from "../../data/json-bus";
import { openLibraryDocument } from "../../data/library";
import { onPanelMenu } from "../../panel-menu";
import { publishText } from "../../chrome/runtime-options";
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
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { flash, show, clear } = useFlash();
  const [docMenu, setDocMenu] = useState<{ left: number } | null>(null);
  const docsRef = useRef<DocEntry[]>([]);

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
    // Text restored into the editor must also be on the bus for the viewers.
    if (publishRestoredText(docIdRef.current, valueRef.current)) {
      fromBusTextRef.current = valueRef.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A late storage hydrate lands after mount: the bus change handler below
  // updates the text; here we make sure the viewers follow this document.
  useEffect(
    () =>
      onJsonListChange(() => {
        if (!params.followActive) return;
        const id = docIdRef.current;
        if (getJson(id) !== undefined && getActiveDocumentId() === "default" && id !== "default") {
          setActiveDocumentId(id);
        }
      }),
    [params.followActive],
  );

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
    const id = uniqueJsonId("untitled");
    setJson(id, {}, { title: id, source: "json-edit" });
    selectDoc(id);
    show("ok", `New document "${id}"`);
  }

  async function openFromLibrary(entryId: string) {
    try {
      const id = await openLibraryDocument(entryId);
      selectDoc(id);
      show("ok", `Opened "${getJsonMeta(id)?.title ?? id}"`);
    } catch (err) {
      show("error", `Could not open library entry: ${errorText(err)}`);
    }
  }

  async function openFiles() {
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
    try {
      await copyText(valueRef.current);
      show("ok", `Copied ${kb(valueRef.current)} to the clipboard`);
    } catch (err) {
      show("error", errorText(err));
    }
  }

  function formatJson() {
    try {
      const text = JSON.stringify(JSON.parse(valueRef.current), null, params.tabSize);
      if (text !== valueRef.current) setValue(text);
      show("ok", "Formatted");
    } catch {
      show("error", "Can't format: JSON doesn't parse");
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
      show("error", "Click Delete document again to confirm");
      window.setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
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

  // Pill ☰ menu dispatch (items declared in manifest.ts).
  const menuRef = useRef<(itemId: string) => void>(() => {});
  menuRef.current = (itemId) => {
    if (itemId === "new") newDocument();
    else if (itemId === "open") void openFiles();
    else if (itemId === "save") void saveToFile(false);
    else if (itemId === "saveAs") void saveToFile(true);
    else if (itemId === "format") formatJson();
    else if (itemId === "doc") {
      if (docsRef.current.length < 2) return;
      const chip = containerRef.current?.parentElement?.querySelector<HTMLElement>('[data-action-item="doc"]');
      const body = containerRef.current;
      const left = chip && body ? Math.max(0, chip.getBoundingClientRect().left - body.getBoundingClientRect().left) : 8;
      setDocMenu((m) => (m ? null : { left }));
    } else if (itemId === "copy") void copyJson();
    else if (itemId === "rename") setRenaming(getJsonMeta(docIdRef.current)?.title ?? docIdRef.current);
    else if (itemId === "delete") deleteDocument();
    else if (itemId.startsWith("library:")) void openFromLibrary(itemId.slice("library:".length));
  };
  useEffect(
    () => onPanelMenu(props.api.id, (itemId) => menuRef.current(itemId)),
    [props.api.id],
  );

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

  const docLabel = (t?: string) => (t && t.trim() ? t : "untitled");
  const currentMeta = docs.find((d) => d.id === docId)?.meta;
  const pickerEntries: DocEntry[] = currentMeta
    ? docs
    : [{ id: docId, meta: { title: "", createdAt: "", updatedAt: "" } }, ...docs];

  docsRef.current = pickerEntries;
  const docTitle = docLabel(currentMeta?.title);
  useEffect(() => {
    publishText(props.api.id, "doc", docTitle);
    // The tab reads "<panel title> - <document name>" when a document is
    // named — plain Dockview: api.setTitle, nothing drawn by us.
    const base = "JSON Edit";
    const named = currentMeta?.title && currentMeta.title.trim();
    props.api.setTitle(named ? `${base} - ${currentMeta!.title.trim()}` : base);
  }, [props.api, docTitle, currentMeta?.title]);
  useEffect(() => {
    if (!docMenu) return;
    const close = () => setDocMenu(null);
    const t = window.setTimeout(() => window.addEventListener("pointerdown", close, { once: true }), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", close);
    };
  }, [docMenu]);

  return (
    <>
      {(renaming !== null || parseError || flash) && (
        <div className="json-edit-status">
          {renaming !== null && (
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
      )}
      <div className="panel-body json-edit-body" ref={containerRef}>
        {docMenu && (
          <ul className="json-edit-doc-menu" style={{ left: docMenu.left }} onPointerDown={(e) => e.stopPropagation()}>
            {pickerEntries.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className={d.id === docId ? "is-current" : undefined}
                  title={d.id}
                  onClick={() => {
                    setDocMenu(null);
                    selectDoc(d.id);
                  }}
                >
                  {docLabel(d.meta.title)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
