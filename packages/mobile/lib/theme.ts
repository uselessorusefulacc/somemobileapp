// AgentPilot Design System v2 — Factory-inspired premium dark aesthetic
// Inspired by factory.ai + lunel hybrid

export const colors = {
  // Core backgrounds — deep charcoal with warmth
  bg: "#0c0c0e",
  surface: "#151518",
  surfaceElevated: "#1e1e22",
  card: "#18181c",

  // Gradient accents — factory.ai soft glow
  accent: "#f97316",       // vibrant orange
  accentSoft: "#fb923c",   // softer orange
  accentDim: "rgba(249,115,22,0.15)",
  accentGlow: "rgba(249,115,22,0.12)",
  accentGlowStrong: "rgba(249,115,22,0.25)",

  // Secondary accents — purple/pink factory gradient vibes
  secondary: "#a855f7",    // purple
  secondarySoft: "#c084fc",
  secondaryGlow: "rgba(168,85,247,0.12)",

  // Tertiary — cyan/teal for data/metrics
  tertiary: "#06b6d4",
  tertiaryGlow: "rgba(6,182,212,0.12)",

  // Status
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  error: "#ef4444",

  // Text — warm grays
  text: "#fafaf9",
  textSecondary: "#a8a29e",
  textMuted: "#57534e",

  // Border — subtle warm separators
  border: "rgba(255,255,255,0.06)",
  borderHighlight: "rgba(249,115,22,0.2)",

  // Agent type colors
  agentClaude: "#f59e0b",
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
  md: 14,
  lg: 20,
  xl: 28,
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
  if (agentType === "claude") return colors.agentClaude;
  if (agentType === "opencode") return colors.agentOpencode;
  if (agentType === "codex") return colors.agentCodex;
  return colors.accent;
}

export function formatCost(costUsd: number): string {
  if (costUsd < 0.0001) return "<$0.0001";
  if (costUsd < 1) return `$${costUsd.toFixed(4)}`;
  return `$${costUsd.toFixed(2)}`;
}

export function formatTokens(count: number): string {
  if (count < 1000) return `${count}`;
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1_000_000).toFixed(2)}M`;
}
