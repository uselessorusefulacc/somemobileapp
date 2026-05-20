import { Hono } from "hono";
import { cors } from "hono/cors";
import { db } from "./database";
import * as schema from "./database/schema";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";

// ─── Budget config (persisted to JSON) ────────────────────────────────────
// Resolve budget.json to packages/web/budget.json using import.meta.url
const BUDGET_FILE = new URL("../../budget.json", import.meta.url).pathname;

interface BudgetConfig {
  dailyLimitUsd: number | null;
  monthlyLimitUsd: number | null;
  alertAtPct: number; // 0-100, default 80
}

function loadBudget(): BudgetConfig {
  try {
    if (existsSync(BUDGET_FILE)) return JSON.parse(readFileSync(BUDGET_FILE, "utf-8"));
  } catch {}
  return { dailyLimitUsd: null, monthlyLimitUsd: 50, alertAtPct: 80 };
}

function saveBudget(cfg: BudgetConfig) {
  writeFileSync(BUDGET_FILE, JSON.stringify(cfg, null, 2));
}

// Model pricing data (May 2026)
const MODEL_PRICING: Record<string, { provider: string; displayName: string; inputCostPer1M: number; outputCostPer1M: number; cacheReadCostPer1M: number; cacheWriteCostPer1M: number }> = {
  "claude-opus-4-5": { provider: "anthropic", displayName: "Claude Opus 4.5", inputCostPer1M: 15, outputCostPer1M: 75, cacheReadCostPer1M: 1.5, cacheWriteCostPer1M: 18.75 },
  "claude-sonnet-4-5": { provider: "anthropic", displayName: "Claude Sonnet 4.5", inputCostPer1M: 3, outputCostPer1M: 15, cacheReadCostPer1M: 0.3, cacheWriteCostPer1M: 3.75 },
  "claude-haiku-3-5": { provider: "anthropic", displayName: "Claude Haiku 3.5", inputCostPer1M: 0.8, outputCostPer1M: 4, cacheReadCostPer1M: 0.08, cacheWriteCostPer1M: 1 },
  "gpt-4o": { provider: "openai", displayName: "GPT-4o", inputCostPer1M: 2.5, outputCostPer1M: 10, cacheReadCostPer1M: 1.25, cacheWriteCostPer1M: 0 },
  "gpt-4o-mini": { provider: "openai", displayName: "GPT-4o mini", inputCostPer1M: 0.15, outputCostPer1M: 0.6, cacheReadCostPer1M: 0.075, cacheWriteCostPer1M: 0 },
  "o3": { provider: "openai", displayName: "o3", inputCostPer1M: 10, outputCostPer1M: 40, cacheReadCostPer1M: 2.5, cacheWriteCostPer1M: 0 },
  "gemini-2-5-pro": { provider: "google", displayName: "Gemini 2.5 Pro", inputCostPer1M: 1.25, outputCostPer1M: 10, cacheReadCostPer1M: 0.31, cacheWriteCostPer1M: 4.5 },
  "gemini-2-5-flash": { provider: "google", displayName: "Gemini 2.5 Flash", inputCostPer1M: 0.15, outputCostPer1M: 0.6, cacheReadCostPer1M: 0.0375, cacheWriteCostPer1M: 1 },
};

function calcCost(model: string, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-sonnet-4-5"];
  return (
    (inputTokens / 1_000_000) * pricing.inputCostPer1M +
    (outputTokens / 1_000_000) * pricing.outputCostPer1M +
    (cacheReadTokens / 1_000_000) * pricing.cacheReadCostPer1M +
    (cacheWriteTokens / 1_000_000) * pricing.cacheWriteCostPer1M
  );
}

