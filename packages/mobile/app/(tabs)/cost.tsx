import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Animated,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type Analytics } from "../../lib/api";
import { colors, fonts, radius, space } from "../../lib/theme";
import { formatCost, formatTokens } from "../../lib/format";

const MODEL_PRICING: Record<string, { in: number; out: number; provider: string }> = {
  "claude-opus-4-5":   { in: 15,    out: 75,  provider: "anthropic" },
  "claude-sonnet-4-5": { in: 3,     out: 15,  provider: "anthropic" },
  "claude-haiku-3-5":  { in: 0.8,   out: 4,   provider: "anthropic" },
  "gpt-4o":            { in: 2.5,   out: 10,  provider: "openai"    },
  "gpt-4o-mini":       { in: 0.15,  out: 0.6, provider: "openai"    },
  "o3":                { in: 10,    out: 40,  provider: "openai"    },
  "o3-mini":           { in: 1.1,   out: 4.4, provider: "openai"    },
  "gemini-2-5-pro":    { in: 1.25,  out: 10,  provider: "google"    },
  "gemini-2-5-flash":  { in: 0.075, out: 0.3, provider: "google"    },
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#CC785C",
  openai:    "#10A37F",
  google:    "#4285F4",
};

// ── Model pricing modal ────────────────────────────────────────────────────
function ModelSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mo.overlay}>
        <View style={[mo.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={mo.handle} />
          <View style={mo.sheetHead}>
            <Text style={mo.sheetTitle}>MODEL PRICING</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={mo.closeX}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={mo.divider} />
          <View style={mo.tableHead}>
            <Text style={[mo.col1, mo.headCell]}>MODEL</Text>
            <Text style={[mo.col2, mo.headCell]}>IN /1M</Text>
            <Text style={[mo.col2, mo.headCell]}>OUT /1M</Text>
          </View>
          <View style={mo.divider} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {Object.entries(MODEL_PRICING).map(([model, price], i, arr) => {
              const pColor = PROVIDER_COLORS[price.provider] ?? colors.textTertiary;
              return (
                <View key={model}>
                  <View style={mo.tableRow}>
                    <View style={mo.col1}>
                      <View style={[mo.providerDot, { backgroundColor: pColor }]} />
                      <Text style={mo.modelName} numberOfLines={1}>{model}</Text>
                    </View>
                    <Text style={[mo.col2, mo.priceCell]}>${price.in}</Text>
                    <Text style={[mo.col2, mo.priceCell]}>${price.out}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={mo.rowDivider} />}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Animated bar ───────────────────────────────────────────────────────────
function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const w = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 700, delay, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={co.barTrack}>
      <Animated.View style={[co.barFill, {
        width: w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        backgroundColor: color,
        shadowColor: color,
        shadowRadius: 4,
        shadowOpacity: 0.6,
      }]} />
    </View>
  );
}

// ── Error state ────────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={co.errorBlock}>
      <View style={co.errorIcon}><Text style={co.errorIconText}>!</Text></View>
      <Text style={co.errorLabel}>LOAD FAILED</Text>
      <Text style={co.errorSub}>Could not fetch cost data</Text>
      <TouchableOpacity style={co.retryBtn} onPress={onRetry} activeOpacity={0.7}>
        <Text style={co.retryText}>↻  RETRY</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function CostScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [error, setError] = useState(false);
  const heroOpacity = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    setError(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const data = await apiClient.getAnalytics();
      setStats(data);
      Animated.timing(heroOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(true);
      }
    } finally {
      clearTimeout(timer);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const totalCost = parseFloat(stats?.totalCost || "0");
  const todayCost = stats?.dailyCost || 0;
  const monthlyCost = stats?.monthlyCost || 0;
  const totalTokens = stats?.totalTokens || 0;
  const modelBreakdown = stats?.modelBreakdown;

  const heroCostColor =
    totalCost > 50 ? colors.danger :
    totalCost > 10 ? colors.warning :
    colors.success;

  const sorted = modelBreakdown
    ? [...modelBreakdown].sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost))
    : [];
  const maxCost = sorted.length > 0 ? parseFloat(sorted[0].totalCost) : 1;

  return (
    <View style={[co.root, { paddingTop: insets.top }]}>
      <View style={co.topBar}>
        <Text style={co.pageTitle}>COST</Text>
        <TouchableOpacity onPress={() => setShowPricing(true)} style={co.pricingBtn} activeOpacity={0.7}>
          <Text style={co.pricingBtnText}>PRICING ↗</Text>
        </TouchableOpacity>
      </View>
      <View style={co.topAccent} />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? <ErrorState onRetry={() => load(false)} /> : (
          <>
            {/* ── Hero ── */}
            <Animated.View style={[co.heroBlock, { opacity: heroOpacity }]}>
              <Text style={co.heroLabel}>ALL-TIME SPEND</Text>
              <Text style={[co.heroCost, {
                color: heroCostColor,
                textShadowColor: heroCostColor + "50",
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 24,
              }]}>
                {formatCost(totalCost)}
              </Text>
              <View style={co.heroRow}>
                <View style={co.heroChip}>
                  <Text style={co.heroChipLabel}>TODAY</Text>
                  <Text style={[co.heroChipVal, { color: todayCost > 1 ? colors.warning : colors.textSecondary }]}>
                    {formatCost(todayCost)}
                  </Text>
                </View>
                <View style={co.heroChip}>
                  <Text style={co.heroChipLabel}>THIS MONTH</Text>
                  <Text style={[co.heroChipVal, { color: monthlyCost > 10 ? colors.warning : colors.textSecondary }]}>
                    {formatCost(monthlyCost)}
                  </Text>
                </View>
                <View style={co.heroChip}>
                  <Text style={co.heroChipLabel}>TOKENS</Text>
                  <Text style={co.heroChipVal}>{formatTokens(totalTokens)}</Text>
                </View>
              </View>
            </Animated.View>

            {/* ── Section line ── */}
            <View style={co.sectionHead}>
              <Text style={co.sectionLabel}>BY MODEL</Text>
              <View style={co.sectionLine} />
            </View>

            {/* ── Model bars ── */}
            {sorted.length > 0 ? (
              <View style={co.modelBlock}>
                {sorted.map((m, i) => {
                  const cost = parseFloat(m.totalCost);
                  const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
                  const providerColor = PROVIDER_COLORS[MODEL_PRICING[m.model]?.provider ?? ""] ?? colors.accent;
                  const isTop = i === 0;
                  return (
                    <View key={m.model} style={[co.modelRow, isTop && co.modelRowTop]}>
                      <View style={co.modelLeft}>
                        <View style={[co.providerDot, { backgroundColor: providerColor }]} />
                        <Text style={[co.modelName, isTop && { color: colors.text }]} numberOfLines={1}>{m.model}</Text>
                      </View>
                      <View style={co.barWrap}>
                        <AnimatedBar pct={Math.max(pct, 1)} color={isTop ? providerColor : providerColor + "80"} delay={i * 80} />
                      </View>
                      <Text style={[co.modelCost, isTop && { color: providerColor }]}>{formatCost(cost)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={co.emptyModel}>
                <Text style={co.emptyModelText}>No session data yet</Text>
              </View>
            )}

            {/* ── Cache efficiency ── */}
            {stats && (
              <>
                <View style={co.sectionHead}>
                  <Text style={co.sectionLabel}>EFFICIENCY</Text>
                  <View style={co.sectionLine} />
                </View>
                <View style={co.efficiencyBlock}>
                  <View style={co.effRow}>
                    <Text style={co.effLabel}>CACHE HIT RATE</Text>
                    <Text style={[co.effValue, { color: (stats.cacheHitRate ?? 0) > 0.5 ? colors.success : colors.textSecondary }]}>
                      {Math.round((stats.cacheHitRate ?? 0) * 100)}%
                    </Text>
                  </View>
                  <View style={co.effBarTrack}>
                    <Animated.View style={[co.effBarFill, {
                      width: `${Math.round((stats.cacheHitRate ?? 0) * 100)}%`,
                      backgroundColor: (stats.cacheHitRate ?? 0) > 0.5 ? colors.success : colors.accent,
                    }]} />
                  </View>
                  <View style={co.effRow}>
                    <Text style={co.effLabel}>PROJECTED MONTHLY</Text>
                    <Text style={[co.effValue, { color: (stats.projectedMonthlyCost ?? 0) > 20 ? colors.warning : colors.textSecondary }]}>
                      {formatCost(stats.projectedMonthlyCost ?? 0)}
                    </Text>
                  </View>
                  <View style={co.effRow}>
                    <Text style={co.effLabel}>AVG / SESSION</Text>
                    <Text style={co.effValue}>
                      {(stats.totalSessions ?? 0) > 0 ? formatCost(totalCost / stats.totalSessions) : "$0.00"}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>

      <ModelSheet visible={showPricing} onClose={() => setShowPricing(false)} />
    </View>
  );
}

const co = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topAccent: { height: 1, backgroundColor: colors.accent + "30" },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: space.lg, paddingVertical: 14,
  },
  pageTitle: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 3, color: colors.accent, textTransform: "uppercase" },
  pricingBtn: {
    borderWidth: 1, borderColor: colors.accentBorder,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 2, backgroundColor: colors.accentMuted,
  },
  pricingBtnText: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.6, color: colors.accent, textTransform: "uppercase" },

  // Error
  errorBlock: { padding: space.xl, alignItems: "center", gap: 12, marginTop: space.xl },
  errorIcon: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerMuted,
    alignItems: "center", justifyContent: "center",
  },
  errorIconText: { fontFamily: fonts.sansMedium, fontSize: 18, color: colors.danger, lineHeight: 22 },
  errorLabel: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.8, color: colors.danger, textTransform: "uppercase" },
  errorSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textTertiary },
  retryBtn: {
    borderWidth: 1, borderColor: colors.accentBorder, backgroundColor: colors.accentMuted,
    paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.xs, marginTop: 4,
  },
  retryText: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.8, color: colors.accent, textTransform: "uppercase" },

  // Hero
  heroBlock: { paddingHorizontal: space.lg, paddingTop: space.xl + 4, paddingBottom: space.lg },
  heroLabel: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 2.4, color: colors.textTertiary, textTransform: "uppercase", marginBottom: 10 },
  heroCost: { fontFamily: fonts.sans, fontSize: 62, fontWeight: "300", letterSpacing: -4, lineHeight: 62, marginBottom: 16 },
  heroRow: { flexDirection: "row", gap: 8 },
  heroChip: {
    flex: 1, backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    padding: 10,
  },
  heroChipLabel: { fontFamily: fonts.sansMedium, fontSize: 7, letterSpacing: 1.4, color: colors.textTertiary, textTransform: "uppercase", marginBottom: 4 },
  heroChipVal: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary, letterSpacing: -0.2 },

  // Section
  sectionHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, marginBottom: 2, marginTop: space.md, gap: 10 },
  sectionLabel: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 2.0, color: colors.textTertiary, textTransform: "uppercase", flexShrink: 0 },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },

  // Model bars
  modelBlock: {
    marginHorizontal: space.md, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden", marginBottom: space.sm,
  },
  modelRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingVertical: 12, gap: 10 },
  modelRowTop: { backgroundColor: colors.surfaceRaised },
  modelLeft: { flexDirection: "row", alignItems: "center", gap: 7, width: 130 },
  providerDot: { width: 4, height: 4, borderRadius: 2, flexShrink: 0 },
  modelName: { fontFamily: fonts.mono, fontSize: 9, color: colors.textTertiary, letterSpacing: 0.2, flex: 1 },
  barWrap: { flex: 1 },
  barTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  modelCost: { fontFamily: fonts.mono, fontSize: 11, color: colors.textTertiary, width: 62, textAlign: "right" },

  // Efficiency
  efficiencyBlock: {
    marginHorizontal: space.md, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space.md, gap: 12, marginBottom: space.sm,
  },
  effRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  effLabel: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.4, color: colors.textTertiary, textTransform: "uppercase" },
  effValue: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  effBarTrack: { height: 3, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden", marginTop: -4 },
  effBarFill: { height: "100%", borderRadius: 2 },

  emptyModel: { padding: space.xl, alignItems: "center" },
  emptyModelText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textTertiary },
});

const mo = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md,
    maxHeight: "80%",
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: colors.accentBorder,
  },
  handle: { width: 28, height: 2, backgroundColor: colors.textTertiary, alignSelf: "center", marginTop: 10, marginBottom: 4, borderRadius: 1 },
  sheetHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  sheetTitle: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 2.0, color: colors.accent, textTransform: "uppercase" },
  closeX: { fontFamily: fonts.sans, fontSize: 14, color: colors.textTertiary },
  divider: { height: 1, backgroundColor: colors.border },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: space.lg },
  tableHead: {
    flexDirection: "row", paddingHorizontal: space.lg, paddingVertical: 8,
    backgroundColor: colors.surfaceRaised,
  },
  headCell: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.4, color: colors.textTertiary, textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingHorizontal: space.lg, paddingVertical: 11, alignItems: "center" },
  col1: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, marginRight: space.sm },
  col2: { width: 64, textAlign: "right" as const },
  providerDot: { width: 4, height: 4, borderRadius: 2, flexShrink: 0 },
  modelName: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  priceCell: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
});
