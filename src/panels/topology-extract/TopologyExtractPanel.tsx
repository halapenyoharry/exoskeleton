import { useCallback, useEffect, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import { setJson, type JsonValue } from "../../data/json-bus";
import { DEFAULT_SYSTEM_PROMPT, estimateTokens } from "./prompts";
import {
  extractTopology,
  ExtractionError,
  type ExtractionResult,
} from "./openrouter";
import { runLocalInfo2TopoCli } from "./local-cli";
import type { EdgeCategory, TopoDocument } from "../json-dyadic/types";
import "./TopologyExtractPanel.css";

// ── Provider vocabulary ──────────────────────────────────────────────
type ProviderId = "openrouter" | "local-cli" | "direct-api";

interface ProviderOption {
  id: ProviderId;
  label: string;
  available: boolean;
}

const PROVIDERS: ProviderOption[] = [
  { id: "openrouter", label: "OpenRouter", available: true },
  { id: "local-cli", label: "Local CLI", available: true },
  { id: "direct-api", label: "Direct API", available: false },
];

const DEFAULT_MODEL = "google/gemini-2.5-flash";

// ── Persisted params ─────────────────────────────────────────────────
export interface TopologyExtractParams {
  /** json-bus document id to write into. Defaults to "default". */
  documentId: string;
  /** Selected provider id. */
  provider: ProviderId;
  /** Model slug (for OpenRouter). */
  model: string;
  /** API key (stored in panel params — stripped on workspace export). */
  apiKey: string;
  /** Custom system prompt override. Empty string = use default. */
  systemPrompt: string;
  /** Auto-push result to json-bus on successful extraction. */
  autoPush: boolean;
  /** CLI adapter to run for local-cli */
  adapter: string;
}

export const topologyExtractDefaults: TopologyExtractParams = {
  documentId: "default",
  provider: "openrouter",
  model: DEFAULT_MODEL,
  apiKey: "",
  systemPrompt: "",
  autoPush: false,
  adapter: "extract",
};

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

// ── Component ────────────────────────────────────────────────────────
export default function TopologyExtractPanel(
  props: IDockviewPanelProps<TopologyExtractParams>,
) {
  const rawParams = props.params ?? {};
  const params: TopologyExtractParams = {
    ...topologyExtractDefaults,
    ...rawParams,
  };

  // Local state
  const [provider, setProvider] = useState<ProviderId>(params.provider);
  const [model, setModel] = useState(params.model);
  const [apiKey, setApiKey] = useState(params.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [autoPush, setAutoPush] = useState(params.autoPush);
  const [adapter, setAdapter] = useState(params.adapter || "extract");
  const [systemPrompt, setSystemPrompt] = useState(
    params.systemPrompt || DEFAULT_SYSTEM_PROMPT,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sourceFile, setSourceFile] = useState<string | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);

  // Extraction state
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushed, setPushed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Persist params whenever they change
  useEffect(() => {
    props.api.updateParameters({
      ...params,
      provider,
      model,
      apiKey,
      autoPush,
      adapter,
      systemPrompt: systemPrompt === DEFAULT_SYSTEM_PROMPT ? "" : systemPrompt,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, model, apiKey, autoPush, adapter, systemPrompt, props.api]);

  const pushToJsonBus = useCallback(
    (doc: TopoDocument) => {
      setJson(params.documentId, doc as unknown as JsonValue);
      setPushed(true);
    },
    [params.documentId],
  );

  async function handleExtract() {
    if (extracting) {
      // Cancel in-flight
      abortRef.current?.abort();
      return;
    }

    setError(null);
    setResult(null);
    setPushed(false);
    setExtracting(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let res: ExtractionResult;
      
      if (provider === "local-cli") {
        setProgressLog([]);
        const input = sourceFile 
          ? { type: "file" as const, path: sourceFile } 
          : { type: "text" as const, data: sourceText };

        const dyadicDoc = await runLocalInfo2TopoCli(
          input, 
          { apiKey, model, adapter },
          (msg) => setProgressLog(prev => [...prev, msg].slice(-100))
        );
        res = {
          document: dyadicDoc,
          rawJson: JSON.stringify(dyadicDoc, null, 2),
        };
      } else {
        res = await extractTopology({
          apiKey,
          model,
          systemPrompt,
          sourceText,
          signal: controller.signal,
        });
      }
      
      setResult(res);

      if (autoPush) {
        pushToJsonBus(res.document);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Extraction cancelled.");
      } else if (err instanceof ExtractionError) {
        setError(err.message);
      } else {
        setError(
          `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } finally {
      setExtracting(false);
      abortRef.current = null;
    }
  }

  async function handleLoadFile() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const picked = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "Text", extensions: ["txt", "md", "markdown", "json", "csv", "xml", "html"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (!picked || typeof picked !== "string") return;
      
      if (provider === "local-cli") {
        setSourceFile(picked);
        setSourceText(`[File Mode] Selected for local extraction:\n${picked}`);
      } else {
        const content = await readTextFile(picked);
        setSourceText(content);
        setSourceFile(null);
      }
    } catch (err) {
      console.warn("[topology-extract] file open failed (off-Tauri?):", err);
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setSourceText(text);
      setSourceFile(null);
    } catch (err) {
      console.warn("[topology-extract] clipboard read failed:", err);
    }
  }

  async function handleCopyJson() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.rawJson);
    } catch (err) {
      console.warn("[topology-extract] clipboard write failed:", err);
    }
  }

  async function handleSaveJson() {
    if (!result) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const picked = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!picked) return;
      await writeTextFile(picked, JSON.stringify(result.document, null, 2));
    } catch (err) {
      console.warn("[topology-extract] save failed (off-Tauri?):", err);
    }
  }

  const tokenEstimate = estimateTokens(sourceText);
  const providerAvailable = PROVIDERS.find((p) => p.id === provider)?.available ?? false;
  const canExtract =
    providerAvailable &&
    apiKey.trim() !== "" &&
    (sourceText.trim() !== "" || sourceFile !== null) &&
    !extracting;

  const categories = result ? countCategories(result.document) : null;
  const nodeCount = result?.document.nodes.filter((n) => n.kind === "node").length ?? 0;
  const hyperedgeCount = result?.document.nodes.filter((n) => n.kind === "hyperedge").length ?? 0;
  const dyadicLinkCount = result
    ? (() => {
        const spokeSources = hyperedgeIds(result.document);
        return result.document.links.filter((l) => !spokeSources.has(l.source)).length;
      })()
    : 0;

  return (
    <div className="topo-extract-container">
      {/* ── Header: provider + model ─────────────────── */}
      <div className="topo-extract-header">
        <label>
          Provider
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderId)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.label}
                {!p.available ? " (coming soon)" : ""}
              </option>
            ))}
          </select>
        </label>

        {provider === "openrouter" && (
          <label>
            Model
            <input
              type="text"
              className="topo-extract-model-input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL}
            />
          </label>
        )}

        {provider === "local-cli" && (
          <label>
            Adapter
            <select
              value={adapter}
              onChange={(e) => setAdapter(e.target.value)}
              className="topo-extract-model-input"
              style={{ width: '140px' }}
            >
              <option value="extract">Generic Prose (extract)</option>
              <option value="manuscript">Manuscript Pipeline</option>
              <option value="propgraph">Property Graph</option>
            </select>
          </label>
        )}

        {!providerAvailable && (
          <span className="topo-extract-coming-soon">
            This provider is not yet wired — OpenRouter is the active backend.
          </span>
        )}
      </div>

      {/* ── API key row ──────────────────────────────── */}
      {provider === "openrouter" && (
        <div className="topo-extract-key-row">
          <label style={{ fontSize: 11, color: "#7e879b", whiteSpace: "nowrap" }}>
            API Key
          </label>
          <input
            className="topo-extract-key-input"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
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

      {/* ── Source input ─────────────────────────────── */}
      <div className="topo-extract-source">
        <textarea
          className="topo-extract-textarea"
          value={sourceText}
          onChange={(e) => {
            setSourceText(e.target.value);
            setSourceFile(null); // Revert to text mode if typing
          }}
          disabled={sourceFile !== null && provider === "local-cli"}
          placeholder="Paste or type source text here…&#10;&#10;Drop a document, paste from clipboard, or load a file — then hit Extract Topology to run the AI extraction pipeline."
        />
        <div className="topo-extract-source-actions">
          <button className="topo-extract-source-btn" onClick={handleLoadFile}>
            📂 Load File
          </button>
          <button className="topo-extract-source-btn" onClick={handlePaste}>
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
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
          {systemPrompt !== DEFAULT_SYSTEM_PROMPT && (
            <button
              className="topo-extract-prompt-reset"
              onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
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
            checked={autoPush}
            onChange={(e) => setAutoPush(e.target.checked)}
          />
          Auto-push to viewers
        </label>
      </div>

      {/* ── Progress display ─────────────────────────── */}
      {extracting && provider === "local-cli" && progressLog.length > 0 && (
        <div className="topo-extract-progress-log" style={{ fontSize: '11px', fontFamily: 'monospace', background: '#1e1e1e', color: '#ccc', padding: '8px', margin: '8px 12px', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
          {progressLog.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* ── Error display ────────────────────────────── */}
      {error && <div className="topo-extract-error">{error}</div>}

      {/* ── Result area ──────────────────────────────── */}
      <div className="topo-extract-result">
        {!result && !error && (
          <div className="topo-extract-result-empty">
            No extraction yet. Paste source text and click Extract.
          </div>
        )}
        {result && (
          <div className="topo-extract-result-summary">
            <div className="topo-extract-result-stats">
              <span className="success-icon">✓</span>
              <span>
                {nodeCount} node{nodeCount !== 1 ? "s" : ""}
                {hyperedgeCount > 0 && `, ${hyperedgeCount} hyperedge${hyperedgeCount !== 1 ? "s" : ""}`}
                , {dyadicLinkCount} edge
                {dyadicLinkCount !== 1 ? "s" : ""}
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

            <div className="topo-extract-result-actions">
              <button
                className={`topo-extract-result-btn topo-extract-result-btn--primary ${pushed ? "" : ""}`}
                onClick={() => pushToJsonBus(result.document)}
                title="Push extracted topology to json-bus for all viewers"
              >
                {pushed ? "✓ Pushed" : "Push to json-bus ▸"}
              </button>
              <button
                className="topo-extract-result-btn"
                onClick={handleCopyJson}
                title="Copy raw JSON to clipboard"
              >
                Copy JSON
              </button>
              <button
                className="topo-extract-result-btn"
                onClick={handleSaveJson}
                title="Save JSON to file"
              >
                Save…
              </button>
              {result.usage && (
                <span className="topo-extract-usage">
                  {result.usage.totalTokens.toLocaleString()} tokens used
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
