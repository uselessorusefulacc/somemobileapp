import { apiClient } from "./api";

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  stats: {
    totalSessions: number;
    totalCost: number;
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheReadTokens: number;
    totalCacheWriteTokens: number;
    cacheHitRate: number;
  };
  sessions: Array<{
    id: string;
    name: string;
    agentType: string;
    model: string;
    status: string;
    cost: number;
    tokens: number;
    eventCount: number;
    createdAt: string;
  }>;
}

export async function exportAllData(): Promise<ExportPayload> {
  const [analytics, sessions] = await Promise.allSettled([
    apiClient.getAnalytics(),
    apiClient.getSessions(),
  ]);

  const analyticsVal = analytics.status === "fulfilled" ? analytics.value : { totalSessions: 0, totalCost: "0", totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0, cacheHitRate: 0 };
  const sessionsVal = sessions.status === "fulfilled" ? sessions.value : { sessions: [] };

  const stats = {
    totalSessions: analyticsVal.totalSessions,
    totalCost: parseFloat(String(analyticsVal.totalCost || "0")),
    totalTokens: analyticsVal.totalTokens,
    totalInputTokens: analyticsVal.totalInputTokens,
    totalOutputTokens: analyticsVal.totalOutputTokens,
    totalCacheReadTokens: analyticsVal.totalCacheReadTokens,
    totalCacheWriteTokens: analyticsVal.totalCacheWriteTokens,
    cacheHitRate: analyticsVal.cacheHitRate,
  };

  const allSessions = sessionsVal.sessions || [];
  const sessionList: ExportPayload["sessions"] = [];
  for (let i = 0; i < allSessions.length; i += 10) {
    const chunk = allSessions.slice(i, i + 10);
    const results = await Promise.all(
      chunk.map(async (s) => {
        const events = await apiClient.getEvents(s.id).catch(() => ({ events: [] }));
        return {
          id: s.id,
          name: s.name,
          agentType: s.agentType,
          model: s.model,
          status: s.status,
          cost: parseFloat(String(s.totalCost || "0")),
          tokens: s.totalTokens || 0,
          eventCount: (events.events || []).length,
          createdAt: s.createdAt,
        };
      })
    );
    sessionList.push(...results);
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    stats,
    sessions: sessionList,
  };
}
