import { describe, expect, test } from "bun:test";
import { normalizeModel, calculateCost, PRICING_TABLE, ALIASES, CURSOR_OVERRIDES, getAllPricing } from "./pricing";

describe("Pricing and Model Normalization", () => {
  test("exact matches should return the model name in lowercase", () => {
    expect(normalizeModel("GPT-4o")).toBe("gpt-4o");
    expect(normalizeModel("claude-sonnet-4-5")).toBe("claude-sonnet-4-5");
    expect(normalizeModel("gpt-5.4")).toBe("gpt-5.4");
  });

  test("alias resolution", () => {
    expect(normalizeModel("claude-opus")).toBe("claude-opus-4-5");
    expect(normalizeModel("claude-sonnet")).toBe("claude-sonnet-4-5");
    expect(normalizeModel("gpt4o")).toBe("gpt-4o");
    expect(normalizeModel("deepseek-chat")).toBe("deepseek-v3");
    expect(normalizeModel("deepseek-reasoner")).toBe("deepseek-r1");
    expect(normalizeModel("gemini-pro")).toBe("gemini-2-5-pro");
    expect(normalizeModel("gemini-flash")).toBe("gemini-2-5-flash");
  });

  test("alias target must be in PRICING_TABLE", () => {
    for (const [alias, target] of Object.entries(ALIASES)) {
      expect(PRICING_TABLE[target]).toBeDefined();
    }
  });

  test("version normalization (dash to dot)", () => {
    expect(normalizeModel("gemini-2-5-pro")).toBe("gemini-2-5-pro");
    expect(normalizeModel("gemini-2-0-flash")).toBe("gemini-2.0-flash");
  });

  test("provider prefix stripping", () => {
    expect(normalizeModel("anthropic/claude-sonnet-4-5")).toBe("claude-sonnet-4-5");
    expect(normalizeModel("openai/gpt-4o")).toBe("gpt-4o");
    expect(normalizeModel("google/gemini-2.5-pro")).toBe("gemini-2.5-pro");
    expect(normalizeModel("azure/gpt-4o-mini")).toBe("azure/gpt-4o-mini");
  });

  test("tier suffix stripping", () => {
    expect(normalizeModel("gpt-4o-thinking")).toBe("gpt-4o");
    expect(normalizeModel("claude-sonnet-4-5-high")).toBe("claude-sonnet-4-5");
  });

  test("date suffix stripping", () => {
    expect(normalizeModel("gpt-4o-2024-11-20")).toBe("gpt-4o-2024-11-20");
  });

  test("dash-to-dot and vice versa", () => {
    const n1 = normalizeModel("gpt-4o");
    expect(n1).toBe("gpt-4o");
    const n2 = normalizeModel("gemini-2.5-pro");
    expect(n2).toBe("gemini-2.5-pro");
    const n3 = normalizeModel("gemini-2-5-pro");
    expect(n3).toBe("gemini-2-5-pro");
  });

  test("cursor overrides", () => {
    expect(normalizeModel("gpt-4o-cursor-preview")).toBe("gpt-4o-cursor-preview");
    expect(normalizeModel("cursor-fast")).toBe("cursor-fast");
    expect(normalizeModel("claude-sonnet-cursor")).toBe("claude-sonnet-cursor");
  });

  test("fuzzy matching with contains fallback", () => {
    expect(normalizeModel("some-random-claude-opus-4-5")).toBe("claude-opus-4-5");
    expect(normalizeModel("custom-gpt-4o-mini-xyz")).toBe("gpt-4o-mini");
  });

  test("unknown model returns as-is", () => {
    expect(normalizeModel("super-expensive-nonexistent-model-xyz")).toBe("super-expensive-nonexistent-model-xyz");
  });

  test("prefixed slash models still work", () => {
    expect(normalizeModel("vertex/gemini-2.5-pro")).toBe("vertex/gemini-2.5-pro");
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

  test("calculateCost returns 0 for unknown models", () => {
    const cost = calculateCost("super-expensive-nonexistent-model-xyz", {
      inputTokens: 1000,
      outputTokens: 1000,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(cost).toBe(0);
  });

  test("calculateCost works via aliases", () => {
    const usage = {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    // deepseek-chat aliased to deepseek-v3: input 0.14, output 0.28
    const cost = calculateCost("deepseek-chat", usage);
    expect(cost).toBeCloseTo(0.14 + 0.028, 5);
  });

  test("getAllPricing returns all entries", () => {
    const all = getAllPricing();
    expect(all.length).toBe(Object.keys(PRICING_TABLE).length);
    expect(all[0]).toHaveProperty("model");
    expect(all[0]).toHaveProperty("inputCostPer1M");
    expect(all[0]).toHaveProperty("outputCostPer1M");
  });

  test("PRICING_TABLE has all aliased targets", () => {
    for (const target of Object.values(ALIASES)) {
      expect(PRICING_TABLE[target]).toBeDefined();
    }
  });

  test("dash variant and dot variant map to each other", () => {
    expect(normalizeModel("gemini-2-5-flash")).toBe("gemini-2-5-flash");
    expect(normalizeModel("gemini-2.5-flash")).toBe("gemini-2.5-flash");
  });
});
