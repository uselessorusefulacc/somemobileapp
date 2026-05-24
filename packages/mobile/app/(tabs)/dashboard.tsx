import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type Analytics } from "../../lib/api";
import { colors, fonts, radius, space, shadow } from "../../lib/theme";
import { formatCost, formatTokens } from "../../lib/format";

// ── Budget Alert Banner ────────────────────────────────────────────────────
// GAP-04: Budget alert UI
function BudgetAlertBanner() {
  const [alerts, setAlerts] = useState<Array<{ level: "warn" | "critical"; message: string }>>([]);
  const [dismissed, setDismissed] = useState(false);

  useFocusEffect(useCallback(() => {
    let alive = true;
    apiClient.getAlerts()
      .then((r) => { if (alive) setAlerts(r.alerts); })
      .catch(() => {});
    return () => { alive = false; };
  }, []));

  if (dismissed || alerts.length === 0) return null;

  const top = alerts[0];
  const isCritical = top.level === "critical";
  const bg = isCritical ? colors.dangerMuted : colors.warningMuted;
  const border = isCritical ? colors.dangerBorder : colors.warningBorder;
  const textColor = isCritical ? colors.danger : colors.warning;

  return (
    <TouchableOpacity
      style={[d.alertBanner, { backgroundColor: bg, borderColor: border }]}
      onPress={() => setDismissed(true)}
      activeOpacity={0.8}
    >
      <View style={d.alertInner}>
        <View style={[d.alertDot, { backgroundColor: textColor }]} />
        <Text style={[d.alertText, { color: textColor }]} numberOfLines={2}>
          {top.message}
        </Text>
        <Text style={[d.alertDismiss, { color: textColor }]}>✕</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Error state ────────────────────────────────────────────────────────────
// BUG-33: user-facing error state
function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={d.errorBlock}>
      <Text style={d.errorLabel}>FETCH FAILED</Text>
      <Text style={d.errorSub}>Could not reach the API</Text>
      <TouchableOpacity style={d.retryBtn} onPress={onRetry} activeOpacity={0.7}>
        <Text style={d.retryText}>RETRY</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  // BUG-13: AbortController timeout
  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    setError(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const d = await apiClient.getAnalytics();
      setStats(d);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        console.error("[dashboard]", e);
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
  const totalTokens = stats?.totalTokens || 0;
  const activeSessions = stats?.activeSessions || 0;
  const totalSessions = stats?.totalSessions || 0;

  const heroCostColor =
    totalCost > 50 ? colors.danger :
    totalCost > 10 ? colors.warning :
    colors.text;

  return (
    <View style={[d.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={d.topBar}>
        <Text style={d.pageTitle}>DASHBOARD</Text>
        <Text style={d.pageDate}>
          {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
        </Text>
      </View>
      <View style={d.divider} />

      {/* Budget alert */}
      <BudgetAlertBanner />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(false); }}
            tintColor={colors.textTertiary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <ErrorBlock onRetry={() => load(false)} />
        ) : (
          <>
            {/* ── Hero cost ── */}
            <View style={d.heroBlock}>
              <Text style={d.heroLabel}>TOTAL SPEND</Text>
              <Text style={[d.heroCost, { color: heroCostColor }]}>
                {formatCost(totalCost)}
              </Text>
              <Text style={d.heroSub}>All time · all agents</Text>
            </View>

            <View style={d.divider} />

            {/* ── Stats row ── */}
            <View style={d.statRow}>
              <View style={d.stat}>
                <Text style={d.statLabel}>TODAY</Text>
                <Text style={[d.statValue, { color: todayCost > 1 ? colors.warning : colors.text }]}>
                  {formatCost(todayCost)}
                </Text>
              </View>
              <View style={d.statSep} />
              <View style={d.stat}>
                <Text style={d.statLabel}>TOKENS</Text>
                <Text style={d.statValue}>{formatTokens(totalTokens)}</Text>
              </View>
              <View style={d.statSep} />
              <View style={d.stat}>
                <Text style={d.statLabel}>ACTIVE</Text>
                <Text style={[d.statValue, { color: activeSessions > 0 ? colors.success : colors.text }]}>
                  {activeSessions}
                </Text>
              </View>
              <View style={d.statSep} />
              <View style={d.stat}>
                <Text style={d.statLabel}>TOTAL</Text>
                <Text style={d.statValue}>{totalSessions}</Text>
              </View>
            </View>

            <View style={d.divider} />

            {/* ── Model breakdown ── */}
            {stats?.modelBreakdown && stats.modelBreakdown.length > 0 && (
              <>
                <Text style={d.sectionLabel}>BY MODEL</Text>
                {[...stats.modelBreakdown]
                  .sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost))
                  .map((m, i, arr) => {
                    const cost = parseFloat(m.totalCost);
                    const maxCost = parseFloat(arr[0].totalCost);
                    const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
                    return (
                      <View key={m.model}>
                        <View style={d.agentRow}>
                          <Text style={d.agentName} numberOfLines={1}>{m.model}</Text>
                          <View style={d.barTrack}>
                            <View style={[d.barFill, { width: `${Math.max(pct, 1)}%` }]} />
                          </View>
                          <Text style={d.agentCost}>{formatCost(cost)}</Text>
                        </View>
                        {i < arr.length - 1 && <View style={d.rowDivider} />}
                      </View>
                    );
                  })}
                <View style={d.divider} />
              </>
            )}

            {/* ── Quick actions ── */}
            <Text style={d.sectionLabel}>QUICK ACTIONS</Text>
            <View style={d.actionGrid}>
              <TouchableOpacity
                style={d.actionBtn}
                onPress={() => router.push("/new-session")}
                activeOpacity={0.7}
              >
                <Text style={d.actionBtnText}>NEW SESSION</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[d.actionBtn, d.actionBtnOutline]}
                onPress={() => router.push("/(tabs)/cost")}
                activeOpacity={0.7}
              >
                <Text style={[d.actionBtnText, d.actionBtnOutlineText]}>VIEW COSTS</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  divider: { height: 1, backgroundColor: colors.border },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: space.lg },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: 13,
  },
  pageTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 2.0,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  pageDate: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },

  // Budget alert
  alertBanner: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  alertInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 10,
    gap: space.sm,
  },
  alertDot: { width: 4, height: 4, borderRadius: 2 },
  alertText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  alertDismiss: {
    fontFamily: fonts.sans,
    fontSize: 12,
    opacity: 0.6,
  },

  // Error
  errorBlock: {
    padding: space.xl,
    alignItems: "center",
    gap: 10,
  },
  errorLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.danger,
    textTransform: "uppercase",
  },
  errorSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textTertiary,
  },
  retryBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    borderRadius: radius.xs,
    marginTop: 4,
  },
  retryText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },

  // Hero
  heroBlock: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl + 8,
    paddingBottom: space.xl,
  },
  heroLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 2.0,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: space.sm,
  },
  heroCost: {
    fontFamily: fonts.sans,
    fontSize: 52,
    fontWeight: "300",
    letterSpacing: -3,
    lineHeight: 52,
    marginBottom: space.sm,
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },

  // Stat row
  statRow: {
    flexDirection: "row",
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 4,
  },
  stat: { flex: 1, alignItems: "flex-start" },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 8,
    letterSpacing: 1.6,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  statValue: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: -0.5,
    color: colors.text,
  },
  statSep: {
    width: 1,
    backgroundColor: colors.border,
    alignSelf: "stretch",
    marginHorizontal: space.sm,
    marginVertical: 2,
  },

  // Section label
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },

  // Agent model bars
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    gap: space.sm,
  },
  agentName: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    width: 76,
  },
  barTrack: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.textTertiary,
  },
  agentCost: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
    width: 68,
    textAlign: "right",
  },

  // Actions
  actionGrid: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.text,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radius.xs,
  },
  actionBtnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  actionBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.bg,
    textTransform: "uppercase",
  },
  actionBtnOutlineText: {
    color: colors.textSecondary,
  },
});
