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

const AGENT_META: Record<string, { color: string; label: string }> = {
  claude:   { color: "#D4B896", label: "Claude Code" },
  opencode: { color: "#7C83FD", label: "OpenCode" },
  codex:    { color: "#10A37F", label: "Codex CLI" },
  gemini:   { color: "#4285F4", label: "Gemini CLI" },
  aider:    { color: "#22c55e", label: "Aider" },
};

function getAgent(type: string) {
  return AGENT_META[type] ?? { color: "#888", label: type };
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function SessionRow({ session, onPress }: { session: AgentSession; onPress: () => void }) {
  const agent = getAgent(session.agentType);
  const isActive = session.status === "active";
  const time = session.updatedAt ? relativeTime(session.updatedAt) : "";

  return (
    <TouchableOpacity style={styles.sessionRow} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.sessionLeft}>
        {isActive ? (
          <View style={styles.activeDot} />
        ) : (
          <View style={styles.inactiveDot} />
        )}
        <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>
      </View>
      <Text style={styles.sessionTime}>{time}</Text>
    </TouchableOpacity>
  );
}

function FolderGroup({
  title,
  sessions,
  onPress,
}: {
  title: string;
  sessions: AgentSession[];
  onPress: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sessions : sessions.slice(0, 5);

  return (
    <View style={styles.folderGroup}>
      <TouchableOpacity
        style={styles.folderHeader}
        onPress={() => setCollapsed((c) => !c)}
        activeOpacity={0.7}
      >
        <Text style={styles.folderChevron}>{collapsed ? "▶" : "▼"}</Text>
        <Text style={styles.folderIcon}>⊟</Text>
        <Text style={styles.folderTitle}>{title}</Text>
      </TouchableOpacity>

      {!collapsed && (
        <>
          {visible.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              onPress={() => onPress(s.id)}
            />
          ))}
          {!showAll && sessions.length > 5 && (
            <TouchableOpacity
              style={styles.showMore}
              onPress={() => setShowAll(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.showMoreText}>Show more</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

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

  const filteredSessions = searchQuery
    ? sessions.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.agentType.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sessions;

  // Group by agentType for the folder view
  const agentGroups = Object.entries(AGENT_META).reduce(
    (acc, [agentType, meta]) => {
      const group = filteredSessions.filter((s) => s.agentType === agentType);
      if (group.length > 0) acc.push({ agentType, label: meta.label, sessions: group });
      return acc;
    },
    [] as { agentType: string; label: string; sessions: AgentSession[] }[]
  );

  const otherSessions = filteredSessions.filter(
    (s) => !Object.keys(AGENT_META).includes(s.agentType)
  );
  if (otherSessions.length > 0) {
    agentGroups.push({ agentType: "other", label: "Other", sessions: otherSessions });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerSnowflake}>✳</Text>
          <Text style={styles.headerTitle}>AGENTPILOT</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push("/new-session")}
          activeOpacity={0.7}
        >
          <Text style={styles.newBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* New Session row */}
      <TouchableOpacity
        style={styles.newSessionRow}
        onPress={() => router.push("/new-session")}
        activeOpacity={0.7}
      >
        <Text style={styles.newSessionPlus}>+</Text>
        <Text style={styles.newSessionText}>New Session</Text>
      </TouchableOpacity>

      {/* Search row */}
      {searching ? (
        <View style={styles.searchInputRow}>
          <Text style={styles.searchIcon}>Q</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search sessions..."
            placeholderTextColor="#444"
            autoFocus
            onBlur={() => { if (!searchQuery) setSearching(false); }}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => { setSearchQuery(""); setSearching(false); }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.searchRow}
          onPress={() => setSearching(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.searchIcon}>Q</Text>
          <Text style={styles.searchPlaceholder}>Search</Text>
        </TouchableOpacity>
      )}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Projects section */}
      {loading ? (
        <View style={styles.loadWrap}>
          <ActivityIndicator color="#888" size="small" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor="#555"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.projectsLabel}>Projects</Text>

          {agentGroups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No sessions yet</Text>
              <TouchableOpacity onPress={() => router.push("/new-session")} activeOpacity={0.7}>
                <Text style={styles.emptyAction}>Start a new session →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            agentGroups.map((group) => (
              <FolderGroup
                key={group.agentType}
                title={group.label}
                sessions={group.sessions}
                onPress={(id) => router.push(`/session/${id}`)}
              />
            ))
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 4 }]}>
        <View style={styles.bottomLeft}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <Text style={styles.bottomUsername}>Agent</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} activeOpacity={0.7}>
          <Text style={styles.settingsIcon}>☼</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#141414" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerSnowflake: { color: "#ffffff", fontSize: 14 },
  headerTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  newBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#252525",
    alignItems: "center",
    justifyContent: "center",
  },
  newBtnText: { color: "#aaa", fontSize: 18, lineHeight: 22 },

  // New session row
  newSessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  newSessionPlus: { color: "#555", fontSize: 16, width: 20, textAlign: "center" },
  newSessionText: { color: "#888", fontSize: 14, fontWeight: "400" },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  searchIcon: { color: "#555", fontSize: 14, width: 20, textAlign: "center" },
  searchPlaceholder: { color: "#555", fontSize: 14 },
  searchInput: { flex: 1, color: "#e0e0e0", fontSize: 14, paddingVertical: 2 },
  searchClear: { color: "#555", fontSize: 14, paddingHorizontal: 4 },

  // Divider
  divider: { height: 1, backgroundColor: "#222", marginHorizontal: 0 },

  // Projects
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  projectsLabel: {
    color: "#555",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    textTransform: "uppercase",
  },

  // Folder group
  folderGroup: { marginBottom: 4 },
  folderHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 7,
  },
  folderChevron: { color: "#444", fontSize: 9 },
  folderIcon: { color: "#555", fontSize: 13 },
  folderTitle: { color: "#aaa", fontSize: 13, fontWeight: "500", flex: 1 },

  // Session row
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 9,
    paddingLeft: 44,
  },
  sessionLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 8 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  inactiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2a2a2a" },
  sessionName: {
    color: "#c8c8c8",
    fontSize: 13,
    fontWeight: "400",
    flex: 1,
  },
  sessionTime: {
    color: "#444",
    fontSize: 12,
    fontWeight: "400",
    marginLeft: 8,
  },

  // Show more
  showMore: { paddingHorizontal: 16, paddingLeft: 44, paddingVertical: 8 },
  showMoreText: { color: "#555", fontSize: 12 },

  // Load / empty
  loadWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { color: "#444", fontSize: 14 },
  emptyAction: { color: "#666", fontSize: 13 },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#222",
    backgroundColor: "#141414",
  },
  bottomLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#aaa", fontSize: 12, fontWeight: "600" },
  bottomUsername: { color: "#aaa", fontSize: 13, fontWeight: "400" },
  settingsBtn: { padding: 4 },
  settingsIcon: { color: "#555", fontSize: 18 },
});
