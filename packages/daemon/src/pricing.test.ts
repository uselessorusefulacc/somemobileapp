import { describe, expect, test } from "bun:test";
import { normalizeModel, calculateCost, PRICING_TABLE } from "./pricing";

describe("Pricing and Model Normalization", () => {
  test("exact matches should return the model name in lowercase", () => {
    expect(normalizeModel("GPT-4o")).toBe("gpt-4o");
    expect(normalizeModel("claude-sonnet-4-5")).toBe("claude-sonnet-4-5");
  });

  test("fuzzy match stripping date suffixes", () => {
    expect(normalizeModel("claude-3-5-sonnet-20241022")).toBe("claude-3-5-sonnet-20241022");
    expect(normalizeModel("gpt-4o-2024-11-20")).toBe("gpt-4o-2024-11-20");
  });

  test("prefix matching should resolve to matching key", () => {
    expect(normalizeModel("gpt-4o-mini-something")).toBe("gpt-4o-mini");
    expect(normalizeModel("gemini-2-5-pro-latest")).toBe("gemini-2-5-pro");
  });

  test("fuzzy matching with contains fallback", () => {
    // Should fallback to matching key contains or similar
    expect(normalizeModel("some-random-claude-opus-4-5")).toBe("claude-opus-4-5");
  });

  test("calculateCost computes accurate pricing based on PRICING_TABLE", () => {
    // claude-sonnet-4-5: inputCostPer1M: 3, outputCostPer1M: 15, cacheRead: 0.3, cacheWrite: 3.75
    const usage1 = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    };
    const cost1 = calculateCost("claude-sonnet-4-5", usage1);
    expect(cost1).toBe(3 + 15 + 0.3 + 3.75); // 22.05

    // gpt-4o: inputCostPer1M: 2.5, outputCostPer1M: 10, cacheRead: 1.25, cacheWrite: 0
    const usage2 = {
      inputTokens: 2_000_000,
      outputTokens: 500_000,
      cacheReadTokens: 4_000_000,
      cacheWriteTokens: 0,
    };
    const cost2 = calculateCost("gpt-4o", usage2);
    expect(cost2).toBe((2 * 2.5) + (0.5 * 10) + (4 * 1.25)); // 5 + 5 + 5 = 15
  });

  test("calculateCost returns 0 for unknown models that cannot be normalized", () => {
    const cost = calculateCost("super-expensive-nonexistent-model-xyz", {
      inputTokens: 1000,
      outputTokens: 1000,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(cost).toBe(0);
  });
});
