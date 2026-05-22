import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type Analytics } from "../../lib/api";
import { colors, fonts, radius, space } from "../../lib/theme";

function formatCost(c: number) {
  if (c === 0) return "$0.00";
  if (c < 0.001) return `$${(c * 100000).toFixed(1)}μ`;
  if (c < 1) return `$${c.toFixed(4)}`;
  return `$${c.toFixed(2)}`;
}

function formatTokens(t: number) {
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(2)}M`;
  if (t >= 1_000) return `${(t / 1_000).toFixed(1)}K`;
  return String(t);
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(false);
    try {
      const d = await apiClient.getAnalytics();
      setStats(d);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const totalCost = parseFloat(stats?.totalCost || "0");
  const todayCost = stats?.dailyCost || 0;
  const totalTokens = stats?.totalTokens || 0;
  const activeSessions = stats?.activeSessions || 0;
  const totalSessions = stats?.totalSessions || 0;

  return (
    <View style={[d.root, { paddingTop: insets.top }]}>
      <View style={d.topBar}>
        <Text style={d.pageTitle}>DASHBOARD</Text>
        <Text style={d.pageDate}>
          {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
        </Text>
      </View>

      <View style={d.divider} />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={colors.textTertiary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero cost ── */}
        <View style={d.heroBlock}>
          <Text style={d.heroLabel}>TOTAL SPEND</Text>
          <Text style={[d.heroCost, { color: totalCost > 10 ? colors.danger : totalCost > 1 ? colors.warning : colors.text }]}>
            {formatCost(totalCost)}
          </Text>
          <Text style={d.heroSub}>All time across all agents</Text>
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

        {/* ── Agent breakdown ── */}
        {stats?.modelBreakdown && stats.modelBreakdown.length > 0 && (
          <>
            <Text style={d.sectionLabel}>BY MODEL</Text>
            {stats.modelBreakdown
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
            onPress={() => router.push("/cost" as any)}
            activeOpacity={0.7}
          >
            <Text style={[d.actionBtnText, d.actionBtnOutlineText]}>VIEW COSTS</Text>
          </TouchableOpacity>
        </View>

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
    paddingVertical: space.md,
  },
  pageTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  pageDate: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },

  // Hero block
  heroBlock: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl + 8,
    paddingBottom: space.xl,
  },
  heroLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: space.sm,
  },
  heroCost: {
    fontFamily: fonts.sans,
    fontSize: 48,
    fontWeight: "400",
    letterSpacing: -2,
    lineHeight: 48,
    marginBottom: space.sm,
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0,
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
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statValue: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: -0.3,
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
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: "uppercase",
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },

  // Agent bars
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    gap: space.sm,
  },
  agentName: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    width: 72,
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
    fontSize: 12,
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
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 3,
  },
  actionBtnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  actionBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.bg,
    textTransform: "uppercase",
  },
  actionBtnOutlineText: {
    color: colors.text,
  },
});
