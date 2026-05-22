// Factory.ai design language
// Geist font, #020202 bg, tight negative tracking on headings, ALL CAPS labels

export const colors = {
  bg: "#020202",
  surface: "#0D0D0D",
  surfaceRaised: "#141414",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.14)",

  text: "#EEEEEE",
  textSecondary: "#8A8380",
  textTertiary: "#4D4947",

  white: "#FFFFFF",
  black: "#000000",

  // Functional only
  success: "#28C840",
  warning: "#FEBC2E",
  danger: "#FF5F57",
  dangerMuted: "rgba(255,95,87,0.15)",
  successMuted: "rgba(40,200,64,0.12)",
  warningMuted: "rgba(254,188,46,0.12)",
} as const;

// Geist font families
export const fonts = {
  sans: "Geist-Regular",
  sansMedium: "Geist-Medium",
  sansSemiBold: "Geist-SemiBold",
  sansBold: "Geist-Bold",
  mono: "GeistMono-Regular",
  monoMedium: "GeistMono-Medium",
} as const;

export const type = {
  // Hero — Factory style: large, negative letter-spacing, weight 400
  hero: {
    fontFamily: fonts.sans,
    fontSize: 36,
    fontWeight: "400" as const,
    letterSpacing: -2,
    lineHeight: 36,
    color: colors.text,
  },
  // Display — section titles
  display: {
    fontFamily: fonts.sans,
    fontSize: 24,
    fontWeight: "400" as const,
    letterSpacing: -0.8,
    lineHeight: 28,
    color: colors.text,
  },
  // Heading
  heading: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    fontWeight: "500" as const,
    letterSpacing: -0.3,
    lineHeight: 22,
    color: colors.text,
  },
  // Body
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 20,
    color: colors.text,
  },
  bodySecondary: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  // Label — ALL CAPS, tight, small — the signature Factory look
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 1.2,
    lineHeight: 14,
    color: colors.textTertiary,
    textTransform: "uppercase" as const,
  },
  labelStrong: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 1.2,
    lineHeight: 14,
    color: colors.textSecondary,
    textTransform: "uppercase" as const,
  },
  // Caption
  caption: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  // Mono — for IDs, code, terminals
  mono: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  monoSmall: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 16,
    color: colors.textTertiary,
  },
  // Button text — ALL CAPS
  button: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    fontWeight: "500" as const,
    letterSpacing: 1.0,
    lineHeight: 16,
    textTransform: "uppercase" as const,
  },
} as const;

export const radius = {
  none: 0,
  xs: 2,
  sm: 3,
  md: 6,
  lg: 8,
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
