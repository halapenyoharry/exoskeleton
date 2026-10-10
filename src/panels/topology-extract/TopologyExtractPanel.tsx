import { useCallback, useEffect, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import { setJson, uniqueJsonId, type JsonValue } from "../../data/json-bus";
import { setActiveDocumentId } from "../../osc/channels";
import {
  copyText,
  errorText,
  fileNameFor,
  inTauri,
  openTextFiles,
  readClipboardText,
  saveTextFile,
} from "../../utils/file-io";
import { useFlash } from "../../utils/useFlash";
import { DEFAULT_SYSTEM_PROMPT, estimateTokens } from "./prompts";
import {
  DEFAULT_OLLAMA_HOST,
  ollamaChat,
  ollamaListModels,
  openRouterChat,
  type ChatFn,
} from "./transport";
import {
  chunkSource,
  extractIteratively,
  findDivisions,
  type ExtractOutcome,
  type PassRecord,
} from "./extract";
import { projectRelations } from "./project";
import { runLocalInfo2TopoCli } from "./local-cli";
import type { EdgeCategory, TopoDocument } from "../json-dyadic/types";
import "./TopologyExtractPanel.css";

// ── Provider vocabulary ──────────────────────────────────────────────
type ProviderId = "openrouter" | "ollama" | "local-cli";

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "openrouter", label: "OpenRouter" },
  { id: "ollama", label: "Ollama (local network)" },
  { id: "local-cli", label: "Local CLI (desktop app)" },
];

const DEFAULT_MODEL = "google/gemini-2.5-flash";
const DEFAULT_OLLAMA_MODEL = "gemma4:latest";
const CONTEXT_SIZES = [16384, 32768, 65536, 131072];

// ── Persisted params ─────────────────────────────────────────────────
export interface TopologyExtractParams {
  /** Selected provider id. */
  provider: ProviderId;
  /** Model slug (for OpenRouter). */
  model: string;
  /** API key (stored in panel params — stripped on workspace export). */
  apiKey: string;
  /** Ollama host, e.g. http://100.66.0.3:11434. */
  ollamaHost: string;
  /** Ollama model name. */
  ollamaModel: string;
  /** Ollama context window (num_ctx). Constant per run; changing it reloads the model. */
  numCtx: number;
  /** Follow-up passes per part after the first, per provider. */
  openrouterFollowUps: number;
  ollamaFollowUps: number;
  /** Max characters per part, per provider (0 = whole source at once). */
  openrouterChunkChars: number;
  ollamaChunkChars: number;
  /** Custom system prompt override. Empty string = use default. */
  systemPrompt: string;
  /** Push the result into the document library when extraction ends. */
  autoPush: boolean;
  /** CLI adapter to run for local-cli */
  adapter: string;
}

export const topologyExtractDefaults: TopologyExtractParams = {
  provider: "openrouter",
  model: DEFAULT_MODEL,
  apiKey: "",
  ollamaHost: DEFAULT_OLLAMA_HOST,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  numCtx: 32768,
  openrouterFollowUps: 0,
  ollamaFollowUps: 6,
  openrouterChunkChars: 16000,
  ollamaChunkChars: 6000,
  systemPrompt: "",
  autoPush: true,
  adapter: "extract",
};

// ── Result shape ─────────────────────────────────────────────────────
interface RunResult {
  document: TopoDocument;
  json: string;
  outcome?: ExtractOutcome;
}

interface Progress {
  chunk: number;
  chunkCount: number;
  pass: number;
  passCount: number;
  passLabel: string;
  tokens: number;
  totalNodes: number;
  totalRelations: number;
}

// ── Category stat helpers ────────────────────────────────────────────
interface CategoryCounts {
  containment: number;
  state_change: number;
  interactivity: number;
  reference: number;
  unknown: number;
}

