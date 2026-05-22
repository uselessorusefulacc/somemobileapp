import { describe, expect, test, beforeAll } from "bun:test";
import app from "./index";

describe("Hono REST API Smoke Tests", () => {
  test("GET /api/health returns status", async () => {
    const res = await app.request("/api/health");
    // Database might be connected or offline depending on migration status
    expect([200, 503]).toContain(res.status);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBeDefined();
  });

  test("GET /api/pricing returns the May 2026 pricing table", async () => {
    const res = await app.request("/api/pricing");
    expect(res.status).toBe(200);
    const body = await res.json() as { pricing: Record<string, unknown> };
    expect(body.pricing).toBeDefined();
    expect(body.pricing["claude-opus-4-5"]).toBeDefined();
    expect(body.pricing["gpt-4o"]).toBeDefined();
  });

  test("POST /api/compare-models performs side-by-side cost projections", async () => {
    const payload = {
      inputTokens: 100000,
      outputTokens: 20000,
      cacheReadTokens: 50000,
      cacheWriteTokens: 0
    };
    const res = await app.request("/api/compare-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { comparison: Array<{ modelId: string; costUsd: number }> };
    expect(body.comparison).toBeArray();
    expect(body.comparison.length).toBeGreaterThan(0);
    // Cheap models like gpt-4o-mini should be cheaper than claude-opus-4-5
    const mini = body.comparison.find(c => c.modelId === "gpt-4o-mini");
    const opus = body.comparison.find(c => c.modelId === "claude-opus-4-5");
    if (mini && opus) {
      expect(mini.costUsd).toBeLessThan(opus.costUsd);
    }
  });

  test("GET & POST /api/budget load and save budget config", async () => {
    // 1. Get current budget
    const getRes = await app.request("/api/budget");
    expect(getRes.status).toBe(200);
    const budget = await getRes.json() as { alertAtPct: number };
    expect(budget.alertAtPct).toBeDefined();

    // 2. Post new budget config
    const testBudget = {
      dailyLimitUsd: 10,
      monthlyLimitUsd: 100,
      alertAtPct: 75
    };
    const postRes = await app.request("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testBudget)
    });
    expect(postRes.status).toBe(200);
    const saved = await postRes.json() as { dailyLimitUsd: number; monthlyLimitUsd: number; alertAtPct: number };
    expect(saved.dailyLimitUsd).toBe(10);
    expect(saved.monthlyLimitUsd).toBe(100);
    expect(saved.alertAtPct).toBe(75);
  });
});