function generateOptimizationTips(session: typeof schema.agentSessions.$inferSelect): Array<{ tip: string; category: string; estimatedSavingPct: number }> {
  const tips: Array<{ tip: string; category: string; estimatedSavingPct: number }> = [];
  const cacheRatio = session.totalCacheReadTokens / Math.max(session.totalInputTokens, 1);
  const outputRatio = session.totalOutputTokens / Math.max(session.totalInputTokens, 1);

  if (cacheRatio < 0.3) {
    tips.push({
      tip: "Enable prompt caching — your cache hit rate is low. Adding cache breakpoints to system prompts can save 60-90% on repeated context.",
      category: "caching",
      estimatedSavingPct: 65,
    });
  }
  if (outputRatio > 2) {
    tips.push({
      tip: "Your output:input ratio is high. Use concise task framing — ask for bullet points instead of prose to reduce output tokens by 40%.",
      category: "prompting",
      estimatedSavingPct: 40,
    });
  }
  if (session.totalInputTokens > 100_000 && cacheRatio < 0.5) {
    tips.push({
      tip: "Context window is large. Use /compact or context compaction after 10+ turns to reduce token budget by 50-70%.",
      category: "context",
      estimatedSavingPct: 55,
    });
  }
  if (session.model === "claude-opus-4-5" || session.model === "o3") {
    tips.push({
      tip: `Switch to a mid-tier model for routine tasks. ${session.model === "claude-opus-4-5" ? "Claude Sonnet 4.5" : "GPT-4o"} is 5x cheaper with 90% of the capability for coding tasks.`,
      category: "model",
      estimatedSavingPct: 75,
    });
  }
  if (tips.length === 0) {
    tips.push({
      tip: "Great usage patterns! You're getting good cache hits. Consider using parallel subagents for large refactors to reduce wall-clock time.",
      category: "prompting",
      estimatedSavingPct: 10,
    });
  }
  return tips;
}

