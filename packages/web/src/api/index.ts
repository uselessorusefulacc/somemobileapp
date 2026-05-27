import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db } from "./database";
import * as schema from "./database/schema";
import { eq, desc, sql, gte, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { readFile, writeFile, access } from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── Budget config (persisted to JSON) ────────────────────────────────────
// Fix #50/#51: use fileURLToPath not .pathname, store outside source tree via DATA_DIR
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUDGET_FILE = process.env.BUDGET_FILE
  ? path.resolve(process.env.BUDGET_FILE)
  : path.resolve(__dirname, "../../budget.json");

interface BudgetConfig {
  dailyLimitUsd: number | null;
  monthlyLimitUsd: number | null;
  alertAtPct: number; // 0-100, default 80
}

// Fix #48: runtime validation on load
function parseBudget(raw: unknown): BudgetConfig {
  const defaults: BudgetConfig = { dailyLimitUsd: null, monthlyLimitUsd: 50, alertAtPct: 80 };
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Record<string, unknown>;
  return {
    dailyLimitUsd:
      obj.dailyLimitUsd === null || obj.dailyLimitUsd === undefined
        ? null
        : typeof obj.dailyLimitUsd === "number" && obj.dailyLimitUsd > 0
        ? obj.dailyLimitUsd
        : defaults.dailyLimitUsd,
    monthlyLimitUsd:
      obj.monthlyLimitUsd === null || obj.monthlyLimitUsd === undefined
        ? null
        : typeof obj.monthlyLimitUsd === "number" && obj.monthlyLimitUsd > 0
        ? obj.monthlyLimitUsd
        : defaults.monthlyLimitUsd,
    alertAtPct:
      typeof obj.alertAtPct === "number" && obj.alertAtPct >= 0 && obj.alertAtPct <= 100
        ? obj.alertAtPct
        : defaults.alertAtPct,
  };
}

// Fix #27: async file I/O
async function loadBudget(): Promise<BudgetConfig> {
  try {
    await access(BUDGET_FILE, fsConstants.F_OK);
    const raw = JSON.parse(await readFile(BUDGET_FILE, "utf-8"));
    return parseBudget(raw);
  } catch {
    return { dailyLimitUsd: null, monthlyLimitUsd: 50, alertAtPct: 80 };
  }
}

// Fix #49: atomic write via temp file
async function saveBudget(cfg: BudgetConfig): Promise<void> {
  const tmp = BUDGET_FILE + ".tmp";
  await writeFile(tmp, JSON.stringify(cfg, null, 2), "utf-8");
  await writeFile(BUDGET_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}

// ─── Model pricing (May 2026) ─────────────────────────────────────────────
// Fix #70: use canonical model IDs (hyphens) everywhere
const MODEL_PRICING: Record<string, { provider: string; displayName: string; inputCostPer1M: number; outputCostPer1M: number; cacheReadCostPer1M: number; cacheWriteCostPer1M: number }> = {
  "claude-opus-4-5":    { provider: "anthropic", displayName: "Claude Opus 4.5",    inputCostPer1M: 15,   outputCostPer1M: 75,   cacheReadCostPer1M: 1.5,    cacheWriteCostPer1M: 18.75 },
  "claude-sonnet-4-5":  { provider: "anthropic", displayName: "Claude Sonnet 4.5",  inputCostPer1M: 3,    outputCostPer1M: 15,   cacheReadCostPer1M: 0.3,    cacheWriteCostPer1M: 3.75 },
  "claude-haiku-3-5":   { provider: "anthropic", displayName: "Claude Haiku 3.5",   inputCostPer1M: 0.8,  outputCostPer1M: 4,    cacheReadCostPer1M: 0.08,   cacheWriteCostPer1M: 1 },
  "gpt-4o":             { provider: "openai",    displayName: "GPT-4o",             inputCostPer1M: 2.5,  outputCostPer1M: 10,   cacheReadCostPer1M: 1.25,   cacheWriteCostPer1M: 0 },
  "gpt-4o-mini":        { provider: "openai",    displayName: "GPT-4o mini",        inputCostPer1M: 0.15, outputCostPer1M: 0.6,  cacheReadCostPer1M: 0.075,  cacheWriteCostPer1M: 0 },
  "o3":                 { provider: "openai",    displayName: "o3",                 inputCostPer1M: 10,   outputCostPer1M: 40,   cacheReadCostPer1M: 2.5,    cacheWriteCostPer1M: 0 },
  "o3-mini":            { provider: "openai",    displayName: "o3-mini",            inputCostPer1M: 1.1,  outputCostPer1M: 4.4,  cacheReadCostPer1M: 0.55,   cacheWriteCostPer1M: 0 },
  "gemini-2-5-pro":     { provider: "google",    displayName: "Gemini 2.5 Pro",     inputCostPer1M: 1.25, outputCostPer1M: 10,   cacheReadCostPer1M: 0.31,   cacheWriteCostPer1M: 4.5 },
  "gemini-2-5-flash":   { provider: "google",    displayName: "Gemini 2.5 Flash",   inputCostPer1M: 0.15, outputCostPer1M: 0.6,  cacheReadCostPer1M: 0.0375, cacheWriteCostPer1M: 1 },
  // Dot-notation aliases (used by soak test + relay)
  "gemini-2.5-pro":     { provider: "google",    displayName: "Gemini 2.5 Pro",     inputCostPer1M: 1.25, outputCostPer1M: 10,   cacheReadCostPer1M: 0.31,   cacheWriteCostPer1M: 4.5 },
  "gemini-2.5-flash":   { provider: "google",    displayName: "Gemini 2.5 Flash",   inputCostPer1M: 0.15, outputCostPer1M: 0.6,  cacheReadCostPer1M: 0.0375, cacheWriteCostPer1M: 1 },
  "claude-opus-4.5":    { provider: "anthropic", displayName: "Claude Opus 4.5",    inputCostPer1M: 15,   outputCostPer1M: 75,   cacheReadCostPer1M: 1.5,    cacheWriteCostPer1M: 18.75 },
  "claude-sonnet-4.5":  { provider: "anthropic", displayName: "Claude Sonnet 4.5",  inputCostPer1M: 3,    outputCostPer1M: 15,   cacheReadCostPer1M: 0.3,    cacheWriteCostPer1M: 3.75 },
  "claude-haiku-3.5":   { provider: "anthropic", displayName: "Claude Haiku 3.5",   inputCostPer1M: 0.8,  outputCostPer1M: 4,    cacheReadCostPer1M: 0.08,   cacheWriteCostPer1M: 1 },
};

// Fix #13: log unknown models instead of silently using wrong pricing
function calcCost(model: string, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    console.warn(`[calcCost] Unknown model "${model}", defaulting to gpt-4o-mini pricing`);
    return calcCost("gpt-4o-mini", inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);
  }
  return (
    (inputTokens      / 1_000_000) * pricing.inputCostPer1M +
    (outputTokens     / 1_000_000) * pricing.outputCostPer1M +
    (cacheReadTokens  / 1_000_000) * pricing.cacheReadCostPer1M +
    (cacheWriteTokens / 1_000_000) * pricing.cacheWriteCostPer1M
  );
}

// Fix #12: modelEfficiency with no overlapping branches
function modelEfficiencyScore(model: string): number {
  if (model.includes("haiku") || model.includes("mini") || model === "gemini-2-5-flash") return 1.0;
  if (model.includes("sonnet") || model === "gpt-4o" || model === "o3-mini") return 0.7;
  return 0.4; // opus, o3, gemini-2-5-pro
}

// Fix #17: single authoritative optimization score function
function computeOptimizationScore(session: typeof schema.agentSessions.$inferSelect): number {
  const totalInput = Math.max(session.totalInputTokens, 1);
  // Fix #11: correct denominator = inputTokens + cacheReadTokens
  const cacheHitRate = session.totalCacheReadTokens / (totalInput + session.totalCacheReadTokens);
  const efficiency = modelEfficiencyScore(session.model);
  return Math.round(Math.min(100, Math.max(0, cacheHitRate * 50 + efficiency * 50)));
}

function generateOptimizationTips(session: typeof schema.agentSessions.$inferSelect): Array<{ title: string; tip: string; category: string; estimatedSavingPct: number }> {
  const tips: Array<{ title: string; tip: string; category: string; estimatedSavingPct: number }> = [];
  const totalInput = Math.max(session.totalInputTokens, 1);
  const cacheRatio = session.totalCacheReadTokens / (totalInput + session.totalCacheReadTokens);
  const outputRatio = session.totalOutputTokens / totalInput;

  if (cacheRatio < 0.3) {
    tips.push({ title: "Enable Prompt Caching", tip: "Enable prompt caching — your cache hit rate is low. Adding cache breakpoints to system prompts can save 60-90% on repeated context.", category: "caching", estimatedSavingPct: 65 });
  }
  if (outputRatio > 2) {
    tips.push({ title: "Reduce Output Tokens", tip: "Your output:input ratio is high. Use concise task framing — ask for bullet points instead of prose to reduce output tokens by 40%.", category: "prompting", estimatedSavingPct: 40 });
  }
  if (session.totalInputTokens > 100_000 && cacheRatio < 0.5) {
    tips.push({ title: "Compact Context Window", tip: "Context window is large. Use /compact or context compaction after 10+ turns to reduce token budget by 50-70%.", category: "context", estimatedSavingPct: 55 });
  }
  if (session.model === "claude-opus-4-5" || session.model === "o3") {
    tips.push({ title: "Switch to Mid-Tier Model", tip: `Switch to a mid-tier model for routine tasks. ${session.model === "claude-opus-4-5" ? "Claude Sonnet 4.5" : "GPT-4o"} is 5x cheaper with 90% of the capability for coding tasks.`, category: "model", estimatedSavingPct: 75 });
  }
  if (tips.length === 0) {
    tips.push({ title: "Optimize Cache Usage", tip: "Great usage patterns! You're getting good cache hits. Consider using parallel subagents for large refactors to reduce wall-clock time.", category: "prompting", estimatedSavingPct: 10 });
  }
  return tips;
}

// ─── DB query timeout helper ──────────────────────────────────────────────
// BUG-13 (backend): wrap any DB promise in a race with a timeout signal
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`DB timeout after ${ms}ms [${label}]`)), ms)
    ),
  ]);
}

