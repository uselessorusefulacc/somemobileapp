// AgentPilot Design System — Factory.ai inspired
// Pure black, Geist-style system font, white on black, zero decoration
// Palette: #020202 bg, white text, razor-thin borders, mono for code

export const colors = {
  // Backgrounds
  bg: "#020202",
  bgElevated: "#0a0a0a",
  surface: "#111111",
  surfaceHover: "#181818",

  // Text
  text: "#EEEEEE",
  textSecondary: "#8A8380",
  textTertiary: "#4D4947",
  textDisabled: "#2E2C2B",

  // Borders
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.12)",

  // Functional only
  success: "#28C840",
  warning: "#FEBC2E",
  danger: "#FF5F57",
  info: "#58A6FF",

  // Semantic dims
  successDim: "rgba(40,200,64,0.08)",
  warningDim: "rgba(254,188,46,0.08)",
  dangerDim: "rgba(255,95,87,0.08)",

  // Agent — all muted, not loud
  agentClaude: "#C8956B",
  agentOpencode: "#7B7FBF",
  agentCodex: "#10A37F",
  agentGemini: "#4285F4",
  agentAider: "#3D9E5F",
  agentCopilot: "#8B7FB8",
  agentCline: "#C87941",
};

export const spacing = {
  px: 1,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
  "5xl": 64,
};

export const radius = {
  xs: 2,
  sm: 3,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
};

export const typography = {
  // Factory uses tight, confident type — no loose tracking
  title1: { fontSize: 22, fontWeight: "600" as const, letterSpacing: -0.3, lineHeight: 28 },
  title2: { fontSize: 18, fontWeight: "600" as const, letterSpacing: -0.2, lineHeight: 24 },
  title3: { fontSize: 15, fontWeight: "600" as const, letterSpacing: -0.1, lineHeight: 20 },
  body: { fontSize: 15, fontWeight: "400" as const, letterSpacing: 0, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: "400" as const, letterSpacing: 0, lineHeight: 18 },
  // ALL CAPS labels — Factory's signature
  label: { fontSize: 10, fontWeight: "500" as const, letterSpacing: 0.8, lineHeight: 14, textTransform: "uppercase" as const },
  caption: { fontSize: 12, fontWeight: "400" as const, letterSpacing: 0, lineHeight: 16 },
  mono: { fontSize: 12, fontFamily: "monospace" as const, letterSpacing: 0, lineHeight: 18 },
  monoSm: { fontSize: 11, fontFamily: "monospace" as const, letterSpacing: 0, lineHeight: 16 },
  hero: { fontSize: 36, fontWeight: "600" as const, letterSpacing: -1, lineHeight: 42 },
  number: { fontSize: 22, fontWeight: "600" as const, letterSpacing: -0.5, lineHeight: 28 },
};

export function getAgentColor(agentType: string): string {
  const map: Record<string, string> = {
    claude: colors.agentClaude,
    opencode: colors.agentOpencode,
    codex: colors.agentCodex,
    gemini: colors.agentGemini,
    aider: colors.agentAider,
    copilot: colors.agentCopilot,
    cline: colors.agentCline,
  };
  return map[agentType] || colors.textSecondary;
}

export function getAgentLabel(agentType: string): string {
  const map: Record<string, string> = {
    claude: "Claude Code",
    opencode: "OpenCode",
    codex: "Codex CLI",
    gemini: "Gemini CLI",
    aider: "Aider",
    copilot: "GitHub Copilot",
    cline: "Cline",
  };
  return map[agentType] || agentType;
}

export function formatCost(costUsd: number): string {
  if (costUsd < 0.0001) return "$0.00";
  if (costUsd < 1) return `$${costUsd.toFixed(4)}`;
  if (costUsd < 10) return `$${costUsd.toFixed(2)}`;
  return `$${costUsd.toFixed(0)}`;
}

export function formatTokens(count: number): string {
  if (count < 1000) return `${count}`;
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1_000_000).toFixed(2)}M`;
}

export function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "active": return colors.success;
    case "paused": return colors.warning;
    case "error": return colors.danger;
    case "completed": return colors.textTertiary;
    default: return colors.textTertiary;
  }
}

export function getCostColor(costUsd: number): string {
  if (costUsd < 0.1) return colors.textSecondary;
  if (costUsd < 1) return colors.warning;
  return colors.danger;
}
