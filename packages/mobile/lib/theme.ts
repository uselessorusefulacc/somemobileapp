// AgentPilot — Futuristic terminal-grade design language
// Geist + GeistMono, deep black, razor-thin borders, neon accents
// Influence: linear.app × vercel × shadcn/ui × factory.ai

export const colors = {
  // ── Base ──────────────────────────────────────────────────────────────────
  bg: "#000000",
  surface: "#080808",
  surfaceRaised: "#0F0F0F",
  surfaceOverlay: "#141414",

  // ── Borders ───────────────────────────────────────────────────────────────
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.12)",
  borderFocus: "rgba(255,255,255,0.24)",

  // ── Text ─────────────────────────────────────────────────────────────────
  text: "#F0F0F0",
  textSecondary: "#7A7A7A",
  textTertiary: "#3D3D3D",
  textDisabled: "#2A2A2A",

  // ── Absolute ──────────────────────────────────────────────────────────────
  white: "#FFFFFF",
  black: "#000000",

  // ── Semantic: use these for status / cost ─────────────────────────────────
  success: "#00FF88",          // neon green — active, live, ok
  successMuted: "rgba(0,255,136,0.08)",
  successBorder: "rgba(0,255,136,0.2)",

  warning: "#FFB800",          // amber — paused, medium cost
  warningMuted: "rgba(255,184,0,0.08)",
  warningBorder: "rgba(255,184,0,0.2)",

  danger: "#FF3B3B",           // red — error, high cost, kill
  dangerMuted: "rgba(255,59,59,0.08)",
  dangerBorder: "rgba(255,59,59,0.2)",

  // ── Accent — used sparingly for interactive highlights ────────────────────
  accent: "#4D9EFF",           // electric blue
  accentMuted: "rgba(77,158,255,0.1)",
  accentBorder: "rgba(77,158,255,0.25)",
} as const;

// ── Font families (loaded from assets/fonts/) ─────────────────────────────
export const fonts = {
  sans: "Geist-Regular",
  sansMedium: "Geist-Medium",
  sansSemiBold: "Geist-SemiBold",
  sansBold: "Geist-Bold",
  mono: "GeistMono-Regular",
  monoMedium: "GeistMono-Medium",
} as const;

export const type = {
  // ── Display tier — section hero numbers, big cost values ──────────────────
  hero: {
    fontFamily: fonts.sans,
    fontSize: 42,
    fontWeight: "300" as const,
    letterSpacing: -3,
    lineHeight: 42,
    color: colors.text,
  },
  display: {
    fontFamily: fonts.sans,
    fontSize: 28,
    fontWeight: "300" as const,
    letterSpacing: -1.5,
    lineHeight: 32,
    color: colors.text,
  },
  // ── Content tier ──────────────────────────────────────────────────────────
  heading: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    fontWeight: "500" as const,
    letterSpacing: -0.4,
    lineHeight: 22,
    color: colors.text,
  },
  subheading: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "400" as const,
    letterSpacing: -0.2,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400" as const,
    letterSpacing: -0.1,
    lineHeight: 22,
    color: colors.text,
  },
  bodySecondary: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400" as const,
    letterSpacing: -0.1,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  // ── Label tier — ALL CAPS, ultra tight ───────────────────────────────────
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    fontWeight: "500" as const,
    letterSpacing: 1.8,
    lineHeight: 13,
    color: colors.textTertiary,
    textTransform: "uppercase" as const,
  },
  labelStrong: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    fontWeight: "500" as const,
    letterSpacing: 1.8,
    lineHeight: 13,
    color: colors.textSecondary,
    textTransform: "uppercase" as const,
  },
  labelAccent: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    fontWeight: "500" as const,
    letterSpacing: 1.8,
    lineHeight: 13,
    color: colors.accent,
    textTransform: "uppercase" as const,
  },
  // ── Caption / micro ──────────────────────────────────────────────────────
  caption: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  // ── Mono — terminal feel, cost numbers, IDs ───────────────────────────────
  mono: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  monoLarge: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: "400" as const,
    letterSpacing: -0.2,
    lineHeight: 20,
    color: colors.text,
  },
  monoSmall: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 14,
    color: colors.textTertiary,
  },
  // ── Button — ALL CAPS, spaced ─────────────────────────────────────────────
  button: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 1.5,
    lineHeight: 14,
    textTransform: "uppercase" as const,
  },
  buttonSm: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    fontWeight: "500" as const,
    letterSpacing: 1.4,
    lineHeight: 12,
    textTransform: "uppercase" as const,
  },
} as const;

export const radius = {
  none: 0,
  xs: 2,
  sm: 3,
  md: 6,
  lg: 10,
  xl: 16,
  full: 9999,
} as const;

export const space = {
  px: 1,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// ── Shadows — subtle depth for elevated surfaces ───────────────────────────
export const shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;
