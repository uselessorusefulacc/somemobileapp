import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type AgentSession } from "../../lib/api";
import { colors, fonts, radius, space } from "../../lib/theme";
import { formatCost, getStatusColor } from "../../lib/format";

// ── Session row ────────────────────────────────────────────────────────────
function SessionRow({ item, onPress }: { item: AgentSession; onPress: () => void }) {
  const cost = parseFloat(item.totalCost || "0");
  const isActive = item.status === "active";
  const statusColor = getStatusColor(item.status);
  const date = new Date(item.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const tokens = item.totalTokens ? `${(item.totalTokens / 1000).toFixed(1)}K` : "—";
  const costTint =
    cost > 1 ? colors.danger :
    cost > 0.1 ? colors.warning :
    colors.textSecondary;

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.6}>
      {/* Left pulse — visible when active */}
      <View style={[s.accent, { backgroundColor: isActive ? colors.success : "transparent" }]} />

      <View style={s.rowBody}>
        <View style={s.rowTop}>
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          <Text style={[s.cost, { color: costTint }]}>{formatCost(cost)}</Text>
        </View>
        <View style={s.rowMeta}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={s.metaText}>{item.agentType.toUpperCase()}</Text>
          <Text style={s.metaSep}>·</Text>
          <Text style={s.metaText}>{tokens}</Text>
          <Text style={s.metaSep}>·</Text>
          <Text style={s.metaDate}>{date}</Text>
        </View>
      </View>

      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>NO SESSIONS</Text>
      <Text style={s.emptySub}>Start your first agent session to see it here</Text>
      <TouchableOpacity style={s.emptyBtn} onPress={onNew} activeOpacity={0.7}>
        <Text style={s.emptyBtnText}>NEW SESSION</Text>
      </TouchableOpacity>
    </View>
  );
}

// BUG-33: error state
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={s.empty}>
      <Text style={[s.emptyTitle, { color: colors.danger }]}>LOAD FAILED</Text>
      <Text style={s.emptySub}>Could not fetch sessions from API</Text>
      <TouchableOpacity style={s.emptyBtn} onPress={onRetry} activeOpacity={0.7}>
        <Text style={s.emptyBtnText}>RETRY</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function SessionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  // BUG-13: AbortController timeout
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const data = await apiClient.getSessions();
      setSessions(data.sessions || []);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        console.error("[sessions]", e);
        setError(true);
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  // Count active sessions for pill display
  const activeCount = sessions.filter((s) => s.status === "active").length;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <Text style={s.pageTitle}>SESSIONS</Text>
        <View style={s.topRight}>
          {activeCount > 0 && (
            <View style={s.activePill}>
              <View style={s.activeDot} />
              <Text style={s.activeText}>{activeCount} LIVE</Text>
            </View>
          )}
          <TouchableOpacity
            style={s.newBtn}
            onPress={() => router.push("/new-session")}
            activeOpacity={0.7}
          >
            <Text style={s.newBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={s.divider} />

      {loading && !refreshing ? (
        <View style={s.loadWrap}>
          <ActivityIndicator color={colors.textTertiary} size="small" />
        </View>
      ) : error ? (
        <ErrorState onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SessionRow
              item={item}
              onPress={() => router.push(`/session/${item.id}`)}
            />
          )}
          ItemSeparatorComponent={() => <View style={s.divider} />}
          ListEmptyComponent={<EmptyState onNew={() => router.push("/new-session")} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={colors.textTertiary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sessions.length === 0 ? { flex: 1 } : undefined}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  divider: { height: 1, backgroundColor: colors.border },

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
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  activeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.success,
    textTransform: "uppercase",
  },
  newBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 2,
  },
  newBtnText: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  loadWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingRight: space.lg,
    backgroundColor: colors.bg,
  },
  accent: {
    width: 2,
    alignSelf: "stretch",
    marginRight: space.md,
    borderRadius: 1,
  },
  rowBody: { flex: 1 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  name: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400",
    letterSpacing: -0.2,
    color: colors.text,
    paddingRight: space.sm,
  },
  cost: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: -0.2,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  metaText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.0,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
  metaSep: {
    fontFamily: fonts.sans,
    fontSize: 9,
    color: colors.textTertiary,
  },
  metaDate: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },
  chevron: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.textTertiary,
    marginLeft: space.sm,
    lineHeight: 20,
  },

  // Empty / error state
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
  emptySub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: space.lg,
    paddingVertical: 9,
    borderRadius: radius.xs,
    marginTop: 8,
  },
  emptyBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
});
