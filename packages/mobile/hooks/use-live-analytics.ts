import { useMemo } from "react";
import type { TokenPayload } from "../lib/relay";

export interface OptimizationTip {
  category: "urgent" | "model" | "context" | "caching" | "general";
  message: string;
  action?: string;
  actionParams?: Record<string, unknown>;
  estimatedSaving?: string;
}

export function useLiveAnalytics(events: TokenPayload[]) {
  return useMemo(() => {
    if (events.length === 0) {
      return { burnRate: 0, hourlyProjection: 0, tips: [] as OptimizationTip[] };
    }

    const now = Date.now();
    const last5Min = events.filter((e) => now - e.timestamp < 300000);
    const last1Min = events.filter((e) => now - e.timestamp < 60000);

    // Burn rate: tokens per minute over last 5 minutes
    const burnRate = (() => {
      if (last5Min.length < 2) return 0;
      const timeSpan = Math.max(last5Min[last5Min.length - 1].timestamp - last5Min[0].timestamp, 1);
      const totalTokens = last5Min.reduce((s, e) => s + e.inputTokens + e.outputTokens, 0);
      return timeSpan > 0 ? (totalTokens / timeSpan) * 60000 : 0;
    })();

    // Hourly cost projection
    const hourlyProjection = (() => {
      if (last5Min.length < 2) return 0;
      const totalCost = last5Min.reduce((s, e) => s + e.costUsd, 0);
      const timeSpanMin = Math.max(last5Min[last5Min.length - 1].timestamp - last5Min[0].timestamp, 1) / 60000;
      return timeSpanMin > 0 ? (totalCost / timeSpanMin) * 60 : 0;
    })();

    // Optimization tips based on live patterns
    const tips: OptimizationTip[] = [];

    // High burn rate
    const costInLast5Min = last5Min.reduce((s, e) => s + e.costUsd, 0);
    if (costInLast5Min > 0.50) {
      tips.push({
        category: "urgent",
        message: `High burn rate: $${costInLast5Min.toFixed(2)} in last 5 min. Consider pausing or switching model.`,
        action: "switch_model",
        actionParams: { model: "claude-sonnet-4-5" },
        estimatedSaving: "~80%",
      });
    }

    // Expensive model overuse
    const expensiveModels = ["claude-opus-4-5", "o3", "gemini-2-5-pro"];
    const expensiveCount = last5Min.filter((e) => expensiveModels.includes(e.model)).length;
    if (expensiveCount >= 3) {
      tips.push({
        category: "model",
        message: `You've made ${expensiveCount} expensive API calls recently. Switch to a mid-tier model?`,
        action: "switch_model",
        actionParams: { model: "claude-sonnet-4-5" },
        estimatedSaving: "~75%",
      });
    }

    // Context bloat
    const avgInput = last5Min.length > 0 ? last5Min.reduce((s, e) => s + e.inputTokens, 0) / last5Min.length : 0;
    if (avgInput > 50000) {
      tips.push({
        category: "context",
        message: `Average input context is ${Math.round(avgInput / 1000)}K tokens. Compact now to save ~60%.`,
        action: "compact",
        estimatedSaving: "~60%",
      });
    }

    // Low cache hit rate (if we have cache data)
    const eventsWithCache = last5Min.filter((e) => (e.cacheReadTokens ?? 0) > 0);
    if (last5Min.length >= 5 && eventsWithCache.length > 0 && eventsWithCache.length < last5Min.length * 0.3) {
      tips.push({
        category: "caching",
        message: "Low cache hit rate. Add cache breakpoints to your system prompt.",
        estimatedSaving: "~65%",
      });
    }

    // Output bloat
    const avgOutputRatio = avgInput > 0 ? (last5Min.reduce((s, e) => s + e.outputTokens, 0) / last5Min.length) / avgInput : 0;
    if (avgOutputRatio > 2) {
      tips.push({
        category: "general",
        message: "Output is 2x longer than input. Ask for bullet points or summaries.",
        estimatedSaving: "~40%",
      });
    }

    return { burnRate, hourlyProjection, tips };
  }, [events]);
}
