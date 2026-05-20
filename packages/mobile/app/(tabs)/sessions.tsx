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

// ── Design tokens ────────────────────────────────────────────────
const BG       = "#080808";
const SURFACE  = "#111111";
const CARD     = "#141414";
const BORDER   = "#1f1f1f";
const LINE     = "#161616";
const TEXT     = "#ffffff";
const TEXT_2   = "#999";
const TEXT_3   = "#3a3a3a";
const GREEN    = "#22c55e";
const ACCENT   = "#a78bfa"; // purple-ish Raycast accent

const AGENT_META: Record<string, { color: string; label: string; logo: string }> = {
  claude:   { color: "#D4A574", label: "Claude Code",    logo: "A"  },
  opencode: { color: "#818CF8", label: "OpenCode",        logo: "O"  },
  codex:    { color: "#10A37F", label: "Codex CLI",       logo: "C"  },
  gemini:   { color: "#4285F4", label: "Gemini CLI",      logo: "G"  },
  aider:    { color: "#22c55e", label: "Aider",           logo: "Ai" },
  copilot:  { color: "#a78bfa", label: "GitHub Copilot",  logo: "Co" },
  cline:    { color: "#fb923c", label: "Cline",           logo: "Cl" },
};

function getAgent(type: string) {
  return AGENT_META[type] ?? { color: "#555", label: type, logo: type[0]?.toUpperCase() ?? "?" };
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
    <TouchableOpacity style={s.sessionRow} onPress={onPress} activeOpacity={0.5}>
      <View style={s.sessionIndentLine} />
      <View style={[
        s.sessionDot,
        isActive
          ? { backgroundColor: GREEN, shadowColor: GREEN, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4 }
          : { backgroundColor: TEXT_3 }
      ]} />
      <Text style={[s.sessionName, isActive && { color: TEXT }]} numberOfLines={1}>{session.name}</Text>
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
  const hasActive = sessions.some((s) => s.status === "active");

  return (
    <View style={s.folderGroup}>
      <TouchableOpacity
        style={s.folderRow}
        onPress={() => setCollapsed((c) => !c)}
        activeOpacity={0.6}
      >
        {/* Glow icon */}
        <View style={[s.folderIcon, {
          backgroundColor: color + "15",
          borderColor: color + "35",
          shadowColor: color,
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 3,
        }]}>
          <Text style={[s.folderLogo, { color }]}>{logo}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.folderLabel}>{label}</Text>
        </View>
        {hasActive && (
          <View style={[s.activeBadge, { borderColor: GREEN + "50" }]}>
            <View style={[s.activeDot, { shadowColor: GREEN, shadowOpacity: 1, shadowRadius: 4 }]} />
            <Text style={s.activeBadgeText}>live</Text>
          </View>
        )}
        <Text style={s.folderCount}>{sessions.length}</Text>
        <Text style={[s.chevron, collapsed && s.chevronCollapsed]}>›</Text>
      </TouchableOpacity>

      {!collapsed && (
        <View style={s.folderContent}>
          {visible.map((sess) => (
            <SessionRow key={sess.id} session={sess} onPress={() => onPress(sess.id)} />
          ))}
          {!showAll && sessions.length > 5 && (
            <TouchableOpacity style={s.showMore} onPress={() => setShowAll(true)} activeOpacity={0.7}>
              <Text style={s.showMoreText}>+{sessions.length - 5} more</Text>
            </TouchableOpacity>
          )}
        </View>
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

  const groups = Object.entries(AGENT_META).reduce(
    (acc, [agentType, meta]) => {
      const group = filtered.filter((s) => s.agentType === agentType);
      if (group.length) acc.push({ agentType, ...meta, sessions: group });
      return acc;
    },
    [] as { agentType: string; label: string; color: string; logo: string; sessions: AgentSession[] }[]
  );
  const others = filtered.filter((s) => !Object.keys(AGENT_META).includes(s.agentType));
  if (others.length) groups.push({ agentType: "other", label: "Other", color: "#555", logo: "?", sessions: others });

  const activeCount = sessions.filter((s) => s.status === "active").length;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Header ─────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.appName}>AgentPilot</Text>
          <Text style={s.appSub}>
            {activeCount > 0
              ? <Text style={{ color: GREEN }}>{activeCount} running</Text>
              : "no active sessions"}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.newBtn, {
            shadowColor: ACCENT,
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 8,
          }]}
          onPress={() => router.push("/new-session")}
          activeOpacity={0.8}
        >
          <Text style={s.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search bar ─────────────────────────────────── */}
      <View style={s.searchRow}>
        {searching ? (
          <View style={s.searchInputWrap}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput
              style={s.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search sessions, agents…"
              placeholderTextColor="#2a2a2a"
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
          <TouchableOpacity style={s.searchTrigger} onPress={() => setSearching(true)} activeOpacity={0.7}>
            <Text style={s.searchIcon}>⌕</Text>
            <Text style={s.searchPlaceholder}>Search…</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.divider} />

      {/* ── Sessions list ──────────────────────────────── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={ACCENT} size="small" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={ACCENT}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Section header */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>Projects</Text>
            <Text style={s.sectionCount}>{filtered.length} sessions</Text>
          </View>

          {groups.length === 0 ? (
            <View style={s.empty}>
              {/* Glow blob bg */}
              <View style={s.emptyGlow} />
              <Text style={s.emptyEmoji}>⚡</Text>
              <Text style={s.emptyTitle}>No sessions yet</Text>
              <Text style={s.emptySub}>Start tracking your AI agent costs</Text>
              <TouchableOpacity
                style={[s.emptyBtn, {
                  shadowColor: ACCENT,
                  shadowOpacity: 0.6,
                  shadowRadius: 16,
                  elevation: 8,
                }]}
                onPress={() => router.push("/new-session")}
                activeOpacity={0.8}
              >
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

      {/* ── Bottom bar ─────────────────────────────────── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={[s.avatar, {
          shadowColor: ACCENT,
          shadowOpacity: 0.4,
          shadowRadius: 8,
        }]}>
          <Text style={s.avatarText}>A</Text>
        </View>
        <Text style={s.bottomName}>AgentPilot</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={s.settingsIcon}>⚙</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  appName: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  appSub: {
    color: TEXT_3,
    fontSize: 12,
    marginTop: 2,
  },
  newBtn: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  // Search
  searchRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ACCENT + "44",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchIcon: { color: TEXT_3, fontSize: 16 },
  searchPlaceholder: { color: TEXT_3, fontSize: 14 },
  searchInput: { flex: 1, color: TEXT, fontSize: 14 },
  searchClear: { color: TEXT_3, fontSize: 14 },

  divider: { height: 1, backgroundColor: LINE },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionLabel: {
    color: TEXT_3,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sectionCount: { color: TEXT_3, fontSize: 11 },

  // Folder group
  folderGroup: {
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 14,
    overflow: "hidden",
  },
  folderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 1,
  },
  folderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  folderLogo: { fontSize: 13, fontWeight: "800" },
  folderLabel: { color: TEXT, fontSize: 14, fontWeight: "600" },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: GREEN + "10",
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: GREEN,
  },
  activeBadgeText: { color: GREEN, fontSize: 10, fontWeight: "600" },
  folderCount: { color: TEXT_3, fontSize: 13, fontWeight: "500", minWidth: 16, textAlign: "right" },
  chevron: { color: TEXT_3, fontSize: 16, transform: [{ rotate: "90deg" }] },
  chevronCollapsed: { transform: [{ rotate: "0deg" }] },

  // Session rows inside folder
  folderContent: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: BORDER,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginTop: -4,
    overflow: "hidden",
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  sessionIndentLine: {
    width: 1,
    height: 18,
    backgroundColor: BORDER,
    marginLeft: 6,
  },
  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sessionName: { flex: 1, color: TEXT_2, fontSize: 13, fontWeight: "400" },
  sessionTime: { color: TEXT_3, fontSize: 12 },

  showMore: { paddingHorizontal: 20, paddingVertical: 10 },
  showMoreText: { color: TEXT_3, fontSize: 12 },

  // Empty state
  empty: { alignItems: "center", paddingTop: 80, paddingBottom: 40, position: "relative" },
  emptyGlow: {
    position: "absolute",
    top: 40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: ACCENT + "08",
  },
  emptyEmoji: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { color: TEXT, fontSize: 20, fontWeight: "700", marginBottom: 8, letterSpacing: -0.3 },
  emptySub: { color: TEXT_3, fontSize: 14, textAlign: "center", marginBottom: 28 },
  emptyBtn: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 24,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: LINE,
    gap: 10,
    backgroundColor: BG,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#1a1a2e",
    borderWidth: 1,
    borderColor: ACCENT + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: ACCENT, fontSize: 12, fontWeight: "700" },
  bottomName: { color: TEXT_2, fontSize: 13, fontWeight: "500" },
  settingsIcon: { color: TEXT_3, fontSize: 18, padding: 4 },
});
