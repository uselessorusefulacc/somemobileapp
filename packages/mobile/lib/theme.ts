// AgentPilot Design System — Dark-first, terminal aesthetic
// Flat color tokens for easy StyleSheet use

export const colors = {
  // Backgrounds
  bg: "#0a0a0f",
  surface: "#111118",
  card: "#13131b",

  // Accent (indigo)
  accent: "#6366f1",
  accentDim: "rgba(99,102,241,0.15)",
  accentGlow: "rgba(99,102,241,0.3)",

  // Status
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  error: "#ef4444",

  // Text
  text: "rgba(255,255,255,0.95)",
  textSecondary: "rgba(255,255,255,0.6)",
  textMuted: "rgba(255,255,255,0.35)",

  // Border
  border: "rgba(255,255,255,0.07)",

  // Agent type colors
  agentClaude: "#d97706",
  agentOpencode: "#6366f1",
  agentCodex: "#22c55e",

  // Cost levels
  costLow: "#22c55e",
  costMid: "#f59e0b",
  costHigh: "#ef4444",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const font = {
  mono: "monospace" as const,
  sans: "System" as const,
};

export function getCostColor(costUsd: number): string {
  if (costUsd < 0.1) return colors.costLow;
  if (costUsd < 1) return colors.costMid;
  return colors.costHigh;
}

export function getAgentColor(agentType: string): string {
  if (agentType.includes("claude")) return colors.agentClaude;
  if (agentType.includes("opencode")) return colors.agentOpencode;
  if (agentType.includes("codex")) return colors.agentCodex;
  return colors.accent;
}

export function formatCost(costUsd: number): string {
  if (costUsd < 0.001) return `$${(costUsd * 1000).toFixed(3)}m`;
  if (costUsd < 1) return `$${costUsd.toFixed(4)}`;
  return `$${costUsd.toFixed(2)}`;
}

export function formatTokens(count: number): string {
  if (count < 1000) return `${count}`;
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1_000_000).toFixed(2)}M`;
}
