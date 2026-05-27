import type { RelayClient } from "./relay-client";
import { calculateCost, normalizeModel } from "./pricing";
import type { TokenUsage } from "./types";

function formatCost(c: number): string {
  if (!Number.isFinite(c) || isNaN(c)) return "$0.00";
  if (c <= 0) return "$0.00";
  if (c < 0.0001) return `${(c * 1_000_000).toFixed(1)}μ`;
  if (c < 0.001) return `${(c * 1_000).toFixed(2)}m`;
  if (c < 1) return `$${c.toFixed(4)}`;
  if (c < 100) return `$${c.toFixed(2)}`;
  return `$${c.toFixed(0)}`;
}

const LLM_HOSTS = [
  "api.anthropic.com",
  "api.openai.com",
  "generativelanguage.googleapis.com",
  "openrouter.ai",
  "api.together.xyz",
  "api.mistral.ai",
  "api.groq.com",
  "api.cohere.ai",
  "api.perplexity.ai",
  "bedrock-runtime",
  "vertexai",
  "api.x.ai",
  "api.deepseek.com",
  "api.github.com",
  "api.copilot.microsoft.com",
  "api.cerebras.ai",
  "api.fireworks.ai",
  "api.cloudflare.com",
  "api.huggingface.co",
  "inference.ai.azure.com",
];

function isLLMHost(url: string): boolean {
  return LLM_HOSTS.some((h) => url.includes(h));
}

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (typeof input === "object" && "url" in input) return (input as Request).url;
  return "";
}

function extractModelFromRequest(init?: RequestInit): string {
  try {
    if (!init?.body) return "unknown";
    let bodyStr: string;
    if (typeof init.body === "string") {
      bodyStr = init.body;
    } else if (init.body instanceof Buffer || init.body instanceof Uint8Array) {
      bodyStr = Buffer.from(init.body).toString("utf-8");
    } else if (typeof init.body === "object" && "toString" in init.body) {
      bodyStr = init.body.toString();
    } else {
      return "unknown";
    }
    const body = JSON.parse(bodyStr);
    if (body?.model) return normalizeModel(body.model);
  } catch {}
  return "unknown";
}

function extractUsage(
  body: unknown,
  init?: RequestInit
): Omit<TokenUsage, "costUsd" | "timestamp"> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  // Anthropic
  if (b.type === "message" && b.usage && typeof b.usage === "object") {
    const model = normalizeModel(typeof b.model === "string" ? b.model : extractModelFromRequest(init));
    const u = b.usage as Record<string, unknown>;
    const inputTokens = typeof u.input_tokens === "number" ? u.input_tokens : 0;
    const outputTokens = typeof u.output_tokens === "number" ? u.output_tokens : 0;
    return {
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cacheReadTokens: typeof u.cache_read_input_tokens === "number" ? u.cache_read_input_tokens : 0,
      cacheWriteTokens: typeof u.cache_creation_input_tokens === "number" ? u.cache_creation_input_tokens : 0,
    };
  }

  // OpenAI / compatible
  if (b.usage && typeof b.usage === "object" && !("type" in b && b.type === "message")) {
    const model = normalizeModel(typeof b.model === "string" ? b.model : extractModelFromRequest(init));
    const u = b.usage as Record<string, unknown>;
    const inputTokens = typeof u.prompt_tokens === "number" ? u.prompt_tokens : 0;
    const outputTokens = typeof u.completion_tokens === "number" ? u.completion_tokens : 0;
    const details = u.prompt_tokens_details as Record<string, unknown> | undefined;
    const cacheRead = typeof details?.cached_tokens === "number" ? details.cached_tokens : 0;
    return {
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: 0,
    };
  }

  // Google Gemini
  if (b.usageMetadata && typeof b.usageMetadata === "object") {
    const u = b.usageMetadata as Record<string, unknown>;
    const inputTokens = typeof u.promptTokenCount === "number" ? u.promptTokenCount : 0;
    const outputTokens = typeof u.candidatesTokenCount === "number" ? u.candidatesTokenCount : 0;
    const modelRaw = typeof b.modelVersion === "string" ? b.modelVersion : extractModelFromRequest(init) || "gemini-2-5-pro";
    return {
      model: normalizeModel(modelRaw),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
  }

  return null;
}

export function installInterceptors(relay: RelayClient, verbose = false) {
  const originalFetch = globalThis.fetch;
  if (!originalFetch) {
    console.warn("[Daemon] globalThis.fetch not available — interceptor skipped");
    return;
  }

  const intercepted = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = getUrl(input);
    const start = performance.now();
    const response = await originalFetch(input, init);

    if (!isLLMHost(url)) return response;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return response;

    try {
      const clone = response.clone();
      const body = await clone.json();
      const usage = extractUsage(body, init);
      if (usage) {
        const costUsd = calculateCost(usage.model, usage);
        const token: TokenUsage = {
          ...usage,
          costUsd,
          latencyMs: Math.round(performance.now() - start),
          timestamp: Date.now(),
        };
        relay.sendTokens(token);
        if (verbose) {
          console.log(
            `[Daemon] tokens: ${usage.model} in=${usage.inputTokens} out=${usage.outputTokens} ${formatCost(costUsd)}`
          );
        }
      }
    } catch (err) {
      console.warn("[Interceptor] Response clone/parse error:", err);
    }

    return response;
  };

  globalThis.fetch = intercepted as typeof fetch;
  if (verbose) console.log("[Daemon] Fetch interceptor installed");
}
