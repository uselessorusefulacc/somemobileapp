export const PRICING_TABLE: Record<string, { inputCostPer1M: number; outputCostPer1M: number; cacheReadCostPer1M: number; cacheWriteCostPer1M: number }> = {
  "claude-opus-4-5":    { inputCostPer1M: 15,   outputCostPer1M: 75,   cacheReadCostPer1M: 1.5,    cacheWriteCostPer1M: 18.75 },
  "claude-sonnet-4-5":  { inputCostPer1M: 3,    outputCostPer1M: 15,   cacheReadCostPer1M: 0.3,    cacheWriteCostPer1M: 3.75 },
  "claude-haiku-3-5":   { inputCostPer1M: 0.8,  outputCostPer1M: 4,    cacheReadCostPer1M: 0.08,   cacheWriteCostPer1M: 1 },
  "gpt-4o":             { inputCostPer1M: 2.5,  outputCostPer1M: 10,   cacheReadCostPer1M: 1.25,   cacheWriteCostPer1M: 0 },
  "gpt-4o-mini":        { inputCostPer1M: 0.15, outputCostPer1M: 0.6,  cacheReadCostPer1M: 0.075,  cacheWriteCostPer1M: 0 },
  "o3":                 { inputCostPer1M: 10,   outputCostPer1M: 40,   cacheReadCostPer1M: 2.5,    cacheWriteCostPer1M: 0 },
  "o3-mini":            { inputCostPer1M: 1.1,  outputCostPer1M: 4.4,  cacheReadCostPer1M: 0.55,   cacheWriteCostPer1M: 0 },
  "gemini-2-5-pro":     { inputCostPer1M: 1.25, outputCostPer1M: 10,   cacheReadCostPer1M: 0.31,   cacheWriteCostPer1M: 4.5 },
  "gemini-2-5-flash":   { inputCostPer1M: 0.15, outputCostPer1M: 0.6,  cacheReadCostPer1M: 0.0375, cacheWriteCostPer1M: 1 },
};

export function calculateCost(model: string, usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }): number {
  const pricing = PRICING_TABLE[model];
  if (!pricing) return 0;
  return (
    (usage.inputTokens / 1_000_000) * pricing.inputCostPer1M +
    (usage.outputTokens / 1_000_000) * pricing.outputCostPer1M +
    (usage.cacheReadTokens / 1_000_000) * pricing.cacheReadCostPer1M +
    (usage.cacheWriteTokens / 1_000_000) * pricing.cacheWriteCostPer1M
  );
}
