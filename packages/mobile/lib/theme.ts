// AgentPilot Design System v3 — Industry-leading mobile UI
// Inspired by Linear, Things 3, Apple Health, Stripe Dashboard
// Principles: calm density, generous whitespace, clear hierarchy, purposeful color

// ── Color system ───────────────────────────────────────────────────
export const colors = {
  // Backgrounds (Linear-style pure dark hierarchy)
  bg: "#0A0A0A",              // Deepest background
  bgElevated: "#0F0F0F",      // Slightly elevated (tab bar, headers)
  surface: "#141414",          // Cards, sections
  surfaceHover: "#1A1A1A",     // Hover states
  surfacePressed: "#1E1E1E",   // Pressed states

  // Accent (Linear purple — professional, calm)
  accent: "#5E6AD2",
  accentSoft: "#7B87E8",
  accentDim: "rgba(94,106,210,0.12)",
  accentGlow: "rgba(94,106,210,0.08)",

  // Semantic colors (Linear status palette)
  success: "#4CAF50",
  successDim: "rgba(76,175,80,0.12)",
  warning: "#F2C94C",
  warningDim: "rgba(242,201,76,0.12)",
  danger: "#EB5757",
  dangerDim: "rgba(235,87,87,0.12)",
  info: "#56CCF2",
  infoDim: "rgba(86,204,242,0.12)",

  // Text (opacity-based hierarchy like Linear)
  text: "#E6E6E6",             // Primary — 90% white
  textSecondary: "#999999",    // Secondary — 60% white
  textTertiary: "#666666",     // Tertiary — 40% white
  textDisabled: "#444444",     // Disabled — 27% white

  // Borders (subtle, consistent)
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.10)",
  borderAccent: "rgba(94,106,210,0.25)",

  // Agent colors (muted, professional)
  agentClaude: "#D4A574",
  agentOpencode: "#818CF8",
  agentCodex: "#10A37F",
  agentGemini: "#4285F4",
  agentAider: "#4CAF50",
  agentCopilot: "#A78BFA",
  agentCline: "#FB923C",
};

// ── Spacing (4px base grid, Things 3 generous whitespace) ──────────
export const spacing = {
  px: 2,      // 0.5 unit
  xs: 4,      // 1 unit
  sm: 8,      // 2 units
  md: 12,     // 3 units
  base: 16,   // 4 units
  lg: 20,     // 5 units
  xl: 24,     // 6 units
  "2xl": 32,  // 8 units
  "3xl": 40,  // 10 units
  "4xl": 48,  // 12 units
  "5xl": 64,  // 16 units
};

// ── Border radius ──────────────────────────────────────────────────
export const radius = {
  sm: 6,     // Small buttons, tags
  md: 8,     // Standard buttons, inputs
  lg: 12,    // Cards, lists
  xl: 16,    // Bottom sheets, modals
  "2xl": 20, // Large cards
  full: 9999,// Pills, avatars
};

// ── Typography scale ───────────────────────────────────────────────
export const typography = {
  // Page titles (28px Bold, -0.5px tracking — Linear style)
  title1: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5, lineHeight: 34 },
  // Section headers (20px Semibold)
  title2: { fontSize: 20, fontWeight: "600" as const, letterSpacing: -0.3, lineHeight: 26 },
  // Card titles (17px Medium)
  title3: { fontSize: 17, fontWeight: "600" as const, letterSpacing: -0.2, lineHeight: 22 },
  // List item titles (16px Medium)
  body: { fontSize: 16, fontWeight: "500" as const, letterSpacing: 0, lineHeight: 22 },
  // List item subtitles (14px Regular)
  bodySmall: { fontSize: 14, fontWeight: "400" as const, letterSpacing: 0.1, lineHeight: 20 },
  // Captions, meta (13px Regular)
  caption: { fontSize: 13, fontWeight: "400" as const, letterSpacing: 0.2, lineHeight: 18 },
  // Labels, badges (11px Semibold, uppercase)
  label: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.5, lineHeight: 14, textTransform: "uppercase" as const },
  // Large hero numbers (40px Bold)
  hero: { fontSize: 40, fontWeight: "700" as const, letterSpacing: -1.5, lineHeight: 48 },
  // Medium numbers (24px Semibold)
  number: { fontSize: 24, fontWeight: "600" as const, letterSpacing: -0.5, lineHeight: 30 },
};

// ── Touch targets ──────────────────────────────────────────────────
export const touch = {
  min: 44,      // Minimum tap target (Apple HIG)
  standard: 48, // Standard button height
  large: 56,    // Primary CTA button height
};

// ── Timing ─────────────────────────────────────────────────────────
export const timing = {
  fast: 100,
  normal: 200,
  slow: 300,
};

// ── Helpers ────────────────────────────────────────────────────────
export function getCostColor(costUsd: number): string {
  if (costUsd < 0.1) return colors.textSecondary;
  if (costUsd < 1) return colors.warning;
  return colors.danger;
}

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
  return map[agentType] || colors.accent;
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
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
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
