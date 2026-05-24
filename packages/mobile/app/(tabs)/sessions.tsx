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
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type AgentSession } from "../../lib/api";
import { colors, fonts, type, radius, space } from "../../lib/theme";

function formatCost(c: number) {
  if (c === 0) return "$0.00";
  if (c < 0.001) return `$${(c * 100000).toFixed(1)}μ`;
  if (c < 1) return `$${c.toFixed(4)}`;
  return `$${c.toFixed(2)}`;
}

function getStatusColor(s: string) {
  if (s === "active") return colors.success;
  if (s === "paused") return colors.warning;
  if (s === "error") return colors.danger;
  return colors.textTertiary;
}

function SessionRow({ item, onPress }: { item: AgentSession; onPress: () => void }) {
  const cost = parseFloat(item.totalCost || "0");
  const isActive = item.status === "active";
  const statusColor = getStatusColor(item.status);
  const date = new Date(item.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const tokens = item.totalTokens ? `${(item.totalTokens / 1000).toFixed(1)}K` : "—";

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.65}>
      {/* Left accent — 2px white bar when active */}
      <View style={[s.accent, { backgroundColor: isActive ? colors.text : "transparent" }]} />

      <View style={s.rowBody}>
        <View style={s.rowTop}>
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          <Text style={[s.cost, { color: cost > 1 ? colors.danger : cost > 0.1 ? colors.warning : colors.textSecondary }]}>
            {formatCost(cost)}
          </Text>
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
    </TouchableOpacity>
  );
}

export default function SessionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiClient.getSessions();
      setSessions(data.sessions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const active = sessions.filter((s) => s.status === "active");
  const rest = sessions.filter((s) => s.status !== "active");

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <Text style={s.pageTitle}>SESSIONS</Text>
        <TouchableOpacity
          style={s.newBtn}
          onPress={() => router.push("/new-session")}
          activeOpacity={0.7}
        >
          <Text style={s.newBtnText}>+ NEW</Text>
        </TouchableOpacity>
      </View>

      <View style={s.divider} />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.textTertiary} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyTitle}>NO SESSIONS</Text>
          <Text style={s.emptySub}>Start your first agent session</Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => router.push("/new-session")}
            activeOpacity={0.7}
          >
            <Text style={s.emptyBtnText}>NEW SESSION</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[...active, ...rest]}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={colors.textTertiary}
            />
          }
          ListHeaderComponent={
            // BUG-16 FIX: show RECENT label when no active sessions, else ACTIVE label
            active.length > 0 ? (
              <Text style={s.sectionLabel}>ACTIVE — {active.length}</Text>
            ) : (
              <Text style={s.sectionLabel}>RECENT</Text>
            )
          }
          renderItem={({ item, index }) => {
            const isFirst = index === active.length && active.length > 0;
            return (
              <>
                {isFirst && (
                  <>
                    <View style={s.divider} />
                    <Text style={s.sectionLabel}>RECENT</Text>
                  </>
                )}
                <SessionRow item={item} onPress={() => router.push(`/session/${item.id}`)} />
                <View style={s.rowDivider} />
              </>
            );
          }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

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
  newBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: space.sm + 4,
    paddingVertical: 5,
    borderRadius: radius.xs,
  },
  newBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text,
    textTransform: "uppercase",
  },

  divider: { height: 1, backgroundColor: colors.border },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 24 },

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

  // Session row
  row: {
    flexDirection: "row",
    paddingVertical: space.md,
    minHeight: 64,
  },
  accent: {
    width: 2,
    alignSelf: "stretch",
    marginLeft: space.lg - 2,
    marginRight: space.sm + 2,
    borderRadius: 1,
  },
  rowBody: { flex: 1, paddingRight: space.lg, justifyContent: "center" },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  name: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
    letterSpacing: -0.1,
    flex: 1,
    marginRight: 8,
  },
  cost: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 0,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  metaText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  metaSep: { color: colors.textTertiary, fontSize: 10 },
  metaDate: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
  },

  // Empty
  emptyTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  emptySub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: space.xl,
  },
  emptyBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.xs,
  },
  emptyBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text,
    textTransform: "uppercase",
  },
});
