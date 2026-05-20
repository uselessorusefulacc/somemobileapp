import type { RelayClient } from "./relay-client";
import { calculateCost, normalizeModel } from "./pricing";
import type { TokenUsage } from "./types";

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
    const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
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
    const u = b.usage as Record<string, unknown>;
    const model = normalizeModel((b.model as string) || extractModelFromRequest(init));
    const inputTokens = (u.input_tokens as number) || 0;
    const outputTokens = (u.output_tokens as number) || 0;
    return {
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cacheReadTokens: (u.cache_read_input_tokens as number) || 0,
      cacheWriteTokens: (u.cache_creation_input_tokens as number) || 0,
    };
  }

  // OpenAI / compatible
  if (b.usage && typeof b.usage === "object" && !("type" in b && b.type === "message")) {
    const u = b.usage as Record<string, unknown>;
    const model = normalizeModel((b.model as string) || extractModelFromRequest(init));
    const inputTokens = (u.prompt_tokens as number) || 0;
    const outputTokens = (u.completion_tokens as number) || 0;
    const details = u.prompt_tokens_details as Record<string, unknown> | undefined;
    const cacheRead = (details?.cached_tokens as number) || 0;
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
    const inputTokens = (u.promptTokenCount as number) || 0;
    const outputTokens = (u.candidatesTokenCount as number) || 0;
    const modelRaw = (b.modelVersion as string) || extractModelFromRequest(init) || "gemini-2-5-pro";
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
            `[Daemon] tokens: ${usage.model} in=${usage.inputTokens} out=${usage.outputTokens} $${costUsd.toFixed(5)}`
          );
        }
      }
    } catch {
      // Not an LLM JSON response — ignore
    }

    return response;
  };

  globalThis.fetch = intercepted as typeof fetch;
  if (verbose) console.log("[Daemon] Fetch interceptor installed");
}