/** Ids of kind:"hyperedge" nodes; links whose source is one are spokes. */
function hyperedgeIds(doc: TopoDocument): Set<string> {
  return new Set(doc.nodes.filter((n) => n.kind === "hyperedge").map((n) => n.id));
}

// Counts relations, not rows: each hyperedge once (its spokes inherit its
// category and carry no attrs), plus each plain dyadic link.
function countCategories(doc: TopoDocument): CategoryCounts {
  const counts: CategoryCounts = {
    containment: 0,
    state_change: 0,
    interactivity: 0,
    reference: 0,
    unknown: 0,
  };
  const tally = (cat: unknown) => {
    if (typeof cat === "string" && cat in counts) {
      counts[cat as EdgeCategory]++;
    } else {
      counts.unknown++;
    }
  };
  const spokeSources = hyperedgeIds(doc);
  for (const node of doc.nodes) {
    if (node.kind === "hyperedge") tally(node.attrs?.["i2t:edge_category"]);
  }
  for (const link of doc.links) {
    if (!spokeSources.has(link.source)) tally(link.attrs?.["i2t:edge_category"]);
  }
  return counts;
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function kb(text: string): string {
  return `${Math.max(1, Math.round(text.length / 1024)).toLocaleString()} KB`;
}

function passLine(p: PassRecord, chunkCount: number): string {
  const part = chunkCount > 1 ? `part ${p.chunk + 1}/${chunkCount} · ` : "";
  const kind = p.kind === "first" ? "first pass" : p.kind;
  if (p.error) return `${part}${kind}: ✗ ${p.error}`;
  return `${part}${kind}: +${p.newNodes} nodes, +${p.newRelations} relations (${(p.ms / 1000).toFixed(0)}s)`;
}

// ── Component ────────────────────────────────────────────────────────
export default function TopologyExtractPanel(
  props: IDockviewPanelProps<TopologyExtractParams>,
) {
  const params: TopologyExtractParams = {
    ...topologyExtractDefaults,
    ...(props.params ?? {}),
  };
  // Saved layouts may carry the retired "direct-api" placeholder.
  if (!PROVIDERS.some((p) => p.id === params.provider)) params.provider = "openrouter";

  const [p, setP] = useState<TopologyExtractParams>(params);
  const set = <K extends keyof TopologyExtractParams>(key: K, value: TopologyExtractParams[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  const [showKey, setShowKey] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [sourceFile, setSourceFile] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  // Extraction state
  const [extracting, setExtracting] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [progress, setProgress] = useState<Progress | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushedId, setPushedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { flash, show, clear } = useFlash(6000);

  const systemPrompt = p.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  // Persist params whenever they change
  useEffect(() => {
    props.api.updateParameters(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, props.api]);

  // Tick the elapsed clock while a run is going.
  useEffect(() => {
    if (!extracting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [extracting]);

  const refreshOllamaModels = useCallback(async () => {
    try {
      const models = await ollamaListModels(p.ollamaHost);
      setOllamaModels(models);
      show("ok", `${models.length} models on ${p.ollamaHost}`);
    } catch (err) {
      show("error", `Could not list models: ${errorText(err)}`);
    }
  }, [p.ollamaHost, show]);

  useEffect(() => {
    if (p.provider === "ollama" && ollamaModels.length === 0) void refreshOllamaModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.provider]);

  const pushToLibrary = useCallback(
    (doc: TopoDocument, existingId: string | null): string => {
      const title =
        (typeof doc.metadata?.title === "string" && doc.metadata.title) || "Extracted topology";
      const model =
        typeof doc.metadata?.model === "string" ? doc.metadata.model : "unknown model";
      const id = existingId ?? uniqueJsonId(`extract-${title}`);
      setJson(id, doc as unknown as JsonValue, { title, source: `topology-extract · ${model}` });
      setActiveDocumentId(id);
      setPushedId(id);
      return id;
    },
    [],
  );

  const followUps = p.provider === "ollama" ? p.ollamaFollowUps : p.openrouterFollowUps;
  const chunkChars = p.provider === "ollama" ? p.ollamaChunkChars : p.openrouterChunkChars;
  const modelLabel = p.provider === "ollama" ? p.ollamaModel : p.provider === "openrouter" ? p.model : `i2t_cli ${p.adapter}`;

  async function handleExtract() {
    if (extracting) {
      abortRef.current?.abort();
      return;
    }

    setError(null);
    setResult(null);
    setPushedId(null);
    setLog([]);
    setProgress(null);
    clear();
    setExtracting(true);
    const started = Date.now();
    setStartedAt(started);
    setNow(started);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (p.provider === "local-cli") {
        if (!inTauri()) {
          throw new Error("The Local CLI provider only works in the desktop app.");
        }
        const input = sourceFile
          ? { type: "file" as const, path: sourceFile }
          : { type: "text" as const, data: sourceText };
        const doc = (await runLocalInfo2TopoCli(
          input,
          { apiKey: p.apiKey, model: p.model, adapter: p.adapter },
          (msg) => setLog((prev) => [...prev, msg].slice(-100)),
        )) as TopoDocument;
        doc.metadata = { ...(doc.metadata ?? {}), extracted_at: new Date().toISOString(), model: modelLabel };
        finish({ document: doc, json: JSON.stringify(doc, null, 2) });
        return;
      }

      const chat: ChatFn =
        p.provider === "ollama"
          ? ollamaChat({ host: p.ollamaHost, model: p.ollamaModel, numCtx: p.numCtx })
          : openRouterChat({ apiKey: p.apiKey, model: p.model });

      const outcome = await extractIteratively({
        chat,
        systemPrompt,
        sourceText,
        chunkChars,
        followUps,
        signal: controller.signal,
        onProgress: (pr) => {
          setProgress({
            chunk: pr.chunk,
            chunkCount: pr.chunkCount,
            pass: pr.pass,
            passCount: pr.passCount,
            passLabel: pr.passLabel,
            tokens: pr.tokens ?? 0,
            totalNodes: pr.totalNodes,
            totalRelations: pr.totalRelations,
          });
          if (pr.finished) {
            const line = passLine(pr.finished, pr.chunkCount);
            setLog((prev) => [...prev, line].slice(-200));
          }
        },
      });

      const document = projectRelations(outcome.document, sourceText);
      const totalCost = outcome.passes.reduce((sum, r) => sum + (r.usage?.cost ?? 0), 0);
      document.metadata = {
        ...(document.metadata ?? {}),
        extracted_at: new Date().toISOString(),
        model: modelLabel,
        "i2t:passes": outcome.passes.length,
        "i2t:parts": outcome.chunkCount,
        ...(totalCost > 0 ? { "i2t:cost_usd": Number(totalCost.toFixed(4)) } : {}),
        ...(outcome.complete ? {} : { "i2t:partial": `${outcome.chunksCompleted} of ${outcome.chunkCount} parts complete` }),
      };
      if (outcome.error) setError(outcome.error);
      const hasContent = outcome.document.relations.length > 1 || outcome.document.nodes.length > 0;
      if (outcome.complete || hasContent) {
        finish({ document, json: JSON.stringify(document, null, 2), outcome });
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setExtracting(false);
      abortRef.current = null;
    }
  }

  function finish(run: RunResult) {
    setResult(run);
    if (p.autoPush) {
      const id = pushToLibrary(run.document, null);
      show("ok", `In the library as "${id}" and now active`);
    }
  }

  async function handleLoadFile() {
    try {
      const [file] = await openTextFiles([
        { name: "Text", extensions: ["txt", "md", "markdown", "json", "csv", "xml", "html"] },
      ]);
      if (!file) return;
      if (p.provider === "local-cli" && file.path) {
        setSourceFile(file.path);
        setSourceText(`[File Mode] Selected for local extraction:\n${file.path}`);
      } else {
        setSourceText(file.text);
        setSourceFile(null);
      }
      show("ok", `Loaded ${file.name} (${kb(file.text)})`);
    } catch (err) {
      show("error", errorText(err));
    }
  }

  async function handlePaste() {
    try {
      const text = await readClipboardText();
      setSourceText(text);
      setSourceFile(null);
      show("ok", `Pasted ${kb(text)}`);
    } catch (err) {
      show("error", errorText(err));
    }
  }

  async function handleCopyJson() {
    if (!result) return;
    try {
      await copyText(result.json);
      show("ok", `Copied ${kb(result.json)} to the clipboard`);
    } catch (err) {
      show("error", errorText(err));
    }
  }

  async function handleSaveJson() {
    if (!result) return;
    const title = typeof result.document.metadata?.title === "string" ? result.document.metadata.title : "topology";
    try {
      const saved = await saveTextFile(
        result.json,
        fileNameFor(`${title}.normalized-dyadic`, "json"),
        [{ name: "JSON", extensions: ["json"] }],
      );
      if (!saved) return;
      show("ok", saved.method === "dialog" ? `Saved to ${saved.path}` : `Downloaded ${saved.path} — check your Downloads folder`);
    } catch (err) {
      show("error", errorText(err));
    }
  }

  function handlePush() {
    if (!result) return;
    const id = pushToLibrary(result.document, pushedId);
    show("ok", `In the library as "${id}" and now active`);
  }

  // ── Derived display values ─────────────────────────────────────────
  const tokenEstimate = estimateTokens(sourceText);
  const partCount =
    p.provider === "local-cli" || sourceText.trim() === ""
      ? 0
      : chunkSource(sourceText, findDivisions(sourceText), chunkChars).length;
  const canExtract =
    (p.provider !== "openrouter" || p.apiKey.trim() !== "") &&
    (sourceText.trim() !== "" || sourceFile !== null);

  const categories = result ? countCategories(result.document) : null;
  const nodeCount = result?.document.nodes.filter((n) => n.kind === "node").length ?? 0;
  const hyperedgeCount = result?.document.nodes.filter((n) => n.kind === "hyperedge").length ?? 0;
  const dyadicLinkCount = result
    ? (() => {
        const spokeSources = hyperedgeIds(result.document);
        return result.document.links.filter((l) => !spokeSources.has(l.source)).length;
      })()
    : 0;
  const meta = result?.document.metadata ?? {};
  const unverified = typeof meta["i2t:evidence_unverified"] === "number" ? (meta["i2t:evidence_unverified"] as number) : 0;
  const warnings = Array.isArray(meta["i2t:extraction_warnings"]) ? (meta["i2t:extraction_warnings"] as string[]) : [];
  const partial = typeof meta["i2t:partial"] === "string" ? (meta["i2t:partial"] as string) : null;

  return (
    <div className="topo-extract-container">
      {/* ── Header: provider + model ─────────────────── */}
      <div className="topo-extract-header">
        <label>
          Provider
          <select
            value={p.provider}
            onChange={(e) => set("provider", e.target.value as ProviderId)}
            disabled={extracting}
          >
            {PROVIDERS.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.label}
              </option>
            ))}
          </select>
        </label>

        {p.provider === "openrouter" && (
          <label>
            Model
            <input
              type="text"
              className="topo-extract-model-input"
              value={p.model}
              onChange={(e) => set("model", e.target.value)}
              placeholder={DEFAULT_MODEL}
              disabled={extracting}
            />
          </label>
        )}

        {p.provider === "ollama" && (
          <>
            <label>
              Host
              <input
                type="text"
                className="topo-extract-model-input"
                value={p.ollamaHost}
                onChange={(e) => set("ollamaHost", e.target.value)}
                placeholder={DEFAULT_OLLAMA_HOST}
                disabled={extracting}
              />
            </label>
            <label>
              Model
              <input
                type="text"
                list="topo-extract-ollama-models"
                className="topo-extract-model-input"
                value={p.ollamaModel}
                onChange={(e) => set("ollamaModel", e.target.value)}
                placeholder={DEFAULT_OLLAMA_MODEL}
                disabled={extracting}
              />
              <datalist id="topo-extract-ollama-models">
                {ollamaModels.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
            <button
              className="topo-extract-source-btn"
              onClick={() => void refreshOllamaModels()}
              title="List the models installed on this host"
              disabled={extracting}
            >
              ↻ models
            </button>
          </>
        )}

        {p.provider === "local-cli" && (
          <label>
            Adapter
            <select
              value={p.adapter}
              onChange={(e) => set("adapter", e.target.value)}
              className="topo-extract-model-input"
              style={{ width: "140px" }}
            >
              <option value="extract">Generic Prose (extract)</option>
              <option value="manuscript">Manuscript Pipeline</option>
              <option value="propgraph">Property Graph</option>
            </select>
          </label>
        )}
      </div>

      {/* ── API key row ──────────────────────────────── */}
      {p.provider === "openrouter" && (
        <div className="topo-extract-key-row">
          <label style={{ fontSize: 11, color: "#7e879b", whiteSpace: "nowrap" }}>
            API Key
          </label>
          <input
            className="topo-extract-key-input"
            type={showKey ? "text" : "password"}
            value={p.apiKey}
            onChange={(e) => set("apiKey", e.target.value)}
            placeholder="sk-or-v1-..."
            spellCheck={false}
            autoComplete="off"
          />
          <button
            className="topo-extract-key-toggle"
            onClick={() => setShowKey(!showKey)}
            title={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? "🙈" : "👁"}
          </button>
        </div>
      )}

      {/* ── Depth: parts and passes ───────────────────── */}
      {p.provider !== "local-cli" && (
        <div className="topo-extract-depth-row">
          <label title="After the first pass, each part gets focused follow-up passes (modes, changes and causes, speech, identity), then 'anything missed' sweeps that repeat until one finds nothing new.">
            Follow-up passes
            <input
              type="number"
              min={0}
              max={12}
              value={followUps}
              onChange={(e) =>
                set(
                  p.provider === "ollama" ? "ollamaFollowUps" : "openrouterFollowUps",
                  Math.max(0, Math.min(12, Number(e.target.value) || 0)),
                )
              }
              disabled={extracting}
            />
          </label>
          <label title="Long sources are split at their own scene breaks and headings into parts of at most this many characters. 0 sends the whole source at once.">
            Part size
            <input
              type="number"
              min={0}
              step={1000}
              value={chunkChars}
              onChange={(e) =>
                set(
                  p.provider === "ollama" ? "ollamaChunkChars" : "openrouterChunkChars",
                  Math.max(0, Number(e.target.value) || 0),
                )
              }
              disabled={extracting}
            />
          </label>
          {p.provider === "ollama" && (
            <label title="Context window (num_ctx). Larger fits longer parts but uses more GPU memory.">
              Context
              <select
                value={p.numCtx}
                onChange={(e) => set("numCtx", Number(e.target.value))}
                disabled={extracting}
              >
                {CONTEXT_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n / 1024}k
                  </option>
                ))}
              </select>
            </label>
          )}
          {partCount > 0 && (
            <span className="topo-extract-depth-plan">
              {partCount} part{partCount !== 1 ? "s" : ""} × {1 + followUps} pass
              {1 + followUps !== 1 ? "es" : ""} max
            </span>
          )}
        </div>
      )}

      {/* ── Source input ─────────────────────────────── */}
      <div className="topo-extract-source">
        <textarea
          className="topo-extract-textarea"
          value={sourceText}
          onChange={(e) => {
            setSourceText(e.target.value);
            setSourceFile(null); // Revert to text mode if typing
          }}
          disabled={(sourceFile !== null && p.provider === "local-cli") || extracting}
          placeholder="Paste source text here (⌘V), or load a file — then Extract Topology."
        />
        <div className="topo-extract-source-actions">
          <button className="topo-extract-source-btn" onClick={handleLoadFile} disabled={extracting}>
            📂 Load File
          </button>
          <button className="topo-extract-source-btn" onClick={handlePaste} disabled={extracting}>
            📋 From Clipboard
          </button>
          <span className="topo-extract-token-estimate">
            {sourceText.length > 0
              ? `~${tokenEstimate.toLocaleString()} tokens · ${sourceText.length.toLocaleString()} chars`
              : ""}
          </span>
        </div>
      </div>

      {/* ── Advanced: prompt editor ──────────────────── */}
      <button
        className="topo-extract-advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? "▾ Hide system prompt" : "▸ Edit system prompt"}
      </button>
      {showAdvanced && (
        <div className="topo-extract-prompt-editor">
          <textarea
            className="topo-extract-prompt-textarea"
            value={systemPrompt}
            onChange={(e) =>
              set("systemPrompt", e.target.value === DEFAULT_SYSTEM_PROMPT ? "" : e.target.value)
            }
          />
          {p.systemPrompt !== "" && (
            <button
              className="topo-extract-prompt-reset"
              onClick={() => set("systemPrompt", "")}
            >
              ↺ Reset to default prompt
            </button>
          )}
        </div>
      )}

      {/* ── Extract trigger ──────────────────────────── */}
      <div className="topo-extract-trigger">
        <button
          className={`topo-extract-btn ${extracting ? "topo-extract-btn--cancel" : ""}`}
          disabled={!canExtract && !extracting}
          onClick={handleExtract}
        >
          {extracting ? (
            <>
              <span className="topo-extract-spinner" />
              Cancel
            </>
          ) : (
            "▶ Extract Topology"
          )}
        </button>

        <label className="topo-extract-auto-push">
          <input
            type="checkbox"
            checked={p.autoPush}
            onChange={(e) => set("autoPush", e.target.checked)}
          />
          Add to library when done
        </label>
      </div>

      {/* ── Live progress ─────────────────────────────── */}
      {(extracting || log.length > 0) && (
        <div className="topo-extract-progress">
          {extracting && (
            <div className="topo-extract-progress-now">
              <span className="topo-extract-progress-clock">
                {startedAt !== null ? clock(now - startedAt) : "0:00"}
              </span>
              {progress ? (
                <span>
                  {progress.chunkCount > 1 ? `Part ${progress.chunk + 1} of ${progress.chunkCount} · ` : ""}
                  pass {progress.pass + 1} of {progress.passCount} ({progress.passLabel})
                  {progress.tokens > 0 ? ` · ${progress.tokens.toLocaleString()} tokens` : " · waiting for the model…"}
                  {" · "}
                  {progress.totalNodes} nodes, {progress.totalRelations} relations so far
                </span>
              ) : (
                <span>{p.provider === "local-cli" ? "Running the CLI…" : "Starting…"}</span>
              )}
            </div>
          )}
          {log.length > 0 && (
            <details className="topo-extract-progress-log" open={extracting}>
              <summary>Pass log ({log.length})</summary>
              {log.map((line, i) => (
                <div key={i} className={line.includes("✗") ? "topo-extract-log-error" : ""}>
                  {line}
                </div>
              ))}
            </details>
          )}
        </div>
      )}

      {/* ── Error display ────────────────────────────── */}
      {error && <div className="topo-extract-error">{error}</div>}

      {/* ── Result area ──────────────────────────────── */}
      <div className="topo-extract-result">
        {!result && !error && !extracting && (
          <div className="topo-extract-result-empty">
            No extraction yet. Paste source text and click Extract.
          </div>
        )}
        {result && (
          <div className="topo-extract-result-summary">
            <div className="topo-extract-result-stats">
              <span className={partial ? "error-icon" : "success-icon"}>{partial ? "◐" : "✓"}</span>
              <span>
                {partial ? `Partial (${partial}): ` : ""}
                {nodeCount} node{nodeCount !== 1 ? "s" : ""}
                {hyperedgeCount > 0 && `, ${hyperedgeCount} hyperedge${hyperedgeCount !== 1 ? "s" : ""}`}
                , {dyadicLinkCount} edge
                {dyadicLinkCount !== 1 ? "s" : ""}
                {result.outcome && ` · ${result.outcome.passes.length} passes`}
                {startedAt !== null && ` · ${clock(Date.now() - startedAt)}`}
              </span>
            </div>

            {categories && (
              <div className="topo-extract-categories">
                {categories.containment > 0 && (
                  <span className="topo-extract-cat-pill topo-extract-cat-pill--containment">
                    ◯ {categories.containment} containment
                  </span>
                )}
                {categories.state_change > 0 && (
                  <span className="topo-extract-cat-pill topo-extract-cat-pill--state_change">
                    → {categories.state_change} state_change
                  </span>
                )}
                {categories.interactivity > 0 && (
                  <span className="topo-extract-cat-pill topo-extract-cat-pill--interactivity">
                    ⟷ {categories.interactivity} interactivity
                  </span>
                )}
                {categories.reference > 0 && (
                  <span className="topo-extract-cat-pill topo-extract-cat-pill--reference">
                    ↗ {categories.reference} reference
                  </span>
                )}
                {categories.unknown > 0 && (
                  <span className="topo-extract-cat-pill topo-extract-cat-pill--unknown">
                    ? {categories.unknown} uncategorized
                  </span>
                )}
              </div>
            )}

            {(unverified > 0 || warnings.length > 0) && (
              <div className="topo-extract-quality">
                {unverified > 0 && `${unverified} relation${unverified !== 1 ? "s" : ""} cite evidence not found verbatim in the source. `}
                {warnings.length > 0 && `${warnings.length} projection warning${warnings.length !== 1 ? "s" : ""} (see metadata).`}
              </div>
            )}

            <div className="topo-extract-result-actions">
              <button
                className="topo-extract-result-btn topo-extract-result-btn--primary"
                onClick={handlePush}
                title="Put this result in the document library and make it the active document"
              >
                {pushedId ? "✓ In library — update" : "Add to library ▸"}
              </button>
              <button className="topo-extract-result-btn" onClick={handleCopyJson} title="Copy the JSON">
                Copy JSON
              </button>
              <button className="topo-extract-result-btn" onClick={handleSaveJson} title="Save the JSON to a file">
                {inTauri() ? "Save…" : "Download"}
              </button>
              {result.outcome && result.outcome.passes.some((r) => r.usage?.cost) && (
                <span className="topo-extract-usage">
                  ${result.outcome.passes.reduce((s, r) => s + (r.usage?.cost ?? 0), 0).toFixed(3)}
                </span>
              )}
            </div>

            {pushedId && (
              <div className="topo-extract-pushed">
                In the library as <code>{pushedId}</code>. It is the active document: json-edit and the
                viewers now show it. Switch documents from json-edit's picker.
              </div>
            )}

            <details className="topo-extract-json">
              <summary>JSON ({kb(result.json)})</summary>
              <textarea
                readOnly
                className="topo-extract-json-text"
                value={result.json}
                onFocus={(e) => e.currentTarget.select()}
              />
            </details>
          </div>
        )}
        {flash && (
          <div
            className={`topo-extract-flash topo-extract-flash--${flash.kind}`}
            onClick={clear}
            title="Click to dismiss"
          >
            {flash.kind === "error" ? "⚠ " : "✓ "}
            {flash.text}
          </div>
        )}
      </div>
    </div>
  );
}
