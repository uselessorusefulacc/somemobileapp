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
  Pressable,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type AgentSession } from "../../lib/api";

// ── Design tokens ────────────────────────────────────────────────
const BG      = "#141414";
const LINE    = "#1e1e1e";
const TEXT    = "#f0f0f0";
const TEXT_2  = "#888";
const TEXT_3  = "#444";
const HOVER   = "#1e1e1e";
const GREEN   = "#22c55e";

const AGENT_META: Record<string, { color: string; label: string; logo: string }> = {
  claude:   { color: "#D4A574", label: "Claude Code",   logo: "A"  },
  opencode: { color: "#818CF8", label: "OpenCode",       logo: "O"  },
  codex:    { color: "#10A37F", label: "Codex CLI",      logo: "C"  },
  gemini:   { color: "#4285F4", label: "Gemini CLI",     logo: "G"  },
  aider:    { color: "#22c55e", label: "Aider",          logo: "Ai" },
  copilot:  { color: "#a78bfa", label: "GitHub Copilot", logo: "Co" },
  cline:    { color: "#fb923c", label: "Cline",          logo: "Cl" },
};

function getAgent(type: string) {
  return AGENT_META[type] ?? { color: "#666", label: type, logo: type[0]?.toUpperCase() ?? "?" };
}

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ── Session row ──────────────────────────────────────────────────
function SessionRow({ session, onPress }: { session: AgentSession; onPress: () => void }) {
  const isActive = session.status === "active";
  const time = session.updatedAt ? relativeTime(session.updatedAt) : "";
  return (
    <TouchableOpacity style={s.sessionRow} onPress={onPress} activeOpacity={0.6}>
      <View style={[s.sessionIndicator, { backgroundColor: isActive ? GREEN : "transparent" }]} />
      <Text style={s.sessionName} numberOfLines={1}>{session.name}</Text>
      <Text style={s.sessionTime}>{time}</Text>
    </TouchableOpacity>
  );
}

