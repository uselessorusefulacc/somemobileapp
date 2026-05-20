import type { TokenUsage } from "./types";
import { calculateCost } from "./pricing";
import type { RelayClient } from "./relay-client";

function extractModelFromRequest(init?: RequestInit): string | undefined {
  try {
    if (!init?.body) return undefined;
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    return body?.model;
  } catch {
    return undefined;
  }
}

function extractUsage(body: unknown, init?: RequestInit): Omit<TokenUsage, "costUsd" | "timestamp"> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  // OpenAI / Groq / compatible
  if ("usage" in b && b.usage && typeof b.usage === "object") {
    const u = b.usage as Record<string, unknown>;
    const model = (b.model as string) || extractModelFromRequest(init) || "unknown";
    const promptTokens = typeof u.prompt_tokens === "number" ? u.prompt_tokens : 0;
    const completionTokens = typeof u.completion_tokens === "number" ? u.completion_tokens : 0;
    const cachedTokens =
      typeof u.prompt_tokens_details === "object" && u.prompt_tokens_details
        ? ((u.prompt_tokens_details as Record<string, unknown>).cached_tokens as number) || 0
        : 0;
    return {
      model,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      totalTokens: promptTokens + completionTokens,
      cacheReadTokens: cachedTokens,
      cacheWriteTokens: 0,
    };
  }

  // Anthropic
  if ("type" in b && b.type === "message" && "usage" in b && b.usage && typeof b.usage === "object") {
    const u = b.usage as Record<string, unknown>;
    const inputTokens = typeof u.input_tokens === "number" ? u.input_tokens : 0;
    const outputTokens = typeof u.output_tokens === "number" ? u.output_tokens : 0;
    return {
      model: (b.model as string) || "unknown",
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cacheReadTokens: (u.cache_creation_input_tokens as number) || 0,
      cacheWriteTokens: (u.cache_read_input_tokens as number) || 0,
    };
  }

  // Google Gemini
  if ("usageMetadata" in b && b.usageMetadata && typeof b.usageMetadata === "object") {
    const u = b.usageMetadata as Record<string, unknown>;
    const inputTokens = typeof u.promptTokenCount === "number" ? u.promptTokenCount : 0;
    const outputTokens = typeof u.candidatesTokenCount === "number" ? u.candidatesTokenCount : 0;
    return {
      model: (b.modelVersion as string) || "unknown",
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
  }

  return null;
}

export function installInterceptors(relay: RelayClient) {
  const originalFetch = globalThis.fetch;

  const interceptedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const startTime = performance.now();
    const response = await originalFetch(input, init);

    // Only intercept LLM API responses (heuristic: JSON with usage field)
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return response;
    }

    try {
      const clone = response.clone();
      const body = await clone.json();
      const usage = extractUsage(body, init);
      if (usage) {
        const costUsd = calculateCost(usage.model, usage);
        relay.sendTokens({
          ...usage,
          costUsd,
          latencyMs: Math.round(performance.now() - startTime),
          timestamp: Date.now(),
        });
      }
    } catch {
      // Not an LLM response — ignore silently
    }

    return response;
  };

  // Cast to bypass TypeScript strictness on fetch extra properties
  globalThis.fetch = interceptedFetch as typeof fetch;

  console.log("[Daemon] Fetch interceptor installed");
}