const app = new Hono()
  .basePath("api")
  .use(cors({ origin: (origin) => origin ?? "*", credentials: true, exposeHeaders: ["set-auth-token"] }))

  // Health
  .get("/health", (c) => c.json({ status: "ok" }, 200))

  // Pricing reference
  .get("/pricing", (c) => c.json({ pricing: MODEL_PRICING }, 200))

  // ─── Sessions ─────────────────────────────────────────────────────────
  .get("/sessions", async (c) => {
    const rawSessions = await db
      .select()
      .from(schema.agentSessions)
      .orderBy(desc(schema.agentSessions.updatedAt))
      .limit(50);
    const sessions = rawSessions.map((s) => ({
      ...s,
      totalTokens: s.totalInputTokens + s.totalOutputTokens,
      totalCost: s.totalCostUsd.toFixed(6),
      sandboxUrl: s.cloudUrl,
    }));
    return c.json({ sessions }, 200);
  })

  .post("/sessions", async (c) => {
    const body = await c.req.json<{ name: string; agentType: string; model: string; cloudUrl?: string; sandboxUrl?: string }>();
    const id = randomUUID();
    const session = await db
      .insert(schema.agentSessions)
      .values({ id, name: body.name, agentType: body.agentType, model: body.model, cloudUrl: body.cloudUrl ?? body.sandboxUrl ?? null })
      .returning();
    return c.json({ session: session[0] }, 201);
  })

  .get("/sessions/:id", async (c) => {
    const { id } = c.req.param();
    const raw = await db.select().from(schema.agentSessions).where(eq(schema.agentSessions.id, id)).limit(1);
    if (!raw[0]) return c.json({ error: "not found" }, 404);
    const session = { ...raw[0], totalTokens: raw[0].totalInputTokens + raw[0].totalOutputTokens, totalCost: raw[0].totalCostUsd.toFixed(6), sandboxUrl: raw[0].cloudUrl };
    return c.json({ session }, 200);
  })

  // PATCH /sessions/:id — update status or other fields
  .patch("/sessions/:id", async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json<{ status?: string }>(); 
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.status) updates.status = body.status;
    await db.update(schema.agentSessions).set(updates).where(eq(schema.agentSessions.id, id));
    return c.json({ ok: true }, 200);
  })

  .patch("/sessions/:id/status", async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json<{ status: string }>();
    await db
      .update(schema.agentSessions)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(schema.agentSessions.id, id));
    return c.json({ ok: true }, 200);
  })

  // ─── Token Events ──────────────────────────────────────────────────────
  .post("/sessions/:id/tokens", async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json<{
      role: string;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      model: string;
      prompt?: string;
    }>();

    const costUsd = calcCost(body.model, body.inputTokens, body.outputTokens, body.cacheReadTokens, body.cacheWriteTokens);
    const eventId = randomUUID();

    await db.insert(schema.tokenEvents).values({
      id: eventId,
      sessionId: id,
      role: body.role,
      inputTokens: body.inputTokens,
      outputTokens: body.outputTokens,
      cacheReadTokens: body.cacheReadTokens,
      cacheWriteTokens: body.cacheWriteTokens,
      costUsd,
      model: body.model,
      prompt: body.prompt ? body.prompt.slice(0, 200) : null,
    });

    // Update session totals
    await db
      .update(schema.agentSessions)
      .set({
        totalInputTokens: sql`${schema.agentSessions.totalInputTokens} + ${body.inputTokens}`,
        totalOutputTokens: sql`${schema.agentSessions.totalOutputTokens} + ${body.outputTokens}`,
        totalCacheReadTokens: sql`${schema.agentSessions.totalCacheReadTokens} + ${body.cacheReadTokens}`,
        totalCacheWriteTokens: sql`${schema.agentSessions.totalCacheWriteTokens} + ${body.cacheWriteTokens}`,
        totalCostUsd: sql`${schema.agentSessions.totalCostUsd} + ${costUsd}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.agentSessions.id, id));

    return c.json({ eventId, costUsd }, 201);
  })

  .get("/sessions/:id/tokens", async (c) => {
    const { id } = c.req.param();
    const rawEvents = await db
      .select()
      .from(schema.tokenEvents)
      .where(eq(schema.tokenEvents.sessionId, id))
      .orderBy(desc(schema.tokenEvents.createdAt))
      .limit(100);
    // Map to mobile-expected shape
    const events = rawEvents.map((e) => ({
      ...e,
      promptTokens: e.inputTokens,
      completionTokens: e.outputTokens,
      totalTokens: e.inputTokens + e.outputTokens,
      cost: e.costUsd.toFixed(8),
      eventType: e.role || "completion",
    }));
    return c.json({ events }, 200);
  })

  // Alias: /sessions/:id/events -> same as /tokens
  .get("/sessions/:id/events", async (c) => {
    const { id } = c.req.param();
    const rawEvents = await db
      .select()
      .from(schema.tokenEvents)
      .where(eq(schema.tokenEvents.sessionId, id))
      .orderBy(schema.tokenEvents.createdAt)
      .limit(200);
    const events = rawEvents.map((e) => ({
      ...e,
      promptTokens: e.inputTokens,
      completionTokens: e.outputTokens,
      totalTokens: e.inputTokens + e.outputTokens,
      cost: e.costUsd.toFixed(8),
      eventType: e.role || "completion",
    }));
    return c.json({ events }, 200);
  })

  // POST /api/events — simple webhook endpoint for agents to post token data
  .post("/events", async (c) => {
    const body = await c.req.json<{ sessionId: string; model: string; promptTokens?: number; completionTokens?: number; totalTokens?: number; cost?: number }>();
    const inputTokens = body.promptTokens ?? 0;
    const outputTokens = body.completionTokens ?? 0;
    const costUsd = body.cost ?? calcCost(body.model, inputTokens, outputTokens, 0, 0);
    const eventId = randomUUID();
    await db.insert(schema.tokenEvents).values({
      id: eventId,
      sessionId: body.sessionId,
      role: "completion",
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd,
      model: body.model,
    });
    await db.update(schema.agentSessions).set({
      totalInputTokens: sql`${schema.agentSessions.totalInputTokens} + ${inputTokens}`,
      totalOutputTokens: sql`${schema.agentSessions.totalOutputTokens} + ${outputTokens}`,
      totalCostUsd: sql`${schema.agentSessions.totalCostUsd} + ${costUsd}`,
      updatedAt: new Date(),
    }).where(eq(schema.agentSessions.id, body.sessionId));
    return c.json({ ok: true, eventId, costUsd }, 201);
  })

  // ─── Optimization ──────────────────────────────────────────────────────
  .post("/sessions/:id/optimize", async (c) => {
    const { id } = c.req.param();
    const sessions = await db.select().from(schema.agentSessions).where(eq(schema.agentSessions.id, id)).limit(1);
    if (!sessions[0]) return c.json({ error: "not found" }, 404);
    const session = sessions[0];

    const tipData = generateOptimizationTips(session);

    // Clear old tips, insert new ones
    const tipIds: string[] = [];
    for (const t of tipData) {
      const tipId = randomUUID();
      tipIds.push(tipId);
      await db.insert(schema.optimizationTips).values({
        id: tipId,
        sessionId: id,
        tip: t.tip,
        category: t.category,
        estimatedSavingPct: t.estimatedSavingPct,
      });
    }

    // Compute optimization score (0-100: higher = more optimized)
    const cacheHitRate = session.totalCacheReadTokens / Math.max(session.totalInputTokens, 1);
    const modelEfficiency = session.model.includes("haiku") || session.model.includes("flash") || session.model.includes("mini") ? 1 : session.model.includes("sonnet") || session.model.includes("4o") || session.model.includes("flash") ? 0.7 : 0.4;
    const score = Math.round(Math.min(100, cacheHitRate * 50 + modelEfficiency * 50));

    await db.update(schema.agentSessions).set({ optimizationScore: score, updatedAt: new Date() }).where(eq(schema.agentSessions.id, id));

    return c.json({ tips: tipData, optimizationScore: score }, 200);
  })

  .get("/sessions/:id/tips", async (c) => {
    const { id } = c.req.param();
    const tips = await db
      .select()
      .from(schema.optimizationTips)
      .where(eq(schema.optimizationTips.sessionId, id))
      .orderBy(desc(schema.optimizationTips.createdAt))
      .limit(20);
    return c.json({ tips }, 200);
  })

  // ─── Analytics / Dashboard ─────────────────────────────────────────────
  .get("/analytics", async (c) => {
    const sessions = await db.select().from(schema.agentSessions);
    const totalSessions = sessions.length;
    const totalCostRaw = sessions.reduce((s, x) => s + x.totalCostUsd, 0);
    const totalInputTokens = sessions.reduce((s, x) => s + x.totalInputTokens, 0);
    const totalOutputTokens = sessions.reduce((s, x) => s + x.totalOutputTokens, 0);
    const totalCacheReadTokens = sessions.reduce((s, x) => s + x.totalCacheReadTokens, 0);
    const totalTokens = totalInputTokens + totalOutputTokens;
    const activeSessions = sessions.filter((s) => s.status === "active").length;
    const avgCostPerSession = totalSessions > 0 ? totalCostRaw / totalSessions : 0;

    // Model breakdown
    const modelMap: Record<string, { totalTokens: number; promptTokens: number; completionTokens: number; totalCost: number; sessionCount: number }> = {};
    for (const s of sessions) {
      if (!modelMap[s.model]) modelMap[s.model] = { totalTokens: 0, promptTokens: 0, completionTokens: 0, totalCost: 0, sessionCount: 0 };
      modelMap[s.model].totalTokens += s.totalInputTokens + s.totalOutputTokens;
      modelMap[s.model].promptTokens += s.totalInputTokens;
      modelMap[s.model].completionTokens += s.totalOutputTokens;
      modelMap[s.model].totalCost += s.totalCostUsd;
      modelMap[s.model].sessionCount += 1;
    }
    const modelBreakdown = Object.entries(modelMap)
      .map(([model, stats]) => ({ model, ...stats, totalCost: stats.totalCost.toFixed(6) }))
      .sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost));

    const topModel = modelBreakdown[0]?.model || "";

    // Estimated savings from caching
    const cacheHitRate = totalCacheReadTokens / Math.max(totalInputTokens, 1);
    const estimatedSavingsPct = Math.round(cacheHitRate * 80);
    const projectedMonthlyCost = totalCostRaw > 0 ? (totalCostRaw / Math.max(totalSessions, 1)) * 30 : 0;

    return c.json(
      {
        totalSessions,
        activeSessions,
        totalCost: totalCostRaw.toFixed(6),
        totalTokens,
        totalInputTokens,
        totalOutputTokens,
        totalCacheReadTokens,
        avgCostPerSession: avgCostPerSession.toFixed(6),
        topModel,
        modelBreakdown,
        cacheHitRate,
        estimatedSavingsPct,
        projectedMonthlyCost,
      },
      200
    );
  })

  // ─── Demo seed ────────────────────────────────────────────────────────
  .post("/demo/seed", async (c) => {
    const demoSessions = [
      { name: "Fix auth middleware", agentType: "claude-code", model: "claude-sonnet-4-5", status: "completed" },
      { name: "Write unit tests", agentType: "claude-code", model: "claude-haiku-3-5", status: "completed" },
      { name: "Refactor DB schema", agentType: "opencode", model: "gpt-4o", status: "active" },
      { name: "Build REST API", agentType: "claude-code", model: "claude-opus-4-5", status: "ended" },
    ];

    const eventTemplates = [
      { inputTokens: 2400, outputTokens: 890, cacheReadTokens: 1800, cacheWriteTokens: 0 },
      { inputTokens: 3200, outputTokens: 1200, cacheReadTokens: 2800, cacheWriteTokens: 0 },
      { inputTokens: 1800, outputTokens: 440, cacheReadTokens: 0, cacheWriteTokens: 1800 },
      { inputTokens: 4500, outputTokens: 2100, cacheReadTokens: 4000, cacheWriteTokens: 0 },
      { inputTokens: 2900, outputTokens: 760, cacheReadTokens: 2500, cacheWriteTokens: 0 },
      { inputTokens: 1200, outputTokens: 380, cacheReadTokens: 1000, cacheWriteTokens: 0 },
      { inputTokens: 5800, outputTokens: 3200, cacheReadTokens: 5200, cacheWriteTokens: 0 },
      { inputTokens: 3100, outputTokens: 920, cacheReadTokens: 2800, cacheWriteTokens: 0 },
    ];

    for (const sessionData of demoSessions) {
      const sessionId = randomUUID();
      let totalCostUsd = 0;
      let totalInput = 0;
      let totalOutput = 0;
      let totalCacheRead = 0;
      let totalCacheWrite = 0;

      await db.insert(schema.agentSessions).values({
        id: sessionId,
        name: sessionData.name,
        agentType: sessionData.agentType,
        model: sessionData.model,
        status: sessionData.status,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheWriteTokens: 0,
        totalCostUsd: 0,
        optimizationScore: null,
      });

      const numEvents = 4 + Math.floor(Math.random() * 5);
      for (let i = 0; i < numEvents; i++) {
        const ev = eventTemplates[i % eventTemplates.length];
        const cost = calcCost(sessionData.model, ev.inputTokens, ev.outputTokens, ev.cacheReadTokens, ev.cacheWriteTokens);
        totalCostUsd += cost;
        totalInput += ev.inputTokens;
        totalOutput += ev.outputTokens;
        totalCacheRead += ev.cacheReadTokens;
        totalCacheWrite += ev.cacheWriteTokens;

        await db.insert(schema.tokenEvents).values({
          id: randomUUID(),
          sessionId,
          role: i % 2 === 0 ? "user" : "assistant",
          model: sessionData.model,
          inputTokens: ev.inputTokens,
          outputTokens: ev.outputTokens,
          cacheReadTokens: ev.cacheReadTokens,
          cacheWriteTokens: ev.cacheWriteTokens,
          costUsd: cost,
          prompt: `[demo] ${sessionData.name} turn ${i + 1}`,
        });
      }

      const cacheHitRate = totalCacheRead / Math.max(totalInput, 1);
      const optimizationScore = Math.round(Math.max(0, Math.min(100, 50 + cacheHitRate * 40 + (totalOutput < totalInput ? 10 : 0))));

      await db.update(schema.agentSessions)
        .set({
          totalCostUsd,
          totalInputTokens: totalInput,
          totalOutputTokens: totalOutput,
          totalCacheReadTokens: totalCacheRead,
          totalCacheWriteTokens: totalCacheWrite,
          optimizationScore,
          updatedAt: new Date(),
        })
        .where(eq(schema.agentSessions.id, sessionId));
    }

    return c.json({ ok: true, message: "Demo data seeded", sessions: demoSessions.length }, 200);
  })

  // ─── Budget config ─────────────────────────────────────────────────────
  .get("/budget", (c) => {
    const cfg = loadBudget();
    return c.json(cfg, 200);
  })

  .post("/budget", async (c) => {
    const body = await c.req.json<Partial<BudgetConfig>>();
    const current = loadBudget();
    const updated: BudgetConfig = {
      dailyLimitUsd: body.dailyLimitUsd !== undefined ? body.dailyLimitUsd : current.dailyLimitUsd,
      monthlyLimitUsd: body.monthlyLimitUsd !== undefined ? body.monthlyLimitUsd : current.monthlyLimitUsd,
      alertAtPct: body.alertAtPct !== undefined ? body.alertAtPct : current.alertAtPct,
    };
    saveBudget(updated);
    return c.json(updated, 200);
  })

  // ─── Alerts — compute active budget alerts ─────────────────────────────
  .get("/alerts", async (c) => {
    const cfg = loadBudget();
    const sessions = await db.select().from(schema.agentSessions);
    const totalCost = sessions.reduce((s, x) => s + x.totalCostUsd, 0);
    const alerts: Array<{ level: "warn" | "critical"; message: string; type: string }> = [];

    if (cfg.monthlyLimitUsd !== null) {
      const pct = (totalCost / cfg.monthlyLimitUsd) * 100;
      if (pct >= 100) {
        alerts.push({ level: "critical", type: "budget", message: `Monthly budget of ${cfg.monthlyLimitUsd} EXCEEDED (${totalCost.toFixed(2)} spent)` });
      } else if (pct >= cfg.alertAtPct) {
        alerts.push({ level: "warn", type: "budget", message: `${Math.round(pct)}% of monthly budget used (${totalCost.toFixed(2)} / ${cfg.monthlyLimitUsd})` });
      }
    }

    if (cfg.dailyLimitUsd !== null && totalCost >= cfg.dailyLimitUsd * (cfg.alertAtPct / 100)) {
      alerts.push({ level: "warn", type: "daily", message: `Daily spend approaching ${cfg.dailyLimitUsd} limit` });
    }

    return c.json({ alerts, totalCost: totalCost.toFixed(6), budget: cfg }, 200);
  })

  // ─── Model comparison ─────────────────────────────────────────────────
  .post("/compare-models", async (c) => {
    const body = await c.req.json<{ inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }>();
    const comparison = Object.entries(MODEL_PRICING).map(([modelId, pricing]) => ({
      modelId,
      provider: pricing.provider,
      displayName: pricing.displayName,
      costUsd: calcCost(modelId, body.inputTokens, body.outputTokens, body.cacheReadTokens, body.cacheWriteTokens),
    })).sort((a, b) => a.costUsd - b.costUsd);
    return c.json({ comparison }, 200);
  });

export type AppType = typeof app;
export default app;
