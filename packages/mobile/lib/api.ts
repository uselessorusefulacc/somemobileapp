import Constants from "expo-constants";
import { Platform } from "react-native";

// Resolve the API base URL
// - If app.json extra.apiUrl is set (production/preview), use that
// - Otherwise fall back to localhost:4200
function getApiBase(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (configured) return configured.replace(/\/$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // Web: API is on port 4200, app on 4300
    return window.location.origin.replace(":4300", ":4200").replace(":4301", ":4200");
  }
  return "http://localhost:4200";
}

export const API_BASE = getApiBase();

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentSession {
  id: string;
  name: string;
  agentType: string;
  model: string;
  status: string;
  cloudUrl: string | null;
  sandboxUrl: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalCostUsd: number;
  totalCost: string;
  totalTokens: number;
  optimizationScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TokenEvent {
  id: string;
  sessionId: string;
  role: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  model: string;
  prompt: string | null;
  createdAt: string;
}

export interface OptimizationTip {
  id: string;
  sessionId: string;
  title: string;
  tip: string;
  category: string;
  estimatedSavingPct: number;
  applied: boolean;
  createdAt: string;
}

export interface ModelBreakdown {
  model: string;
  totalTokens: number;
  totalCost: string;
  sessionCount: number;
}

export interface Analytics {
  totalSessions: number;
  activeSessions: number;
  totalCost: string;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  avgCostPerSession: string;
  topModel: string;
  cacheHitRate: number;
  estimatedSavingsPct: number;
  projectedMonthlyCost: number;
  dailyCost: string;
  monthlyCost: string;
  optimizationScore: number | null;
  modelBreakdown: ModelBreakdown[];
}

export interface BudgetConfig {
  dailyLimitUsd: number | null;
  monthlyLimitUsd: number | null;
  alertAtPct: number;
}

export interface BudgetAlert {
  level: "warn" | "critical";
  message: string;
  type: string;
}

export interface ModelComparison {
  modelId: string;
  provider: string;
  displayName: string;
  costUsd: number;
}

// ─── REST client ────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── API methods ────────────────────────────────────────────────────────────

export const apiClient = {
  // Analytics
  getAnalytics: () => apiFetch<Analytics>("/api/analytics"),

  // Sessions
  getSessions: () => apiFetch<{ sessions: AgentSession[] }>("/api/sessions"),
  getSession: async (id: string) => {
    const data = await apiFetch<{ session: AgentSession }>(`/api/sessions/${id}`);
    return data.session;
  },
  createSession: (body: { name: string; agentType: string; model: string; cloudUrl?: string }) =>
    apiFetch<AgentSession>("/api/sessions", { method: "POST", body: JSON.stringify(body) }),
  patchSession: (id: string, body: Partial<Pick<AgentSession, "status" | "name">>) =>
    apiFetch<AgentSession>(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  patchSessionStatus: (id: string, status: string) =>
    apiFetch<AgentSession>(`/api/sessions/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // Events / Tokens
  getEvents: (id: string) =>
    apiFetch<{ events: TokenEvent[] }>(`/api/sessions/${id}/events`),
  addTokens: (id: string, body: object) =>
    apiFetch(`/api/sessions/${id}/tokens`, { method: "POST", body: JSON.stringify(body) }),

  // Tips / Optimize
  getTips: (id: string) =>
    apiFetch<{ tips: OptimizationTip[] }>(`/api/sessions/${id}/tips`),
  optimize: (id: string) =>
    apiFetch<{ tips: OptimizationTip[]; optimizationScore: number }>(`/api/sessions/${id}/optimize`, { method: "POST" }),
  applyOptimizationTip: (sessionId: string, tipId: string) =>
    apiFetch<{ ok: boolean }>(`/api/sessions/${sessionId}/tips/${tipId}`, {
      method: "PATCH",
      body: JSON.stringify({ applied: true }),
    }),

  // Global tips (all sessions)
  getAllTips: (status?: "pending" | "applied") =>
    apiFetch<{ tips: OptimizationTip[] }>(`/api/tips${status ? `?status=${status}` : ""}`),
  applyAllTips: (sessionIds?: string[]) =>
    apiFetch<{ applied: number; tipIds: string[] }>("/api/tips/apply-all", {
      method: "POST",
      body: JSON.stringify({ sessionIds }),
    }),

  // Budget
  getBudget: () => apiFetch<BudgetConfig>("/api/budget"),
  setBudget: (body: Partial<BudgetConfig>) =>
    apiFetch<BudgetConfig>("/api/budget", { method: "POST", body: JSON.stringify(body) }),

  // Alerts
  getAlerts: () =>
    apiFetch<{ alerts: BudgetAlert[]; totalCost: string; budget: BudgetConfig }>("/api/alerts"),

  // Demo seed
  seedDemo: () => apiFetch<{ ok: boolean; message: string }>("/api/demo/seed", { method: "POST" }),
};

// ─── Constants ──────────────────────────────────────────────────────────────

export const AGENT_TYPES = [
  { id: "claude", label: "Claude Code", color: "#d97706", icon: "🧠" },
  { id: "opencode", label: "OpenCode", color: "#6366f1", icon: "⚡" },
  { id: "codex", label: "Codex", color: "#22c55e", icon: "🤖" },
];

export const MODELS = [
  { id: "claude-opus-4-5", label: "Claude Opus 4.5", provider: "Anthropic" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic" },
  { id: "claude-haiku-3-5", label: "Claude Haiku 3.5", provider: "Anthropic" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "OpenAI" },
  { id: "o3", label: "o3", provider: "OpenAI" },
  { id: "gemini-2-5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
  { id: "gemini-2-5-flash", label: "Gemini 2.5 Flash", provider: "Google" },
];
