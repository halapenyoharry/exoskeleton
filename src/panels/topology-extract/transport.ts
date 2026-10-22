// Model transports for the topology-extract panel: OpenRouter (cloud) and
// Ollama (local network). Each takes a system prompt and one user message
// and returns the model's text. Parsing and projection live elsewhere
// (extract.ts, project.ts).
//
// Ollama from a browser: Ollama only answers CORS requests from its allowed
// origins (localhost, tauri://, app://). A page loaded from the dev server
// at http://<lan-or-tailscale-ip>:1420 is not one of them and gets a 403.
// So in a dev-server browser tab, requests go through the dev server's
// /__ollama relay (vite.config.ts), which forwards them without the Origin
// header. The desktop app (tauri://localhost) calls Ollama directly.

import { inTauri } from "../../utils/file-io.ts";

export class ExtractionError extends Error {
  // Plain fields, not constructor parameter properties, so the module also
  // loads under Node's type-stripping test runner.
  readonly code: "auth" | "rate_limit" | "parse" | "network" | "api";
  readonly status?: number;

  constructor(
    message: string,
    code: "auth" | "rate_limit" | "parse" | "network" | "api",
    status?: number,
  ) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
    this.status = status;
  }
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** USD, when the provider reports it (OpenRouter). */
  cost?: number;
}

export interface ChatResult {
  content: string;
  usage?: ChatUsage;
  /** The output hit the token cap before the model finished. */
  truncated?: boolean;
}

/** One model call: system prompt + user message -> text. */
export type ChatFn = (
  system: string,
  user: string,
  opts: { signal?: AbortSignal; onTokens?: (count: number) => void },
) => Promise<ChatResult>;

// ── OpenRouter ───────────────────────────────────────────────────────

export function openRouterChat(config: { apiKey: string; model: string }): ChatFn {
  return async (system, user, { signal }) => {
    if (!config.apiKey.trim()) {
      throw new ExtractionError("API key is required", "auth");
    }
    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/halapenyoharry/exoskeleton",
          "X-Title": "Exoskeleton topology-extract",
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.1,
          // Ask for JSON output where supported
          response_format: { type: "json_object" },
        }),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ExtractionError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        "network",
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      if (response.status === 401 || response.status === 403) {
        throw new ExtractionError(
          `Authentication failed (${response.status}). Check your API key.`,
          "auth",
          response.status,
        );
      }
      if (response.status === 429) {
        throw new ExtractionError("Rate limited. Try again in a moment.", "rate_limit", 429);
      }
      throw new ExtractionError(
        `API error ${response.status}: ${body.slice(0, 200)}`,
        "api",
        response.status,
      );
    }

    const data = await response.json();
    // OpenRouter can return HTTP 200 with an upstream error on the choice
    // (e.g. a provider-side 429). Surface it rather than a JSON parse error.
    const choiceError = data?.choices?.[0]?.error;
    if (choiceError) {
      const status = typeof choiceError.code === "number" ? choiceError.code : undefined;
      throw new ExtractionError(
        `Upstream error${status ? ` ${status}` : ""}: ${choiceError.message ?? "unknown"}`,
        status === 429 ? "rate_limit" : "api",
        status,
      );
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new ExtractionError("No content in API response", "api");
    }
    return {
      content,
      usage: data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
            cost: typeof data.usage.cost === "number" ? data.usage.cost : undefined,
          }
        : undefined,
    };
  };
}

// ── Ollama ───────────────────────────────────────────────────────────

export const DEFAULT_OLLAMA_HOST = "http://100.66.0.3:11434";

/**
 * Output cap per call. Ollama has no default limit and keeps generating past
 * a full context, so a small model stuck repeating itself never stops; this
 * bounds a runaway pass. The largest real pass seen (a 6,000-character part
 * on gemma4) was about 10k tokens.
 */
export const OLLAMA_MAX_OUTPUT_TOKENS = 12288;

/** Where to send an Ollama API request from this runtime. */
function ollamaRoute(host: string, path: string): { url: string; headers: Record<string, string> } {
  const base = host.trim().replace(/\/+$/, "");
  const viaDevServer =
    typeof window !== "undefined" && !inTauri() && Boolean(import.meta.env?.DEV);
  if (viaDevServer) {
    return { url: `/__ollama${path}`, headers: { "x-exo-ollama-target": base } };
  }
  return { url: `${base}${path}`, headers: {} };
}

/**
 * Structured-output schema for Ollama: constrains generation to the
 * relation-list shape the prompt asks for, which also guarantees the JSON
 * closes (small models otherwise sometimes stop one bracket short).
 */