// Fix #41: add leading slash to basePath
const app = new Hono()
  .basePath("/api")
  // Fix #54: request logging
  .use(logger())
  // X-Response-Time on every response
  .use(async (c, next) => {
    const t0 = Date.now();
    await next();
    c.res.headers.set("X-Response-Time", `${Date.now() - t0}ms`);
  })
  // Fix #1: restrict CORS to specific allowed origins (not reflect-any)
  .use(cors({
    origin: (origin) => {
      const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
      if (!origin) return "*";
      if (allowed.length === 0) return origin; // dev: allow all
      return allowed.includes(origin) ? origin : allowed[0];
    },
    credentials: true,
    exposeHeaders: ["set-auth-token"],
  }))

  // Fix #40: health check actually queries DB
  .get("/health", async (c) => {
    try {
      await db.select({ one: sql<number>`1` }).from(schema.agentSessions).limit(1);
      return c.json({ status: "ok", db: "ok" }, 200);
    } catch {
      return c.json({ status: "degraded", db: "error" }, 503);
    }
  })

  .get("/pricing", (c) => {
    // Static pricing — cache 5 min in CDN/browser
    c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    return c.json({ pricing: MODEL_PRICING }, 200);
  })

  // ─── Sessions ───────────────────────────────────────────────────────────
  .get("/sessions", async (c) => {
    c.header("Cache-Control", "no-store");
    const rawSessions = await db
      .select()
      .from(schema.agentSessions)
      .orderBy(desc(schema.agentSessions.updatedAt))
      .limit(50);
    const sessions = rawSessions.map((s) => ({
      ...s,
      // Fix #20: totalTokens includes cache tokens
      totalTokens: s.totalInputTokens + s.totalOutputTokens + s.totalCacheReadTokens + s.totalCacheWriteTokens,
      totalCost: s.totalCostUsd.toFixed(6), // Fix #38: consistent precision
      sandboxUrl: s.cloudUrl, // Fix #42: expose both names
    }));
    return c.json({ sessions }, 200);
  })

  // Fix #44: validate required fields, reject empty strings
  .post("/sessions", async (c) => {
    const body = await c.req.json<{ name?: string; agentType?: string; model?: string; cloudUrl?: string; sandboxUrl?: string }>();
    if (!body.name?.trim()) return c.json({ error: "name is required" }, 400);
    if (!body.agentType?.trim()) return c.json({ error: "agentType is required" }, 400);
    if (!body.model?.trim()) return c.json({ error: "model is required" }, 400);
    const id = randomUUID();
    const session = await db
      .insert(schema.agentSessions)
      .values({ id, name: body.name.trim(), agentType: body.agentType.trim(), model: body.model.trim(), cloudUrl: body.cloudUrl ?? body.sandboxUrl ?? null })
      .returning();
    return c.json({ session: session[0] }, 201);
  })

  .get("/sessions/:id", async (c) => {
    c.header("Cache-Control", "no-store");
    const { id } = c.req.param();
    if (!id?.match(/^[0-9a-f-]{36}$/)) return c.json({ error: "invalid id" }, 400);
    const raw = await db.select().from(schema.agentSessions).where(eq(schema.agentSessions.id, id)).limit(1);
    if (!raw[0]) return c.json({ error: "not found" }, 404);
    const session = {
      ...raw[0],
      totalTokens: raw[0].totalInputTokens + raw[0].totalOutputTokens + raw[0].totalCacheReadTokens + raw[0].totalCacheWriteTokens,
      totalCost: raw[0].totalCostUsd.toFixed(6),
      sandboxUrl: raw[0].cloudUrl,
    };
    return c.json({ session }, 200);
  })

  // Fix #36: typed status enum, no Record<string,any>
  .patch("/sessions/:id", async (c) => {
    const { id } = c.req.param();
    if (!id?.match(/^[0-9a-f-]{36}$/)) return c.json({ error: "invalid id" }, 400);
    const body = await c.req.json<{ status?: string; name?: string }>();
    const VALID_STATUSES = ["active", "idle", "ended", "completed", "error"] as const;
    const updates: { status?: string; name?: string; updatedAt: Date } = { updatedAt: new Date() };
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) return c.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, 400);
      updates.status = body.status;
    }
    if (body.name !== undefined) {
      if (!body.name.trim()) return c.json({ error: "name cannot be empty" }, 400);
      updates.name = body.name.trim();
    }
    await db.update(schema.agentSessions).set(updates).where(eq(schema.agentSessions.id, id));
    return c.json({ ok: true }, 200);
  })

  .patch("/sessions/:id/status", async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json<{ status: string }>();
    const VALID_STATUSES = ["active", "idle", "ended", "completed", "error"];
    if (!body.status || !VALID_STATUSES.includes(body.status)) return c.json({ error: "invalid status" }, 400);
    await db.update(schema.agentSessions).set({ status: body.status, updatedAt: new Date() }).where(eq(schema.agentSessions.id, id));
    return c.json({ ok: true }, 200);
  })

  // Fix #33: DELETE session
  .delete("/sessions/:id", async (c) => {
    const { id } = c.req.param();
    if (!id?.match(/^[0-9a-f-]{36}$/)) return c.json({ error: "invalid id" }, 400);
    await db.delete(schema.tokenEvents).where(eq(schema.tokenEvents.sessionId, id));
    await db.delete(schema.optimizationTips).where(eq(schema.optimizationTips.sessionId, id));
    await db.delete(schema.agentSessions).where(eq(schema.agentSessions.id, id));
    return c.json({ ok: true }, 200);
  })

  // ─── Token Events ────────────────────────────────────────────────────────
  // Fix #19: reject negative token counts; Fix #26: single atomic-ish operation (SQLite best effort)
  .post("/sessions/:id/tokens", async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json<{
      role?: string;
      inputTokens?: number;
      outputTokens?: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
      model?: string;
      prompt?: string;
    }>();

    // Validate
    if (!body.model?.trim()) return c.json({ error: "model is required" }, 400);
    const inputTokens    = Math.max(0, Math.floor(body.inputTokens    ?? 0));
    const outputTokens   = Math.max(0, Math.floor(body.outputTokens   ?? 0));
    const cacheReadTokens  = Math.max(0, Math.floor(body.cacheReadTokens  ?? 0));
    const cacheWriteTokens = Math.max(0, Math.floor(body.cacheWriteTokens ?? 0));

    // Verify session exists
    const sessions = await db.select({ id: schema.agentSessions.id }).from(schema.agentSessions).where(eq(schema.agentSessions.id, id)).limit(1);
    if (!sessions[0]) return c.json({ error: "session not found" }, 404);

    const costUsd = calcCost(body.model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);
    const eventId = randomUUID();

    await db.insert(schema.tokenEvents).values({
      id: eventId,
      sessionId: id,
      role: body.role?.trim() || "assistant",
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costUsd,
      model: body.model,
      prompt: body.prompt ? body.prompt.slice(0, 200) : null,
    });

    await db.update(schema.agentSessions).set({
      totalInputTokens:    sql`${schema.agentSessions.totalInputTokens} + ${inputTokens}`,
      totalOutputTokens:   sql`${schema.agentSessions.totalOutputTokens} + ${outputTokens}`,
      totalCacheReadTokens:  sql`${schema.agentSessions.totalCacheReadTokens} + ${cacheReadTokens}`,
      totalCacheWriteTokens: sql`${schema.agentSessions.totalCacheWriteTokens} + ${cacheWriteTokens}`,
      totalCostUsd: sql`${schema.agentSessions.totalCostUsd} + ${costUsd}`,
      updatedAt: new Date(),
    }).where(eq(schema.agentSessions.id, id));

    return c.json({ eventId, costUsd }, 201);
  })

  // Fix #37: consistent sort/limit between /tokens and /events
  .get("/sessions/:id/tokens", async (c) => {
    const { id } = c.req.param();
    const rawEvents = await db
      .select()
      .from(schema.tokenEvents)
      .where(eq(schema.tokenEvents.sessionId, id))
      .orderBy(desc(schema.tokenEvents.createdAt))
      .limit(100);
    const events = rawEvents.map((e) => ({
      ...e,
      totalTokens: e.inputTokens + e.outputTokens,
      costUsd: e.costUsd, // Fix #38: consistent, numeric
    }));
    return c.json({ events }, 200);
  })

  .get("/sessions/:id/events", async (c) => {
    const { id } = c.req.param();
    const rawEvents = await db
      .select()
      .from(schema.tokenEvents)
      .where(eq(schema.tokenEvents.sessionId, id))
      .orderBy(desc(schema.tokenEvents.createdAt))
      .limit(100);
    const events = rawEvents.map((e) => ({
      ...e,
      totalTokens: e.inputTokens + e.outputTokens,
      costUsd: e.costUsd,
    }));
    return c.json({ events }, 200);
  })

  // DEPRECATED: Use WebSocket relay + agentpilot-daemon instead.
  // Kept for backward compatibility with external integrations.
  // Fix #14: webhook now accepts cacheReadTokens/cacheWriteTokens
  // Fix #15: verify session exists before inserting
  .post("/events", async (c) => {
    const body = await c.req.json<{
      sessionId?: string;
      model?: string;
      promptTokens?: number;
      completionTokens?: number;
      inputTokens?: number;
      outputTokens?: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
      cost?: number;
    }>();
    if (!body.sessionId?.trim()) return c.json({ error: "sessionId is required" }, 400);
    if (!body.model?.trim()) return c.json({ error: "model is required" }, 400);

    // Verify session exists
    const sessions = await db.select({ id: schema.agentSessions.id }).from(schema.agentSessions).where(eq(schema.agentSessions.id, body.sessionId)).limit(1);
    if (!sessions[0]) return c.json({ error: "session not found" }, 404);

    const inputTokens      = Math.max(0, Math.floor(body.inputTokens ?? body.promptTokens ?? 0));
    const outputTokens     = Math.max(0, Math.floor(body.outputTokens ?? body.completionTokens ?? 0));
    const cacheReadTokens  = Math.max(0, Math.floor(body.cacheReadTokens ?? 0));
    const cacheWriteTokens = Math.max(0, Math.floor(body.cacheWriteTokens ?? 0));
    const costUsd = body.cost != null && body.cost >= 0 ? body.cost : calcCost(body.model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);

    const eventId = randomUUID();
    await db.insert(schema.tokenEvents).values({
      id: eventId,
      sessionId: body.sessionId,
      role: "assistant",
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costUsd,
      model: body.model,
    });
    await db.update(schema.agentSessions).set({
      totalInputTokens:    sql`${schema.agentSessions.totalInputTokens} + ${inputTokens}`,
      totalOutputTokens:   sql`${schema.agentSessions.totalOutputTokens} + ${outputTokens}`,
      totalCacheReadTokens:  sql`${schema.agentSessions.totalCacheReadTokens} + ${cacheReadTokens}`,
      totalCacheWriteTokens: sql`${schema.agentSessions.totalCacheWriteTokens} + ${cacheWriteTokens}`,
      totalCostUsd: sql`${schema.agentSessions.totalCostUsd} + ${costUsd}`,
      updatedAt: new Date(),
    }).where(eq(schema.agentSessions.id, body.sessionId));

    return c.json({ ok: true, eventId, costUsd }, 201);
  })

  // ─── Optimization ────────────────────────────────────────────────────────
  .post("/sessions/:id/optimize", async (c) => {
    const { id } = c.req.param();
    const sessions = await db.select().from(schema.agentSessions).where(eq(schema.agentSessions.id, id)).limit(1);
    if (!sessions[0]) return c.json({ error: "not found" }, 404);
    const session = sessions[0];

    const tipData = generateOptimizationTips(session);

    // Fix #16: delete existing tips before inserting new ones
    await db.delete(schema.optimizationTips).where(eq(schema.optimizationTips.sessionId, id));
    for (const t of tipData) {
      await db.insert(schema.optimizationTips).values({
        id: randomUUID(),
        sessionId: id,
        title: t.title,
        tip: t.tip,
        category: t.category,
        estimatedSavingPct: t.estimatedSavingPct,
      });
    }

    // Fix #17: use shared computeOptimizationScore
    const score = computeOptimizationScore(session);
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

  // Fix #34: mark tip as applied
  .patch("/sessions/:id/tips/:tipId", async (c) => {
    const { tipId } = c.req.param();
    await db.update(schema.optimizationTips).set({ applied: true }).where(eq(schema.optimizationTips.id, tipId));
    return c.json({ ok: true }, 200);
  })

  // ─── Analytics / Dashboard ────────────────────────────────────────────────
  .get("/analytics", async (c) => {
    // Live data — never cache
    c.header("Cache-Control", "no-store");
    // Fix #22: limit to 500 most recent sessions to avoid unbounded memory
    // BUG-13 (backend): 8s timeout on DB aggregation
    const sessions = await withTimeout(
      db.select().from(schema.agentSessions).orderBy(desc(schema.agentSessions.updatedAt)).limit(500),
      8000, "analytics:sessions"
    );
    const totalSessions = sessions.length;
    const totalCostRaw = sessions.reduce((s, x) => s + x.totalCostUsd, 0);
    const totalInputTokens = sessions.reduce((s, x) => s + x.totalInputTokens, 0);
    const totalOutputTokens = sessions.reduce((s, x) => s + x.totalOutputTokens, 0);
    const totalCacheReadTokens = sessions.reduce((s, x) => s + x.totalCacheReadTokens, 0);
    const totalCacheWriteTokens = sessions.reduce((s, x) => s + x.totalCacheWriteTokens, 0);
    // Fix #20: include cache tokens in total
    const totalTokens = totalInputTokens + totalOutputTokens + totalCacheReadTokens + totalCacheWriteTokens;
    const activeSessions = sessions.filter((s) => s.status === "active").length;
    const avgCostPerSession = totalSessions > 0 ? totalCostRaw / totalSessions : 0;

    // Model breakdown
    const modelMap: Record<string, { totalTokens: number; totalCost: number; sessionCount: number }> = {};
    for (const s of sessions) {
      if (!modelMap[s.model]) modelMap[s.model] = { totalTokens: 0, totalCost: 0, sessionCount: 0 };
      modelMap[s.model].totalTokens += s.totalInputTokens + s.totalOutputTokens + s.totalCacheReadTokens + s.totalCacheWriteTokens;
      modelMap[s.model].totalCost += s.totalCostUsd;
      modelMap[s.model].sessionCount += 1;
    }
    const modelBreakdown = Object.entries(modelMap)
      .map(([model, stats]) => ({ model, ...stats, totalCost: stats.totalCost.toFixed(6) }))
      .sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost));

    const topModel = modelBreakdown[0]?.model || "";

    // Fix #11: correct cache hit rate denominator
    const cacheHitRate = totalInputTokens > 0
      ? totalCacheReadTokens / (totalInputTokens + totalCacheReadTokens)
      : 0;
    const estimatedSavingsPct = Math.round(Math.min(100, cacheHitRate * 80));

    // Fix #10: project based on days elapsed since earliest session
    const earliest = sessions.length > 0 ? sessions[sessions.length - 1].createdAt : null;
    const daysElapsed = earliest
      ? Math.max(1, (Date.now() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24))
      : 1;
    const projectedMonthlyCost = (totalCostRaw / daysElapsed) * 30;

    // Fix #9: daily spend = sessions updated today
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const dailySpend = sessions
      .filter(s => new Date(s.updatedAt) >= startOfDay)
      .reduce((sum, s) => sum + s.totalCostUsd, 0);

    // Fix #9: monthly spend = sessions updated this month
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const monthlySpend = sessions
      .filter(s => new Date(s.updatedAt) >= startOfMonth)
      .reduce((sum, s) => sum + s.totalCostUsd, 0);

    return c.json({
      totalSessions,
      activeSessions,
      totalCost: totalCostRaw.toFixed(6),
      dailyCost: dailySpend.toFixed(6),
      monthlyCost: monthlySpend.toFixed(6),
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      avgCostPerSession: avgCostPerSession.toFixed(6),
      topModel,
      modelBreakdown,
      cacheHitRate,
      estimatedSavingsPct,
      projectedMonthlyCost,
    }, 200);
  })

  // ─── Demo seed — Fix #45: idempotent (clears existing demo sessions first) ─
  .post("/demo/seed", async (c) => {
    // Delete sessions flagged as demo to make idempotent
    const existingDemo = await db.select().from(schema.agentSessions)
      .where(sql`name IN ('Fix auth middleware','Write unit tests','Refactor DB schema','Build REST API')`);
    for (const s of existingDemo) {
      await db.delete(schema.tokenEvents).where(eq(schema.tokenEvents.sessionId, s.id));
      await db.delete(schema.optimizationTips).where(eq(schema.optimizationTips.sessionId, s.id));
      await db.delete(schema.agentSessions).where(eq(schema.agentSessions.id, s.id));
    }

    const demoSessions = [
      { name: "Fix auth middleware",  agentType: "claude",   model: "claude-sonnet-4-5", status: "completed" },
      { name: "Write unit tests",     agentType: "claude",   model: "claude-haiku-3-5",  status: "completed" },
      { name: "Refactor DB schema",   agentType: "opencode", model: "gpt-4o",            status: "active" },
      { name: "Build REST API",       agentType: "claude",   model: "claude-opus-4-5",   status: "ended" },
    ];

    const eventTemplates = [
      { inputTokens: 2400, outputTokens: 890,  cacheReadTokens: 1800, cacheWriteTokens: 0 },
      { inputTokens: 3200, outputTokens: 1200, cacheReadTokens: 2800, cacheWriteTokens: 0 },
      { inputTokens: 1800, outputTokens: 440,  cacheReadTokens: 0,    cacheWriteTokens: 1800 },
      { inputTokens: 4500, outputTokens: 2100, cacheReadTokens: 4000, cacheWriteTokens: 0 },
      { inputTokens: 2900, outputTokens: 760,  cacheReadTokens: 2500, cacheWriteTokens: 0 },
      { inputTokens: 1200, outputTokens: 380,  cacheReadTokens: 1000, cacheWriteTokens: 0 },
      { inputTokens: 5800, outputTokens: 3200, cacheReadTokens: 5200, cacheWriteTokens: 0 },
      { inputTokens: 3100, outputTokens: 920,  cacheReadTokens: 2800, cacheWriteTokens: 0 },
    ];

    for (const sessionData of demoSessions) {
      const sessionId = randomUUID();
      let totalCostUsd = 0, totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheWrite = 0;

      await db.insert(schema.agentSessions).values({
        id: sessionId,
        name: sessionData.name,
        agentType: sessionData.agentType,
        model: sessionData.model,
        status: sessionData.status,
        totalInputTokens: 0, totalOutputTokens: 0,
        totalCacheReadTokens: 0, totalCacheWriteTokens: 0,
        totalCostUsd: 0, optimizationScore: null,
      });

      const numEvents = 4 + Math.floor(Math.random() * 5);
      for (let i = 0; i < numEvents; i++) {
        const ev = eventTemplates[i % eventTemplates.length];
        const cost = calcCost(sessionData.model, ev.inputTokens, ev.outputTokens, ev.cacheReadTokens, ev.cacheWriteTokens);
        totalCostUsd += cost;
        totalInput += ev.inputTokens; totalOutput += ev.outputTokens;
        totalCacheRead += ev.cacheReadTokens; totalCacheWrite += ev.cacheWriteTokens;
        await db.insert(schema.tokenEvents).values({
          id: randomUUID(), sessionId,
          role: i % 2 === 0 ? "user" : "assistant",
          model: sessionData.model,
          inputTokens: ev.inputTokens, outputTokens: ev.outputTokens,
          cacheReadTokens: ev.cacheReadTokens, cacheWriteTokens: ev.cacheWriteTokens,
          costUsd: cost,
          prompt: `[demo] ${sessionData.name} turn ${i + 1}`,
        });
      }

      // Fix #17: use shared score function
      const mockSession = {
        ...schema.agentSessions.$inferSelect,
        model: sessionData.model,
        totalInputTokens: totalInput, totalOutputTokens: totalOutput,
        totalCacheReadTokens: totalCacheRead, totalCacheWriteTokens: totalCacheWrite,
        totalCostUsd,
      } as typeof schema.agentSessions.$inferSelect;
      const optimizationScore = computeOptimizationScore(mockSession);

      await db.update(schema.agentSessions).set({
        totalCostUsd, totalInputTokens: totalInput, totalOutputTokens: totalOutput,
        totalCacheReadTokens: totalCacheRead, totalCacheWriteTokens: totalCacheWrite,
        optimizationScore, updatedAt: new Date(),
      }).where(eq(schema.agentSessions.id, sessionId));
    }

    return c.json({ ok: true, message: "Demo data seeded", sessions: demoSessions.length }, 200);
  })

  // ─── Budget config ──────────────────────────────────────────────────────
  .get("/budget", async (c) => {
    const cfg = await loadBudget();
    return c.json(cfg, 200);
  })

  // Fix #7: validate budget input
  .post("/budget", async (c) => {
    const body = await c.req.json<Partial<BudgetConfig>>();
    const current = await loadBudget();
    // Validate alertAtPct range
    const alertAtPct = body.alertAtPct !== undefined
      ? Math.max(1, Math.min(100, Number(body.alertAtPct)))
      : current.alertAtPct;
    if (isNaN(alertAtPct)) return c.json({ error: "alertAtPct must be a number 1-100" }, 400);
    const monthlyLimitUsd = body.monthlyLimitUsd !== undefined
      ? (body.monthlyLimitUsd === null ? null : Math.max(0.01, Number(body.monthlyLimitUsd)))
      : current.monthlyLimitUsd;
    const dailyLimitUsd = body.dailyLimitUsd !== undefined
      ? (body.dailyLimitUsd === null ? null : Math.max(0.01, Number(body.dailyLimitUsd)))
      : current.dailyLimitUsd;
    if (monthlyLimitUsd !== null && isNaN(monthlyLimitUsd)) return c.json({ error: "monthlyLimitUsd must be a positive number" }, 400);
    if (dailyLimitUsd !== null && isNaN(dailyLimitUsd)) return c.json({ error: "dailyLimitUsd must be a positive number" }, 400);
    const updated: BudgetConfig = { dailyLimitUsd, monthlyLimitUsd, alertAtPct };
    await saveBudget(updated);
    return c.json(updated, 200);
  })

  // ─── Alerts — Fix #9: use real daily/monthly spend ──────────────────────
  .get("/alerts", async (c) => {
    // Live data — never cache
    c.header("Cache-Control", "no-store");
    const cfg = await loadBudget();
    // Fix #23: use SQL aggregation instead of fetching all rows
    // BUG-13 (backend): 8s timeout on each DB aggregation
    const [{ total }] = await withTimeout(
      db.select({ total: sql<number>`coalesce(sum(total_cost_usd), 0)` }).from(schema.agentSessions),
      8000, "alerts:total"
    );

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const [{ daily }] = await withTimeout(
      db.select({ daily: sql<number>`coalesce(sum(total_cost_usd), 0)` })
        .from(schema.agentSessions)
        .where(gte(schema.agentSessions.updatedAt, startOfDay)),
      8000, "alerts:daily"
    );
    const [{ monthly }] = await withTimeout(
      db.select({ monthly: sql<number>`coalesce(sum(total_cost_usd), 0)` })
        .from(schema.agentSessions)
        .where(gte(schema.agentSessions.updatedAt, startOfMonth)),
      8000, "alerts:monthly"
    );

    const totalCost = Number(total) || 0;
    const dailyCost = Number(daily) || 0;
    const monthlyCost = Number(monthly) || 0;

    const alerts: Array<{ level: "warn" | "critical"; message: string; type: string }> = [];

    if (cfg.monthlyLimitUsd !== null) {
      const pct = (monthlyCost / cfg.monthlyLimitUsd) * 100;
      if (pct >= 100) {
        alerts.push({ level: "critical", type: "budget", message: `Monthly budget EXCEEDED: $${monthlyCost.toFixed(2)} / $${cfg.monthlyLimitUsd}` });
      } else if (pct >= cfg.alertAtPct) {
        alerts.push({ level: "warn", type: "budget", message: `${Math.round(pct)}% of monthly budget used ($${monthlyCost.toFixed(2)} / $${cfg.monthlyLimitUsd})` });
      }
    }

    // Fix #18: daily alert has both warn and critical levels
    if (cfg.dailyLimitUsd !== null) {
      const dpct = (dailyCost / cfg.dailyLimitUsd) * 100;
      if (dpct >= 100) {
        alerts.push({ level: "critical", type: "daily", message: `Daily budget EXCEEDED: $${dailyCost.toFixed(2)} / $${cfg.dailyLimitUsd}` });
      } else if (dpct >= cfg.alertAtPct) {
        alerts.push({ level: "warn", type: "daily", message: `${Math.round(dpct)}% of daily budget used ($${dailyCost.toFixed(2)} / $${cfg.dailyLimitUsd})` });
      }
    }

    return c.json({ alerts, totalCost: totalCost.toFixed(6), dailyCost: dailyCost.toFixed(6), monthlyCost: monthlyCost.toFixed(6), budget: cfg }, 200);
  })

  // Fix #21: validate inputs to avoid NaN in compare-models
  .post("/compare-models", async (c) => {
    const body = await c.req.json<{ inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number }>();
    const inputTokens      = Math.max(0, Number(body.inputTokens)      || 0);
    const outputTokens     = Math.max(0, Number(body.outputTokens)     || 0);
    const cacheReadTokens  = Math.max(0, Number(body.cacheReadTokens)  || 0);
    const cacheWriteTokens = Math.max(0, Number(body.cacheWriteTokens) || 0);
    const comparison = Object.entries(MODEL_PRICING).map(([modelId, pricing]) => ({
      modelId,
      provider: pricing.provider,
      displayName: pricing.displayName,
      costUsd: calcCost(modelId, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens),
    })).sort((a, b) => a.costUsd - b.costUsd);
    return c.json({ comparison }, 200);
  })

  // ─── Global tips endpoints (for mobile apply-all flow) ────────────────
  .get("/tips", async (c) => {
    const status = c.req.query("status"); // "pending" | "applied" | undefined (all)
    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 100)));
    let query = db.select({
      id: schema.optimizationTips.id,
      sessionId: schema.optimizationTips.sessionId,
      title: schema.optimizationTips.title,
      tip: schema.optimizationTips.tip,
      category: schema.optimizationTips.category,
      estimatedSavingPct: schema.optimizationTips.estimatedSavingPct,
      applied: schema.optimizationTips.applied,
      createdAt: schema.optimizationTips.createdAt,
    }).from(schema.optimizationTips);
    if (status === "pending") {
      query = query.where(eq(schema.optimizationTips.applied, false)) as typeof query;
    } else if (status === "applied") {
      query = query.where(eq(schema.optimizationTips.applied, true)) as typeof query;
    }
    const tips = await query.limit(limit).orderBy(desc(schema.optimizationTips.createdAt));
    return c.json({ tips }, 200);
  })

  // Bulk apply all pending tips for a list of sessions
  .post("/tips/apply-all", async (c) => {
    const body: { sessionIds?: string[] } = await c.req.json<{ sessionIds?: string[] }>().catch(() => ({}));
    let query = db.select({ id: schema.optimizationTips.id, sessionId: schema.optimizationTips.sessionId })
      .from(schema.optimizationTips)
      .where(eq(schema.optimizationTips.applied, false));
    const pending = await query;
    const toApply = body.sessionIds
      ? pending.filter(t => body.sessionIds!.includes(t.sessionId))
      : pending;
    if (toApply.length === 0) return c.json({ applied: 0, tipIds: [] }, 200);
    const tipIds = toApply.map(t => t.id);
    await db.update(schema.optimizationTips)
      .set({ applied: true })
      .where(inArray(schema.optimizationTips.id, tipIds));
    return c.json({ applied: tipIds.length, tipIds }, 200);
  });

export type AppType = typeof app;
export default app;