// ── Folder group ─────────────────────────────────────────────────
function FolderGroup({ label, color, logo, sessions, onPress }: {
  label: string; color: string; logo: string;
  sessions: AgentSession[];
  onPress: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sessions : sessions.slice(0, 5);

  return (
    <View>
      <TouchableOpacity
        style={s.folderRow}
        onPress={() => setCollapsed((c) => !c)}
        activeOpacity={0.65}
      >
        <Text style={[s.folderChevron, collapsed && s.folderChevronCollapsed]}>›</Text>
        <View style={[s.folderDot, { backgroundColor: color + "25", borderColor: color + "55" }]}>
          <Text style={[s.folderLogo, { color }]}>{logo}</Text>
        </View>
        <Text style={s.folderLabel}>{label}</Text>
        <Text style={s.folderCount}>{sessions.length}</Text>
      </TouchableOpacity>

      {!collapsed && (
        <>
          {visible.map((sess) => (
            <SessionRow key={sess.id} session={sess} onPress={() => onPress(sess.id)} />
          ))}
          {!showAll && sessions.length > 5 && (
            <TouchableOpacity style={s.showMore} onPress={() => setShowAll(true)} activeOpacity={0.7}>
              <Text style={s.showMoreText}>Show {sessions.length - 5} more</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────
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

  // Build folder groups
  const groups = Object.entries(AGENT_META).reduce(
    (acc, [agentType, meta]) => {
      const group = filtered.filter((s) => s.agentType === agentType);
      if (group.length) acc.push({ agentType, ...meta, sessions: group });
      return acc;
    },
    [] as { agentType: string; label: string; color: string; logo: string; sessions: AgentSession[] }[]
  );
  const others = filtered.filter((s) => !Object.keys(AGENT_META).includes(s.agentType));
  if (others.length) groups.push({ agentType: "other", label: "Other", color: "#666", logo: "?", sessions: others });

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Header ───────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.snowflake}>✳</Text>
          <Text style={s.appName}>AGENTPILOT</Text>
        </View>
        <TouchableOpacity
          style={s.collapseBtn}
          onPress={() => router.push("/new-session")}
          activeOpacity={0.7}
        >
          <Text style={s.collapseBtnText}>⊞</Text>
        </TouchableOpacity>
      </View>

      {/* ── New session row ───────────────────────────────────── */}
      <TouchableOpacity
        style={s.actionRow}
        onPress={() => router.push("/new-session")}
        activeOpacity={0.6}
      >
        <Text style={s.actionIcon}>+</Text>
        <Text style={s.actionText}>New Session</Text>
      </TouchableOpacity>

      {/* ── Search row ───────────────────────────────────────── */}
      {searching ? (
        <View style={s.searchInputRow}>
          <Text style={s.searchIconText}>⌕</Text>
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search sessions…"
            placeholderTextColor="#333"
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
        <TouchableOpacity style={s.actionRow} onPress={() => setSearching(true)} activeOpacity={0.6}>
          <Text style={s.actionIcon}>⌕</Text>
          <Text style={[s.actionText, { color: TEXT_3 }]}>Search</Text>
        </TouchableOpacity>
      )}

      <View style={s.divider} />

      {/* ── Projects section ─────────────────────────────────── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#555" size="small" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor="#444"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={s.projectsHeader}>
            <Text style={s.projectsLabel}>Projects</Text>
            <Text style={s.filterIcon}>⊟</Text>
          </View>

          {groups.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No sessions yet</Text>
              <Text style={s.emptySub}>Start a new session to begin tracking</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/new-session")} activeOpacity={0.7}>
                <Text style={s.emptyBtnText}>+ New Session</Text>
              </TouchableOpacity>
            </View>
          ) : (
            groups.map((g) => (
              <FolderGroup
                key={g.agentType}
                label={g.label}
                color={g.color}
                logo={g.logo}
                sessions={g.sessions}
                onPress={(id) => router.push(`/session/${id}`)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* ── Bottom bar ───────────────────────────────────────── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 6 }]}>
        <View style={s.bottomLeft}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>A</Text>
          </View>
          <Text style={s.bottomName}>Agent</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={s.settingsIcon}>☼</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },

  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  snowflake: { color: TEXT, fontSize: 15 },
  appName: { color: TEXT, fontSize: 13, fontWeight: "700", letterSpacing: 0.8 },
  collapseBtn: {
    width: 30, height: 30, borderRadius: 7,
    backgroundColor: "#1e1e1e",
    alignItems: "center", justifyContent: "center",
  },
  collapseBtnText: { color: TEXT_2, fontSize: 14 },

  // Action rows (new session / search)
  actionRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 11, gap: 12,
  },
  actionIcon: { color: TEXT_3, fontSize: 15, width: 18, textAlign: "center" },
  actionText: { color: TEXT_2, fontSize: 14 },

  // Search input
  searchInputRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 9, gap: 12,
  },
  searchIconText: { color: TEXT_3, fontSize: 16, width: 18, textAlign: "center" },
  searchInput: { flex: 1, color: TEXT, fontSize: 14, paddingVertical: 2 },
  searchClear: { color: TEXT_3, fontSize: 14 },

  divider: { height: 1, backgroundColor: LINE },

  // Projects header
  projectsHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  },
  projectsLabel: { color: TEXT_3, fontSize: 11, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  filterIcon: { color: TEXT_3, fontSize: 14 },

  // Folder row
  folderRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 9, gap: 8,
  },
  folderChevron: { color: "#333", fontSize: 14, transform: [{ rotate: "90deg" }], marginRight: -2 },
  folderChevronCollapsed: { transform: [{ rotate: "0deg" }] },
  folderDot: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  folderLogo: { fontSize: 10, fontWeight: "700" },
  folderLabel: { flex: 1, color: TEXT_2, fontSize: 13, fontWeight: "500" },
  folderCount: { color: TEXT_3, fontSize: 12 },

  // Session row
  sessionRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    paddingLeft: 50, gap: 8,
  },
  sessionIndicator: { width: 5, height: 5, borderRadius: 3, marginRight: 2 },
  sessionName: { flex: 1, color: TEXT_2, fontSize: 13 },
  sessionTime: { color: TEXT_3, fontSize: 12 },

  // Show more
  showMore: { paddingHorizontal: 50, paddingVertical: 8 },
  showMoreText: { color: TEXT_3, fontSize: 12 },

  // Empty state
  empty: { alignItems: "center", paddingTop: 64, gap: 8 },
  emptyTitle: { color: TEXT_2, fontSize: 16, fontWeight: "500" },
  emptySub: { color: TEXT_3, fontSize: 13, textAlign: "center" },
  emptyBtn: {
    marginTop: 12, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: "#2a2a2a",
  },
  emptyBtnText: { color: TEXT_2, fontSize: 13 },

  // Bottom bar
  bottomBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: LINE,
    backgroundColor: BG,
  },
  bottomLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: TEXT_2, fontSize: 12, fontWeight: "600" },
  bottomName: { color: TEXT_2, fontSize: 13 },
  settingsIcon: { color: TEXT_3, fontSize: 18, padding: 4 },
});