export const RELATION_DOC_SCHEMA = {
  type: "object",
  properties: {
    metadata: { type: "object" },
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          kind: { type: "string" },
          label: { type: "string" },
          attrs: { type: "object" },
        },
        required: ["id", "label"],
      },
    },
    relations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          predicate: { type: "string" },
          category: {
            type: "string",
            enum: ["containment", "state_change", "interactivity", "reference"],
          },
          secondary_category: { type: "string" },
          mode: {
            type: "string",
            enum: [
              "asserted", "commanded", "intended", "foretold", "hypothetical",
              "attributed", "contested", "negated", "unresolved",
            ],
          },
          asserted_by: { type: "string" },
          directed: { type: "boolean" },
          locus: { type: "string" },
          label: { type: "string" },
          evidence: { type: "string" },
          participants: {
            type: "array",
            items: {
              type: "object",
              properties: { node: { type: "string" }, role: { type: "string" } },
              required: ["node", "role"],
            },
          },
        },
        required: ["predicate", "category", "mode", "evidence", "participants"],
      },
    },
  },
  required: ["nodes", "relations"],
} as const;

export function ollamaChat(config: {
  host: string;
  model: string;
  /** Context window. Keep it constant across a run: changing it reloads the model. */
  numCtx: number;
}): ChatFn {
  return async (system, user, { signal, onTokens }) => {
    const { url, headers } = ollamaRoute(config.host, "/api/chat");
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          stream: true,
          format: RELATION_DOC_SCHEMA,
          think: false,
          keep_alive: "15m",
          options: {
            temperature: 0.1,
            num_ctx: config.numCtx,
            num_predict: OLLAMA_MAX_OUTPUT_TOKENS,
          },
        }),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ExtractionError(
        `Could not reach Ollama at ${config.host}: ${err instanceof Error ? err.message : String(err)}`,
        "network",
      );
    }
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      const status = response.status;
      const hint =
        status === 403
          ? " Ollama refused this page's origin; open the app via the dev server or the desktop app, or set OLLAMA_ORIGINS on the Ollama host."
          : "";
      throw new ExtractionError(`Ollama error ${status}: ${body.slice(0, 300)}${hint}`, "api", status);
    }

    // Streamed NDJSON: one object per line, content in message.content.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let tokens = 0;
    let usage: ChatUsage | undefined;
    let truncated = false;
    const handleLine = (line: string) => {
      if (!line.trim()) return;
      let msg: {
        message?: { content?: string };
        done?: boolean;
        error?: string;
        prompt_eval_count?: number;
        eval_count?: number;
        done_reason?: string;
      };
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.error) throw new ExtractionError(`Ollama: ${msg.error}`, "api");
      if (msg.message?.content) {
        content += msg.message.content;
        tokens++;
        if (onTokens && tokens % 25 === 0) onTokens(tokens);
      }
      if (msg.done) {
        truncated = msg.done_reason === "length";
        usage = {
          promptTokens: msg.prompt_eval_count ?? 0,
          completionTokens: msg.eval_count ?? tokens,
          totalTokens: (msg.prompt_eval_count ?? 0) + (msg.eval_count ?? tokens),
        };
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        handleLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    handleLine(buffer);
    onTokens?.(usage?.completionTokens ?? tokens);
    return { content, usage, truncated };
  };
}

/** Model names installed on an Ollama host. */
export async function ollamaListModels(host: string): Promise<string[]> {
  const { url, headers } = ollamaRoute(host, "/api/tags");
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new ExtractionError(`Ollama error ${response.status} listing models`, "api", response.status);
  }
  const data = await response.json();
  return Array.isArray(data?.models)
    ? data.models.map((m: { name?: string }) => m.name).filter(Boolean)
    : [];
}

// ── Parsing ──────────────────────────────────────────────────────────

/**
 * Parse model output as JSON, tolerating markdown fences and output that
 * stops early (cut off mid-string or before its closing brackets): the open
 * string is closed and the brackets balanced, so the finished items survive.
 */
export function parseModelJson(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch (firstError) {
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    for (const c of stripped) {
      if (inString) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === "{" || c === "[") stack.push(c);
      else if (c === "}" || c === "]") stack.pop();
    }
    if (stack.length === 0) {
      throw new ExtractionError(
        `Model returned invalid JSON: ${(firstError as Error).message}`,
        "parse",
      );
    }
    const body = inString ? `${escaped ? stripped.slice(0, -1) : stripped}"` : stripped.replace(/,\s*$/, "");
    const closed =
      body.replace(/,\s*$/, "").replace(/:\s*$/, ': null') +
      stack.reverse().map((c) => (c === "{" ? "}" : "]")).join("");
    try {
      return JSON.parse(closed);
    } catch {
      throw new ExtractionError(
        `Model returned invalid JSON: ${(firstError as Error).message}`,
        "parse",
      );
    }
  }
}
