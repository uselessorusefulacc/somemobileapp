export const PRICING_TABLE: Record<
  string,
  {
    inputCostPer1M: number;
    outputCostPer1M: number;
    cacheReadCostPer1M: number;
    cacheWriteCostPer1M: number;
  }
> = {
  // Anthropic Claude
  "claude-opus-4-5":          { inputCostPer1M: 15,    outputCostPer1M: 75,   cacheReadCostPer1M: 1.5,    cacheWriteCostPer1M: 18.75 },
  "claude-sonnet-4-5":        { inputCostPer1M: 3,     outputCostPer1M: 15,   cacheReadCostPer1M: 0.3,    cacheWriteCostPer1M: 3.75 },
  "claude-sonnet-4-5-20251101":{ inputCostPer1M: 3,    outputCostPer1M: 15,   cacheReadCostPer1M: 0.3,    cacheWriteCostPer1M: 3.75 },
  "claude-haiku-3-5":         { inputCostPer1M: 0.8,   outputCostPer1M: 4,    cacheReadCostPer1M: 0.08,   cacheWriteCostPer1M: 1 },
  "claude-opus-4":            { inputCostPer1M: 15,    outputCostPer1M: 75,   cacheReadCostPer1M: 1.5,    cacheWriteCostPer1M: 18.75 },
  "claude-sonnet-4":          { inputCostPer1M: 3,     outputCostPer1M: 15,   cacheReadCostPer1M: 0.3,    cacheWriteCostPer1M: 3.75 },
  "claude-3-5-sonnet-20241022":{ inputCostPer1M: 3,    outputCostPer1M: 15,   cacheReadCostPer1M: 0.3,    cacheWriteCostPer1M: 3.75 },
  "claude-3-5-haiku-20241022": { inputCostPer1M: 0.8,  outputCostPer1M: 4,    cacheReadCostPer1M: 0.08,   cacheWriteCostPer1M: 1 },
  "claude-3-opus-20240229":   { inputCostPer1M: 15,    outputCostPer1M: 75,   cacheReadCostPer1M: 1.5,    cacheWriteCostPer1M: 18.75 },
  // OpenAI
  "gpt-4o":                   { inputCostPer1M: 2.5,   outputCostPer1M: 10,   cacheReadCostPer1M: 1.25,   cacheWriteCostPer1M: 0 },
  "gpt-4o-2024-11-20":        { inputCostPer1M: 2.5,   outputCostPer1M: 10,   cacheReadCostPer1M: 1.25,   cacheWriteCostPer1M: 0 },
  "gpt-4o-mini":              { inputCostPer1M: 0.15,  outputCostPer1M: 0.6,  cacheReadCostPer1M: 0.075,  cacheWriteCostPer1M: 0 },
  "gpt-4-turbo":              { inputCostPer1M: 10,    outputCostPer1M: 30,   cacheReadCostPer1M: 0,      cacheWriteCostPer1M: 0 },
  "gpt-4":                    { inputCostPer1M: 30,    outputCostPer1M: 60,   cacheReadCostPer1M: 0,      cacheWriteCostPer1M: 0 },
  "o3":                       { inputCostPer1M: 10,    outputCostPer1M: 40,   cacheReadCostPer1M: 2.5,    cacheWriteCostPer1M: 0 },
  "o3-mini":                  { inputCostPer1M: 1.1,   outputCostPer1M: 4.4,  cacheReadCostPer1M: 0.55,   cacheWriteCostPer1M: 0 },
  "o4-mini":                  { inputCostPer1M: 1.1,   outputCostPer1M: 4.4,  cacheReadCostPer1M: 0.275,  cacheWriteCostPer1M: 0 },
  "o1":                       { inputCostPer1M: 15,    outputCostPer1M: 60,   cacheReadCostPer1M: 7.5,    cacheWriteCostPer1M: 0 },
  "o1-mini":                  { inputCostPer1M: 3,     outputCostPer1M: 12,   cacheReadCostPer1M: 1.5,    cacheWriteCostPer1M: 0 },
  // Google Gemini
  "gemini-2-5-pro":           { inputCostPer1M: 1.25,  outputCostPer1M: 10,   cacheReadCostPer1M: 0.31,   cacheWriteCostPer1M: 4.5 },
  "gemini-2-5-flash":         { inputCostPer1M: 0.15,  outputCostPer1M: 0.6,  cacheReadCostPer1M: 0.0375, cacheWriteCostPer1M: 1 },
  "gemini-2.0-flash":         { inputCostPer1M: 0.1,   outputCostPer1M: 0.4,  cacheReadCostPer1M: 0.025,  cacheWriteCostPer1M: 0 },
  "gemini-1.5-pro":           { inputCostPer1M: 1.25,  outputCostPer1M: 5,    cacheReadCostPer1M: 0.31,   cacheWriteCostPer1M: 0 },
  "gemini-1.5-flash":         { inputCostPer1M: 0.075, outputCostPer1M: 0.3,  cacheReadCostPer1M: 0.018,  cacheWriteCostPer1M: 0 },
  // GitHub Copilot (GPT-4o backend)
  "copilot-gpt-4o":           { inputCostPer1M: 2.5,   outputCostPer1M: 10,   cacheReadCostPer1M: 1.25,   cacheWriteCostPer1M: 0 },
};

/** Fuzzy model name normalizer — handles API version suffixes */
export function normalizeModel(raw: string): string {
  const lower = raw.toLowerCase().trim();

  // Exact match first
  if (PRICING_TABLE[lower]) return lower;

  // Strip date suffixes: claude-3-5-sonnet-20241022 -> claude-3-5-sonnet
  const noDate = lower.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
  if (PRICING_TABLE[noDate]) return noDate;

  // Partial prefix match (longest wins)
  let bestKey = "";
  for (const key of Object.keys(PRICING_TABLE)) {
    if (lower.startsWith(key) && key.length > bestKey.length) bestKey = key;
  }
  if (bestKey) return bestKey;

  // Fuzzy: contains
  for (const key of Object.keys(PRICING_TABLE)) {
    if (lower.includes(key) || key.includes(lower.split("-").slice(0, 3).join("-"))) return key;
  }

  return raw; // unknown — return as-is
}

export function calculateCost(
  model: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  }
): number {
  const key = normalizeModel(model);
  const pricing = PRICING_TABLE[key];
  if (!pricing) return 0;
  return (
    (usage.inputTokens / 1_000_000) * pricing.inputCostPer1M +
    (usage.outputTokens / 1_000_000) * pricing.outputCostPer1M +
    (usage.cacheReadTokens / 1_000_000) * pricing.cacheReadCostPer1M +
    (usage.cacheWriteTokens / 1_000_000) * pricing.cacheWriteCostPer1M
  );
}
