import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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

// ── Agent group (Things 3 folder style with Linear aesthetics) ─────
function AgentGroup({ agentType, sessions, onPress }: {
  agentType: string;
  sessions: AgentSession[];
  onPress: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const agentColor = getAgentColor(agentType);
  const agentLabel = getAgentLabel(agentType);
  const hasActive = sessions.some((s) => s.status === "active");

  return (
    <View style={s.group}>
      {/* Group header */}
      <TouchableOpacity
        style={s.groupHeader}
        onPress={() => setCollapsed((c) => !c)}
        activeOpacity={0.6}
      >
        <View style={[s.groupIcon, { backgroundColor: agentColor + "18", borderColor: agentColor + "30" }]}>
          <Text style={[s.groupIconText, { color: agentColor }]}>
            {agentLabel.charAt(0)}
          </Text>
        </View>
        <View style={s.groupInfo}>
          <Text style={s.groupName}>{agentLabel}</Text>
          <Text style={s.groupCount}>{sessions.length} sessions</Text>
        </View>
        {hasActive && (
          <View style={[s.liveBadge, { backgroundColor: colors.successDim }]}>
            <View style={[s.liveDot, { backgroundColor: colors.success }]} />
            <Text style={[s.liveText, { color: colors.success }]}>Live</Text>
          </View>
        )}
        <Text style={[s.chevron, collapsed && s.chevronCollapsed]}>›</Text>
      </TouchableOpacity>

      {/* Sessions list */}
      {!collapsed && (
        <View style={s.groupList}>
          {sessions.map((session, i) => (
            <SessionRow
              key={session.id}
              session={session}
              onPress={() => onPress(session.id)}
              isLast={i === sessions.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Session row (Linear minimal list style) ────────────────────────
function SessionRow({ session, onPress, isLast = false }: {
  session: AgentSession;
  onPress: () => void;
  isLast?: boolean;
}) {
  const statusColor = getStatusColor(session.status);
  const cost = parseFloat(session.totalCost || "0");
  const time = session.updatedAt ? relativeTime(session.updatedAt) : "";

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowBorder]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={[s.rowDot, { backgroundColor: statusColor }]} />
      <View style={s.rowBody}>
        <Text style={s.rowName} numberOfLines={1}>{session.name}</Text>
        <Text style={s.rowMeta}>{session.model} · {time}</Text>
      </View>
      <Text style={[s.rowCost, { color: cost > 0.1 ? colors.warning : colors.textSecondary }]}>
        {formatCost(cost)}
      </Text>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────
export default function SessionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

  const filtered = searchQuery
    ? sessions.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.agentType.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sessions;

  // Group by agent type
  const groups = new Map<string, AgentSession[]>();
  for (const session of filtered) {
    const list = groups.get(session.agentType) || [];
    list.push(session);
    groups.set(session.agentType, list);
  }

  const activeCount = sessions.filter((s) => s.status === "active").length;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Sessions</Text>
          <Text style={s.headerSub}>
            {activeCount > 0 ? (
              <Text style={{ color: colors.success }}>{activeCount} active</Text>
            ) : (
              <Text style={{ color: colors.textTertiary }}>no active sessions</Text>
            )}
          </Text>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/new-session")} activeOpacity={0.7}>
          <Text style={s.headerBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        {searching ? (
          <View style={[s.searchBox, { borderColor: colors.accent + "40" }]}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput
              style={s.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search sessions..."
              placeholderTextColor={colors.textDisabled}
              autoFocus
              onBlur={() => { if (!searchQuery) setSearching(false); }}
            />
            {!!searchQuery && (
              <TouchableOpacity onPress={() => { setSearchQuery(""); setSearching(false); }}>
                <Text style={s.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity style={s.searchBox} onPress={() => setSearching(true)} activeOpacity={0.7}>
            <Text style={s.searchIcon}>⌕</Text>
            <Text style={s.searchPlaceholder}>Search sessions...</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={s.list}>
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconBg}>
                  <Text style={s.emptyIcon}>◫</Text>
                </View>
                <Text style={s.emptyTitle}>No sessions</Text>
                <Text style={s.emptySub}>Create a session to start tracking</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/new-session")} activeOpacity={0.7}>
                  <Text style={s.emptyBtnText}>Create Session</Text>
                </TouchableOpacity>
              </View>
            ) : (
              Array.from(groups.entries()).map(([agentType, groupSessions]) => (
                <AgentGroup
                  key={agentType}
                  agentType={agentType}
                  sessions={groupSessions}
                  onPress={(id) => router.push(`/session/${id}`)}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
  },
  headerTitle: { ...typography.title1, color: colors.text },
  headerSub: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.xs },
  headerBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  headerBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Search
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.base },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  searchIcon: { color: colors.textDisabled, fontSize: 15 },
  searchPlaceholder: { ...typography.bodySmall, color: colors.textDisabled },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  searchClear: { color: colors.textDisabled, fontSize: 13, fontWeight: "600" },

  // List
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  // Group
  group: { marginBottom: spacing.lg },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  groupIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  groupIconText: { fontSize: 13, fontWeight: "700" },
  groupInfo: { flex: 1 },
  groupName: { ...typography.body, color: colors.text },
  groupCount: { ...typography.caption, color: colors.textTertiary },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  liveText: { ...typography.caption, fontWeight: "600" },
  chevron: { color: colors.textDisabled, fontSize: 14, transform: [{ rotate: "90deg" }] },
  chevronCollapsed: { transform: [{ rotate: "0deg" }] },

  // Group list
  groupList: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowDot: { width: 6, height: 6, borderRadius: 3 },
  rowBody: { flex: 1 },
  rowName: { ...typography.body, color: colors.text, fontSize: 15 },
  rowMeta: { ...typography.caption, color: colors.textTertiary, marginTop: 1 },
  rowCost: { ...typography.body, fontSize: 14, fontWeight: "600" },

  // Empty
  empty: { alignItems: "center", paddingTop: spacing["3xl"] },
  emptyIconBg: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyIcon: { fontSize: 24, color: colors.accent },
  emptyTitle: { ...typography.title2, color: colors.text, marginBottom: spacing.sm },
  emptySub: { ...typography.caption, color: colors.textTertiary, textAlign: "center" },
  emptyBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.base,
    borderRadius: radius.md,
    marginTop: spacing.xl,
  },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
