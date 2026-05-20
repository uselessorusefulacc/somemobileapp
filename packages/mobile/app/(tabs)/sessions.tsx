import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "../../lib/theme";
import { apiClient, type AgentSession } from "../../lib/api";

const AGENT_META: Record<string, { color: string; label: string; logo: string }> = {
  claude:   { color: "#D4B896", label: "Claude Code", logo: "✦" },
  opencode: { color: "#7C83FD", label: "OpenCode",    logo: "</>" },
  codex:    { color: "#10A37F", label: "Codex CLI",   logo: "⬡" },
  gemini:   { color: "#4285F4", label: "Gemini CLI",  logo: "◈" },
  aider:    { color: "#22c55e", label: "Aider",       logo: "⌥" },
};

function getAgent(type: string) {
  return AGENT_META[type] ?? { color: colors.accent, label: type, logo: "▣" };
}

function SessionCard({ session, onPress }: { session: AgentSession; onPress: () => void }) {
  const agent = getAgent(session.agentType);
  const cost = parseFloat(session.totalCost || "0");
  const costColor = cost > 1 ? colors.danger : cost > 0.1 ? colors.warning : "#22c55e";
  const isActive = session.status === "active";
  const totalK = ((session.totalTokens || 0) / 1000).toFixed(1);

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: isActive ? `${agent.color}30` : "#1a1a1e" }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Left accent bar */}
      <View style={[styles.cardAccent, { backgroundColor: isActive ? agent.color : "#222" }]} />

      <View style={styles.cardContent}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={[styles.logoSmall, { backgroundColor: `${agent.color}12` }]}>
            <Text style={[styles.logoSmallText, { color: agent.color }]}>{agent.logo}</Text>
          </View>
          <View style={styles.cardTitleArea}>
            <Text style={styles.cardName} numberOfLines={1}>{session.name}</Text>
            <Text style={[styles.cardAgent, { color: agent.color }]}>{agent.label}</Text>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: isActive ? "#22c55e10" : "#2a2a2a20",
          }]}>
            {isActive && <View style={styles.activeDot} />}
            <Text style={[styles.statusText, { color: isActive ? "#22c55e" : "#444" }]}>
              {session.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Bottom stats */}
        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatLabel}>TOKENS</Text>
            <Text style={styles.cardStatValue}>{totalK}K</Text>
          </View>
          <View style={styles.cardStatDivider} />
          <View style={styles.cardStat}>
            <Text style={styles.cardStatLabel}>COST</Text>
            <Text style={[styles.cardStatValue, { color: costColor }]}>${cost.toFixed(4)}</Text>
          </View>
          <View style={styles.cardStatDivider} />
          <View style={styles.cardStat}>
            <Text style={styles.cardStatLabel}>MODEL</Text>
            <Text style={styles.cardStatValue} numberOfLines={1}>{session.model?.split("-").slice(-2).join("-") || "—"}</Text>
          </View>
          <Text style={styles.cardArrow}>›</Text>
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
  const [filter, setFilter] = useState<"all" | "active" | "ended">("all");

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

  const filtered = sessions.filter((s) => {
    if (filter === "active") return s.status === "active";
    if (filter === "ended") return s.status !== "active";
    return true;
  });

  const activeCount = sessions.filter((s) => s.status === "active").length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AGENT SESSIONS</Text>
          <Text style={styles.headerSub}>
            {activeCount > 0 ? `${activeCount} ACTIVE` : "NO ACTIVE AGENTS"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push("/new-session")}
          activeOpacity={0.8}
        >
          <Text style={styles.newBtnText}>+ NEW</Text>
        </TouchableOpacity>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {(["all", "active", "ended"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.toUpperCase()}
              {f === "all" ? ` (${sessions.length})` : f === "active" ? ` (${activeCount})` : ` (${sessions.length - activeCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={colors.accent}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>◌</Text>
              <Text style={styles.emptyTitle}>No sessions</Text>
              <Text style={styles.emptySub}>Launch an agent to start tracking</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/new-session")}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>LAUNCH AGENT</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onPress={() => router.push(`/session/${s.id}`)}
              />
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c0c0e" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { color: "#e0e0e0", fontSize: 13, fontFamily: "monospace", fontWeight: "700", letterSpacing: 2 },
  headerSub: { color: "#333", fontSize: 9, fontFamily: "monospace", letterSpacing: 1.5, marginTop: 3 },

  newBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  newBtnText: { color: "#000", fontFamily: "monospace", fontSize: 11, fontWeight: "900", letterSpacing: 1 },

  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "#1e1e22",
  },
  filterPillActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}10` },
  filterText: { color: "#333", fontSize: 9, fontFamily: "monospace", letterSpacing: 1 },
  filterTextActive: { color: colors.accent },

  loadWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  list: { paddingHorizontal: spacing.md, gap: spacing.sm },

  card: {
    flexDirection: "row",
    backgroundColor: "#0e0e11",
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardAccent: { width: 3 },
  cardContent: { flex: 1, padding: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 10 },
  logoSmall: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  logoSmallText: { fontSize: 14, fontFamily: "monospace", fontWeight: "700" },
  cardTitleArea: { flex: 1 },
  cardName: { color: "#d0d0d0", fontSize: 13, fontFamily: "monospace", fontWeight: "700", marginBottom: 2 },
  cardAgent: { fontSize: 9, fontFamily: "monospace", letterSpacing: 1 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  activeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#22c55e" },
  statusText: { fontSize: 8, fontFamily: "monospace", fontWeight: "700", letterSpacing: 0.5 },

  cardStats: { flexDirection: "row", alignItems: "center", backgroundColor: "#0c0c0e", borderRadius: radius.sm, padding: 10 },
  cardStat: { flex: 1 },
  cardStatLabel: { color: "#2a2a2a", fontSize: 7, fontFamily: "monospace", letterSpacing: 1, marginBottom: 3 },
  cardStatValue: { color: "#555", fontSize: 11, fontFamily: "monospace", fontWeight: "700" },
  cardStatDivider: { width: 1, height: 24, backgroundColor: "#1a1a1e", marginHorizontal: spacing.sm },
  cardArrow: { color: "#333", fontSize: 20, fontFamily: "monospace", marginLeft: spacing.sm },

  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { color: "#1e1e22", fontSize: 60, marginBottom: spacing.md },
  emptyTitle: { color: "#444", fontFamily: "monospace", fontSize: 14, marginBottom: 6 },
  emptySub: { color: "#2a2a2a", fontFamily: "monospace", fontSize: 11, marginBottom: spacing.lg },
  emptyBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  emptyBtnText: { color: "#000", fontFamily: "monospace", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
});
