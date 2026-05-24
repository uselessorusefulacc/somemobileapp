import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type Analytics } from "../../lib/api";
import { colors, fonts, radius, space } from "../../lib/theme";
import { formatCost, formatTokens } from "../../lib/format";
import { DotGrid } from "../../components/DotGrid";

// ── Pulsing live dot ──────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.9, duration: 850, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 850, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(400),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute", width: 10, height: 10, borderRadius: 5,
        backgroundColor: color, opacity, transform: [{ scale }],
      }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

// ── Neon stat card with hover pop ─────────────────────────────────────────
function StatCard({ label, value, valueColor, accent, delay = 0 }: {
  label: string; value: string; valueColor?: string; accent?: string; delay?: number;
}) {
  const scale    = useRef(new Animated.Value(1)).current;
  const opacity  = useRef(new Animated.Value(0)).current;
  const slideY   = useRef(new Animated.Value(20)).current;
  const elevation = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(slideY,  { toValue: 0, delay, useNativeDriver: true, damping: 16, stiffness: 180 }),
    ]).start();
  }, []);

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale,        { toValue: 1.04, useNativeDriver: true, speed: 50, bounciness: 6 }),
      Animated.timing(glowOpacity,  { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };
  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale,        { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }),
      Animated.timing(glowOpacity,  { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={[
      sc.card,
      accent ? { borderColor: accent + "55", borderWidth: 1 } : {},
      { opacity, transform: [{ translateY: slideY }, { scale }] }
    ]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{ flex: 1 }}
      >
        {/* Always-on subtle glow for accented cards */}
        {accent && <View style={[sc.cardGlow, { backgroundColor: accent + "10" }]} />}
        {/* Hover glow */}
        <Animated.View style={[
          sc.cardGlow,
          { backgroundColor: (accent || colors.accent) + "18", opacity: glowOpacity }
        ]} />
        <Text style={sc.cardLabel}>{label}</Text>
        <Text style={[sc.cardValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Budget alert banner ───────────────────────────────────────────────────
function BudgetAlertBanner() {
  const [alerts, setAlerts]       = useState<Array<{ level: "warn" | "critical"; message: string }>>([]);
  const [dismissed, setDismissed] = useState(false);
  const slideY = useRef(new Animated.Value(-40)).current;

  useFocusEffect(useCallback(() => {
    let alive = true;
    apiClient.getAlerts().then((r) => {
      if (alive && r.alerts.length > 0) {
        setAlerts(r.alerts);
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }).start();
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, []));

  if (dismissed || alerts.length === 0) return null;
  const top = alerts[0];
  const isCritical = top.level === "critical";
  const c = isCritical ? colors.danger : colors.warning;
  return (
    <Animated.View style={{ transform: [{ translateY: slideY }] }}>
      <TouchableOpacity
        style={[d.alertBanner, { borderColor: c + "55", backgroundColor: c + "0D" }]}
        onPress={() => setDismissed(true)}
        activeOpacity={0.8}
      >
        <View style={[d.alertStripe, { backgroundColor: c }]} />
        <View style={d.alertInner}>
          <PulseDot color={c} />
          <Text style={[d.alertText, { color: c }]} numberOfLines={2}>{top.message}</Text>
          <Text style={[d.alertDismiss, { color: c }]}>✕</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Error state ───────────────────────────────────────────────────────────
function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={d.errorBlock}>
      <View style={d.errorIcon}><Text style={d.errorIconText}>!</Text></View>
      <Text style={d.errorLabel}>FETCH FAILED</Text>
      <Text style={d.errorSub}>Could not reach the API</Text>
      <TouchableOpacity style={d.retryBtn} onPress={onRetry} activeOpacity={0.7}>
        <Text style={d.retryText}>↻  RETRY</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Model bar row ─────────────────────────────────────────────────────────
function ModelBar({ model, cost, pct, isTop, delay = 0 }: {
  model: string; cost: number; pct: number; isTop: boolean; delay?: number;
}) {
  const w       = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const slideX  = useRef(new Animated.Value(-10)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(w,       { toValue: pct, duration: 700, delay: delay + 100, useNativeDriver: false }),
      Animated.timing(opacity, { toValue: 1,   duration: 350, delay,              useNativeDriver: true }),
      Animated.timing(slideX,  { toValue: 0,   duration: 350, delay,              useNativeDriver: true }),
    ]).start();
  }, [pct]);

  const barColor = isTop ? colors.accent : colors.borderStrong;
  return (
    <Animated.View style={[d.modelRow, { opacity, transform: [{ translateX: slideX }] }]}>
      <Text style={[d.modelName, isTop && { color: colors.text }]} numberOfLines={1}>{model}</Text>
      <View style={d.barTrack}>
        <Animated.View style={[d.barFill, {
          width: w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
          backgroundColor: barColor,
          shadowColor: isTop ? colors.accent : "transparent",
          shadowRadius: isTop ? 6 : 0,
          shadowOpacity: isTop ? 0.9 : 0,
        }]} />
      </View>
      <Text style={[d.modelCost, isTop && { color: colors.accent }]}>{formatCost(cost)}</Text>
    </Animated.View>
  );
}

// ── Animated action buttons ───────────────────────────────────────────────
function ActionButtons({ router }: { router: ReturnType<typeof useRouter> }) {
  const s1 = useRef(new Animated.Value(1)).current;
  const s2 = useRef(new Animated.Value(1)).current;
  const g1 = useRef(new Animated.Value(0)).current;
  const g2 = useRef(new Animated.Value(0)).current;

  const press = (scale: Animated.Value, glow: Animated.Value, v: number) => {
    Animated.parallel([
      Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 6 }),
      Animated.timing(glow,  { toValue: v < 1 ? 1 : 0, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={d.actionGrid}>
      <Animated.View style={[{ flex: 2 }, { transform: [{ scale: s1 }] }]}>
        <TouchableOpacity
          style={d.actionPrimary}
          onPress={() => router.push("/new-session")}
          onPressIn={() => press(s1, g1, 0.96)}
          onPressOut={() => press(s1, g1, 1)}
          activeOpacity={1}
        >
          <Animated.View style={[d.actionGlow, { opacity: g1 }]} />
          <Text style={d.actionPrimaryText}>⊕  NEW SESSION</Text>
        </TouchableOpacity>
      </Animated.View>
      <Animated.View style={[{ flex: 1 }, { transform: [{ scale: s2 }] }]}>
        <TouchableOpacity
          style={d.actionSecondary}
          onPress={() => router.push("/(tabs)/cost")}
          onPressIn={() => press(s2, g2, 0.96)}
          onPressOut={() => press(s2, g2, 1)}
          activeOpacity={1}
        >
          <Text style={d.actionSecondaryText}>COSTS ↗</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Animated number counter ───────────────────────────────────────────────
function AnimatedNumber({ value, prefix = "", suffix = "", color, style: extStyle }: {
  value: number; prefix?: string; suffix?: string; color?: string; style?: any;
}) {
  const animVal = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    animVal.addListener(({ value: v }) => {
      setDisplay(prefix + v.toFixed(2) + suffix);
    });
    Animated.timing(animVal, { toValue: value, duration: 1200, useNativeDriver: false }).start();
    return () => animVal.removeAllListeners();
  }, [value]);

  return <Text style={[extStyle, color ? { color } : {}]}>{display}</Text>;
}

// ── Clock ─────────────────────────────────────────────────────────────────
function useLocalTime() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const localTime = useLocalTime();
  const [stats, setStats]           = useState<Analytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(false);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroSlide   = useRef(new Animated.Value(20)).current;
  const heroScale   = useRef(new Animated.Value(0.97)).current;

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    setError(false);
    try {
      const data = await apiClient.getAnalytics();
      setStats(data);
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(heroSlide,   { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.spring(heroScale,   { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 200 }),
      ]).start();
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const totalCost      = parseFloat(String(stats?.totalCost  || "0"));
  const todayCost      = parseFloat(String(stats?.dailyCost  || "0"));
  const totalTokens    = stats?.totalTokens    || 0;
  const activeSessions = stats?.activeSessions || 0;
  const totalSessions  = stats?.totalSessions  || 0;
  const cacheHitRate   = stats?.cacheHitRate   ?? 0;

  const heroCostColor =
    totalCost > 50 ? colors.danger :
    totalCost > 10 ? colors.warning :
    colors.success;

  const sorted  = stats?.modelBreakdown
    ? [...stats.modelBreakdown].sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost))
    : [];
  const maxCost = sorted.length > 0 ? parseFloat(sorted[0].totalCost) : 1;

  return (
    <View style={[d.root, { paddingTop: insets.top }]}>
      {/* Dot-grid background */}
      <DotGrid opacity={0.28} />

      {/* Top bar */}
      <View style={d.topBar}>
        <View style={d.logoRow}>
          <View style={d.logoBadge}>
            <Image source={require("../../assets/logo-white.png")} style={d.logoImg} />
          </View>
          <Text style={d.pageTitle}>MAFA</Text>
        </View>
        <View style={d.topRight}>
          {activeSessions > 0 && <PulseDot color={colors.success} />}
          <Text style={d.pageDate}>
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
          </Text>
          <Text style={d.pageTime}>{localTime}</Text>
        </View>
      </View>
      <View style={d.topBorderAccent} />

      <BudgetAlertBanner />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(false); }}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? <ErrorBlock onRetry={() => load(false)} /> : (
          <>
            {/* Hero */}
            <Animated.View style={[d.heroBlock, {
              opacity: heroOpacity,
              transform: [{ translateY: heroSlide }, { scale: heroScale }]
            }]}>
              <Text style={d.heroLabel}>TOTAL SPEND</Text>
              <Text style={[d.heroCost, {
                color: heroCostColor,
                textShadowColor: heroCostColor + "55",
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 28,
              }]}>
                {formatCost(totalCost)}
              </Text>
              <View style={d.heroMeta}>
                <Text style={d.heroSub}>All time · all agents</Text>
                {activeSessions > 0 && (
                  <View style={d.liveChip}>
                    <PulseDot color={colors.success} />
                    <Text style={d.liveChipText}>{activeSessions} LIVE</Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Scan line */}
            <View style={d.scanLine}>
              <View style={d.scanFill} />
              <Text style={d.scanLabel}>◆</Text>
              <View style={d.scanFill} />
            </View>

            {/* Stat cards */}
            <View style={d.cardGrid}>
              <StatCard
                label="TODAY"
                value={formatCost(todayCost)}
                valueColor={todayCost > 1 ? colors.warning : colors.text}
                accent={todayCost > 1 ? colors.warning : undefined}
                delay={0}
              />
              <StatCard label="TOKENS" value={formatTokens(totalTokens)} accent={colors.accent} delay={70} />
              <StatCard
                label="CACHE HIT"
                value={`${Math.round(cacheHitRate * 100)}%`}
                valueColor={cacheHitRate > 0.5 ? colors.success : colors.text}
                accent={cacheHitRate > 0.5 ? colors.success : undefined}
                delay={140}
              />
              <StatCard label="SESSIONS" value={String(totalSessions)} delay={210} />
            </View>

            {/* Model breakdown */}
            {sorted.length > 0 && (
              <>
                <View style={d.sectionHead}>
                  <Text style={d.sectionLabel}>BY MODEL</Text>
                  <View style={d.sectionLine} />
                </View>
                <View style={d.modelBlock}>
                  {sorted.map((m, i) => (
                    <ModelBar
                      key={m.model}
                      model={m.model}
                      cost={parseFloat(m.totalCost)}
                      pct={maxCost > 0 ? (parseFloat(m.totalCost) / maxCost) * 100 : 0}
                      isTop={i === 0}
                      delay={i * 60}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Quick actions */}
            <View style={d.sectionHead}>
              <Text style={d.sectionLabel}>ACTIONS</Text>
              <View style={d.sectionLine} />
            </View>
            <ActionButtons router={router} />
          </>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    padding: 14, overflow: "hidden", minHeight: 74, justifyContent: "space-between",
  },
  cardGlow: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: radius.sm,
  },
  cardLabel: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.6,
    color: colors.textSecondary, textTransform: "uppercase", marginBottom: 6,
  },
  cardValue: {
    fontFamily: fonts.sans, fontSize: 21, fontWeight: "300",
    letterSpacing: -0.8, color: colors.text,
  },
});

const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: space.lg, paddingVertical: 14,
  },
  topRight:  { flexDirection: "row", alignItems: "center", gap: 8 },
  logoRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  logoBadge: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.accent,
    shadowRadius: 8,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
  },
  logoImg:   { width: 18, height: 18 },
  pageTitle: {
    fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 3,
    color: colors.accent, textTransform: "uppercase",
  },
  pageDate:  { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.5 },
  pageTime:  { fontFamily: fonts.mono, fontSize: 11, color: colors.text, letterSpacing: 0.5 },
  topBorderAccent: { height: 1, backgroundColor: colors.accent + "35" },

  // Alert
  alertBanner: { margin: space.md, marginBottom: 0, borderWidth: 1, borderRadius: radius.sm, overflow: "hidden", flexDirection: "row" },
  alertStripe: { width: 3 },
  alertInner:  { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingVertical: 10, gap: 8 },
  alertText:   { flex: 1, fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  alertDismiss:{ fontFamily: fonts.sans, fontSize: 15, opacity: 0.7 },

  // Error
  errorBlock: { padding: space.xl, alignItems: "center", gap: 12, marginTop: space.xl },
  errorIcon: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerMuted,
    alignItems: "center", justifyContent: "center",
  },
  errorIconText: { fontFamily: fonts.sansMedium, fontSize: 20, color: colors.danger, lineHeight: 24 },
  errorLabel:  { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.8, color: colors.danger, textTransform: "uppercase" },
  errorSub:    { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary },
  retryBtn: {
    borderWidth: 1, borderColor: colors.accentBorder, backgroundColor: colors.accentMuted,
    paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.xs, marginTop: 4,
  },
  retryText: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.8, color: colors.accent, textTransform: "uppercase" },

  // Hero
  heroBlock: { paddingHorizontal: space.lg, paddingTop: space.xl + 4, paddingBottom: space.xl },
  heroLabel: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 2.4,
    color: colors.textSecondary, textTransform: "uppercase", marginBottom: 10,
  },
  heroCost: {
    fontFamily: fonts.sans, fontSize: 60, fontWeight: "300",
    letterSpacing: -4, lineHeight: 60, marginBottom: 12,
  },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroSub:  { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary, letterSpacing: 0.3 },
  liveChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.successMuted, borderWidth: 1, borderColor: colors.successBorder,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2,
  },
  liveChipText: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.4, color: colors.success, textTransform: "uppercase" },

  // Scan line
  scanLine:  { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, marginBottom: space.md },
  scanFill:  { flex: 1, height: 1, backgroundColor: colors.border },
  scanLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textTertiary, marginHorizontal: space.md },

  // Cards
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: space.md, marginBottom: space.md },

  // Section
  sectionHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, marginBottom: 2, marginTop: space.sm, gap: 10 },
  sectionLabel: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 2.0,
    color: colors.textSecondary, textTransform: "uppercase", flexShrink: 0,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },

  // Model bars
  modelBlock: {
    paddingHorizontal: space.lg, paddingVertical: space.sm,
    backgroundColor: colors.surface, marginHorizontal: space.md,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    marginBottom: space.md, gap: 12,
  },
  modelRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  modelName: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary, width: 88 },
  barTrack:  { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden" },
  barFill:   { height: "100%", borderRadius: 2 },
  modelCost: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary, width: 64, textAlign: "right" },

  // Actions
  actionGrid: { flexDirection: "row", gap: 8, paddingHorizontal: space.md, marginBottom: space.md },
  actionPrimary: {
    flex: 2, backgroundColor: colors.accent,
    paddingVertical: 16, alignItems: "center", borderRadius: radius.sm, overflow: "hidden",
    shadowColor: colors.accent, shadowRadius: 12, shadowOpacity: 0.5, shadowOffset: { width: 0, height: 4 },
  },
  actionGlow: {
    position: "absolute", top: -20, left: -20, right: -20, bottom: -20,
    backgroundColor: colors.white,
    opacity: 0,
  },
  actionPrimaryText: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 1.6, color: "#000", textTransform: "uppercase" },
  actionSecondary: {
    flex: 1, backgroundColor: "transparent",
    paddingVertical: 16, alignItems: "center", borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderStrong,
  },
  actionSecondaryText: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 1.4, color: colors.text, textTransform: "uppercase" },
});
