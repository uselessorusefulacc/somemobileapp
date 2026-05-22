import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type AgentSession } from "../../lib/api";
import {
  colors,
  spacing,
  radius,
  typography,
  getAgentColor,
  getAgentLabel,
  formatCost,
  getStatusColor,
  relativeTime,
} from "../../lib/theme";

function SessionRow({
  session,
  onPress,
}: {
  session: AgentSession;
  onPress: () => void;
}) {
  const statusColor = getStatusColor(session.status);
  const agentColor = getAgentColor(session.agentType);
  const cost = parseFloat(session.totalCost || "0");
  const time = session.updatedAt ? relativeTime(session.updatedAt) : "";
  const isActive = session.status === "active";

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.5}>
      {/* status line on left */}
      <View style={[s.rowAccent, { backgroundColor: isActive ? statusColor : "transparent" }]} />

      <View style={s.rowContent}>
        <View style={s.rowTop}>
          <Text style={s.rowName} numberOfLines={1}>{session.name}</Text>
          <Text style={[s.rowCost, cost > 0.5 ? { color: colors.warning } : {}]}>
            {formatCost(cost)}
          </Text>
        </View>
        <View style={s.rowBottom}>
          <Text style={[s.rowAgent, { color: agentColor }]}>
            {getAgentLabel(session.agentType).toUpperCase()}
          </Text>
          <Text style={s.rowDot}>·</Text>
          <Text style={s.rowTime}>{time}</Text>
          {isActive && (
            <>
              <Text style={s.rowDot}>·</Text>
              <View style={[s.activePip, { backgroundColor: statusColor }]} />
              <Text style={[s.rowActive, { color: statusColor }]}>ACTIVE</Text>
            </>
          )}
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
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiClient.getSessions();
      setSessions(data.sessions || []);
    } catch (e) {
      console.error("[sessions]", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(false); }, [load]));

  const filtered = query
    ? sessions.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.agentType.toLowerCase().includes(query.toLowerCase())
      )
    : sessions;

  const activeCount = sessions.filter((s) => s.status === "active").length;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>Sessions</Text>
          {activeCount > 0 && (
            <View style={s.activeBadge}>
              <View style={s.activeBadgeDot} />
              <Text style={s.activeBadgeText}>{activeCount} live</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={s.newBtn}
          onPress={() => router.push("/new-session")}
          activeOpacity={0.7}
        >
          <Text style={s.newBtnText}>NEW</Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={s.divider} />

      {/* Search */}
      <View style={s.searchRow}>
        {searching ? (
          <View style={s.searchActive}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search sessions..."
              placeholderTextColor={colors.textDisabled}
              autoFocus
              onBlur={() => { if (!query) setSearching(false); }}
            />
            {!!query && (
              <TouchableOpacity onPress={() => { setQuery(""); setSearching(false); }}>
                <Text style={s.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity style={s.searchTrigger} onPress={() => setSearching(true)} activeOpacity={0.6}>
            <Text style={s.searchIcon}>⌕</Text>
            <Text style={s.searchLabel}>Search</Text>
          </TouchableOpacity>
        )}
        <Text style={s.countLabel}>{filtered.length} sessions</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.textTertiary} size="small" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SessionRow session={item} onPress={() => router.push(`/session/${item.id}`)} />
          )}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={colors.textTertiary}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No sessions</Text>
              <Text style={s.emptySub}>Create a session to start tracking your agent.</Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => router.push("/new-session")}
                activeOpacity={0.7}
              >
                <Text style={s.emptyBtnText}>CREATE SESSION</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { ...typography.title1, color: colors.text },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.successDim,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(40,200,64,0.15)",
  },
  activeBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success },
  activeBadgeText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.5, color: colors.success },

  newBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newBtnText: { ...typography.label, color: colors.text },

  divider: { height: 1, backgroundColor: colors.border },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchTrigger: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  searchActive: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginRight: spacing.base,
  },
  searchIcon: { color: colors.textTertiary, fontSize: 14 },
  searchLabel: { ...typography.caption, color: colors.textTertiary },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, padding: 0 },
  searchClear: { color: colors.textTertiary, fontSize: 12 },
  countLabel: { ...typography.label, color: colors.textTertiary },

  separator: { height: 1, backgroundColor: colors.border },

  row: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.bg,
  },
  rowAccent: { width: 2, marginVertical: 4 },
  rowContent: {
    flex: 1,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    gap: 5,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowName: { ...typography.body, color: colors.text, flex: 1, marginRight: spacing.sm },
  rowCost: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: "500" },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 5 },
  rowAgent: { ...typography.label, fontSize: 9 },
  rowDot: { color: colors.textTertiary, fontSize: 10 },
  rowTime: { ...typography.caption, color: colors.textTertiary },
  activePip: { width: 4, height: 4, borderRadius: 2 },
  rowActive: { fontSize: 9, fontWeight: "600", letterSpacing: 0.6 },

  empty: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: spacing["2xl"],
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.title3, color: colors.textSecondary },
  emptySub: { ...typography.caption, color: colors.textTertiary, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
  },
  emptyBtnText: { ...typography.label, color: colors.text },
});
