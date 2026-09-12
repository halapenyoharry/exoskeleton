// OpenRouter fetch wrapper for the topology-extract panel.
//
// Pure browser fetch — no npm dependencies. Calls the OpenRouter chat
// completions API directly. The API key never leaves the client.

import type { TopoDocument } from "../json-dyadic/types";

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  systemPrompt: string;
  sourceText: string;
  /** Optional abort signal for cancellation. */
  signal?: AbortSignal;
}

export interface ExtractionResult {
  document: TopoDocument;
  /** Raw JSON string returned by the model (before parsing). */
  rawJson: string;
  /** Usage stats from the API response, if available. */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: "auth" | "rate_limit" | "parse" | "network" | "api",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
 * Call OpenRouter's chat completions endpoint and parse the response as
 * a TopoDocument.
 */
export async function extractTopology(
  opts: OpenRouterOptions,
): Promise<ExtractionResult> {
  const { apiKey, model, systemPrompt, sourceText, signal } = opts;

  if (!apiKey.trim()) {
    throw new ExtractionError("API key is required", "auth");
  }
  if (!sourceText.trim()) {
    throw new ExtractionError("Source text is empty", "parse");
  }

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/halapenyoharry/exoskeleton",
        "X-Title": "Exoskeleton topology-extract",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: sourceText },
        ],
        temperature: 0.1,
        // Ask for JSON output where supported
        response_format: { type: "json_object" },
      }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err; // Let abort propagate as-is
    }
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
      throw new ExtractionError(
        "Rate limited. Try again in a moment.",
        "rate_limit",
        429,
      );
    }
    throw new ExtractionError(
      `API error ${response.status}: ${body.slice(0, 200)}`,
      "api",
      response.status,
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new ExtractionError(
      "No content in API response",
      "api",
    );
  }

  // Strip markdown fences if the model wraps output in ```json ... ```
  const rawJson = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new ExtractionError(
      `Model returned invalid JSON: ${rawJson.slice(0, 100)}…`,
      "parse",
    );
  }

  // Validate the shape loosely — we trust the model but verify basics
  const doc = parsed as Record<string, unknown>;
  if (!doc || typeof doc !== "object") {
    throw new ExtractionError("Response is not a JSON object", "parse");
  }
  if (!Array.isArray(doc.nodes)) {
    throw new ExtractionError(
      "Response missing 'nodes' array",
      "parse",
    );
  }
  if (!Array.isArray(doc.links)) {
    throw new ExtractionError(
      "Response missing 'links' array",
      "parse",
    );
  }

  const usage = data?.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined;

  return {
    document: parsed as TopoDocument,
    rawJson,
    usage,
  };
}
