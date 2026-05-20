import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "../../lib/theme";
import { apiClient, type AgentSession, type BudgetAlert } from "../../lib/api";
import { useRelay } from "../../lib/relay-context";
import type { TokenPayload } from "../../lib/relay";
import { useLiveAnalytics } from "../../hooks/use-live-analytics";

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

function formatCost(v: number) {
  if (v < 0.0001) return "<$0.0001";
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function LiveDot({ active }: { active: boolean }) {
  return (
    <View style={[styles.liveDot, { backgroundColor: active ? "#22c55e" : "#333" }]} />
  );
}

function AlertBanner({ alerts }: { alerts: BudgetAlert[] }) {
  if (!alerts.length) return null;
  const a = alerts[0];
  const c = a.level === "critical" ? colors.danger : colors.warning;
  return (
    <View style={[styles.alertBanner, { backgroundColor: `${c}10`, borderColor: `${c}25` }]}>
      <Text style={[styles.alertText, { color: c }]}>
        {a.level === "critical" ? "⛔" : "⚠"} {a.message}
      </Text>
    </View>
  );
}

function ActiveSessionPill({ session }: { session: AgentSession }) {
  const router = useRouter();
  const agent = getAgent(session.agentType);
  const cost = parseFloat(session.totalCost || "0");
  return (
    <TouchableOpacity
      style={[styles.activePill, { borderColor: `${agent.color}30` }]}
      onPress={() => router.push(`/session/${session.id}`)}
      activeOpacity={0.8}
    >
      <View style={[styles.activePillLogo, { backgroundColor: `${agent.color}15` }]}>
        <Text style={[styles.activePillLogoText, { color: agent.color }]}>{agent.logo}</Text>
      </View>
      <View style={styles.activePillInfo}>
        <Text style={styles.activePillName} numberOfLines={1}>{session.name}</Text>
        <Text style={[styles.activePillAgent, { color: agent.color }]}>{agent.label}</Text>
      </View>
      <View style={styles.activePillRight}>
        <Text style={styles.activePillCost}>{formatCost(cost)}</Text>
        <Text style={styles.activePillArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const relay = useRelay();

  const [liveCost, setLiveCost] = useState(0);
  const [liveTokens, setLiveTokens] = useState(0);
  const [recentEvents, setRecentEvents] = useState<TokenPayload[]>([]);
  const [agentConnected, setAgentConnected] = useState(false);

  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadRest = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, a] = await Promise.all([apiClient.getSessions(), apiClient.getAlerts()]);
      setSessions(s.sessions || []);
      setAlerts(a.alerts || []);
    } catch (e) {
      console.error("[dashboard]", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!relay.client) return;
    const onTokens = (p: TokenPayload) => {
      setLiveCost((c) => c + p.costUsd);
      setLiveTokens((t) => t + p.inputTokens + p.outputTokens);
      setRecentEvents((ev) => [...ev, p].slice(-60));
    };
    relay.client.on("tokens", onTokens);
    relay.client.on("peer_connected", () => setAgentConnected(true));
    relay.client.on("peer_disconnected", () => setAgentConnected(false));
    return () => {
      relay.client?.off("tokens", onTokens);
    };
  }, [relay.client]);

  useEffect(() => {
    const interval = setInterval(() => loadRest(true), 12000);
    return () => clearInterval(interval);
  }, [loadRest]);

  useFocusEffect(useCallback(() => { loadRest(false); }, [loadRest]));

  const { burnRate, hourlyProjection, tips } = useLiveAnalytics(recentEvents);

  const activeSessions = sessions.filter((s) => s.status === "active");
  const totalRestCost = sessions.reduce((acc, s) => acc + parseFloat(s.totalCost || "0"), 0);
  const totalCost = liveCost > 0 ? liveCost : totalRestCost;

  const seedDemo = async () => {
    setSeeding(true);
    try {
      await apiClient.seedDemo();
      await loadRest(true);
    } catch {
      Alert.alert("Error", "Could not seed demo data.");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const costDollars = Math.floor(totalCost);
  const costCents = (totalCost - costDollars).toFixed(4).slice(1);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadRest(true); }}
          tintColor={colors.accent}
        />
      }
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>AgentPilot</Text>
          <Text style={styles.brandSub}>AGENTIC CLI MONITOR</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.connPill, { backgroundColor: (relay.isConnected && agentConnected) ? "#22c55e10" : "#33333310" }]}>
            <LiveDot active={relay.isConnected && agentConnected} />
            <Text style={[styles.connText, { color: (relay.isConnected && agentConnected) ? "#22c55e" : "#444" }]}>
              {(relay.isConnected && agentConnected) ? "LIVE" : "POLLING"}
            </Text>
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={() => router.push("/new-session")} activeOpacity={0.8}>
            <Text style={styles.newBtnText}>+ NEW</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AlertBanner alerts={alerts} />

      {/* ── Hero cost ── */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>TOTAL SPEND</Text>
        <View style={styles.heroAmountRow}>
          <Text style={styles.heroCurrency}>$</Text>
          <Text style={styles.heroDollars}>{costDollars}</Text>
          <Text style={styles.heroCents}>{costCents}</Text>
        </View>
        <View style={styles.heroGlow} />
      </View>

      {/* ── Metrics row ── */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>BURN RATE</Text>
          <Text style={styles.metricValue}>{burnRate.toFixed(0)}</Text>
          <Text style={styles.metricUnit}>tok / min</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>HOURLY EST</Text>
          <Text style={[styles.metricValue, {
            color: hourlyProjection > 5 ? colors.danger : hourlyProjection > 1 ? colors.warning : "#22c55e"
          }]}>${hourlyProjection.toFixed(2)}</Text>
          <Text style={styles.metricUnit}>/ hr</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>SESSIONS</Text>
          <Text style={styles.metricValue}>{sessions.length}</Text>
          <Text style={styles.metricUnit}>{activeSessions.length} active</Text>
        </View>
      </View>

      {/* ── Active agents ── */}
      {activeSessions.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>ACTIVE AGENTS</Text>
            <View style={styles.sectionBadge}>
              <LiveDot active />
              <Text style={styles.sectionBadgeText}>{activeSessions.length} RUNNING</Text>
            </View>
          </View>
          {activeSessions.map((s) => (
            <ActiveSessionPill key={s.id} session={s} />
          ))}
        </>
      )}

      {/* ── Optimization tips ── */}
      {tips.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>OPTIMIZATION TIPS</Text>
          {tips.map((tip, i) => {
            const c = tip.category === "urgent" ? colors.danger : tip.category === "model" ? colors.accent : colors.warning;
            return (
              <View key={i} style={[styles.tipCard, { borderLeftColor: c }]}>
                <Text style={[styles.tipCategory, { color: c }]}>{tip.category?.toUpperCase()}</Text>
                <Text style={styles.tipText}>{tip.message}</Text>
                {tip.estimatedSaving && <Text style={[styles.tipSaving, { color: c }]}>Save {tip.estimatedSaving}</Text>}
              </View>
            );
          })}
        </>
      )}

      {/* ── Recent sessions ── */}
      {sessions.length > 0 && (
        <>
          <View style={[styles.sectionRow, { marginTop: spacing.lg }]}>
            <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/sessions")}>
              <Text style={styles.seeAll}>SEE ALL →</Text>
            </TouchableOpacity>
          </View>
          {sessions.slice(0, 3).map((s) => {
            const agent = getAgent(s.agentType);
            const cost = parseFloat(s.totalCost || "0");
            const isActive = s.status === "active";
            return (
              <TouchableOpacity
                key={s.id}
                style={styles.recentRow}
                onPress={() => router.push(`/session/${s.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.recentDot, { backgroundColor: isActive ? agent.color : "#222" }]} />
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName} numberOfLines={1}>{s.name}</Text>
                  <Text style={[styles.recentAgent, { color: agent.color }]}>{agent.label}</Text>
                </View>
                <Text style={styles.recentCost}>{formatCost(cost)}</Text>
                <Text style={styles.recentArrow}>›</Text>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* ── Empty state / seed ── */}
      {sessions.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>◌</Text>
          <Text style={styles.emptyTitle}>No agent sessions</Text>
          <Text style={styles.emptySub}>Launch your first agentic CLI session</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/new-session")} activeOpacity={0.8}>
            <Text style={styles.emptyBtnText}>LAUNCH AGENT</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={seedDemo} style={styles.seedBtn} disabled={seeding}>
            {seeding ? <ActivityIndicator color="#333" size="small" /> : <Text style={styles.seedText}>Load Demo Data</Text>}
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c0c0e" },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: spacing.md, paddingBottom: 32 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  brand: { color: "#e0e0e0", fontSize: 18, fontFamily: "monospace", fontWeight: "900", letterSpacing: 1 },
  brandSub: { color: "#2a2a2a", fontSize: 8, fontFamily: "monospace", letterSpacing: 3, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  connPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  connText: { fontSize: 9, fontFamily: "monospace", fontWeight: "700", letterSpacing: 1 },
  newBtn: { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm },
  newBtnText: { color: "#000", fontFamily: "monospace", fontSize: 11, fontWeight: "900", letterSpacing: 1 },

  // Alert
  alertBanner: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  alertText: { fontFamily: "monospace", fontSize: 11 },

  // Hero cost
  heroCard: {
    backgroundColor: "#0e0e11",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.accent}20`,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  heroLabel: { color: "#333", fontSize: 9, fontFamily: "monospace", letterSpacing: 3, marginBottom: spacing.sm },
  heroAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  heroCurrency: { color: colors.accent, fontSize: 24, fontFamily: "monospace", fontWeight: "700", marginBottom: 4 },
  heroDollars: { color: "#e0e0e0", fontSize: 52, fontFamily: "monospace", fontWeight: "900", lineHeight: 56 },
  heroCents: { color: "#555", fontSize: 24, fontFamily: "monospace", fontWeight: "700", marginBottom: 4 },
  heroGlow: {
    position: "absolute",
    bottom: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${colors.accent}06`,
  },

  // Metrics
  metricsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  metricCard: {
    flex: 1,
    backgroundColor: "#0e0e11",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#1a1a1e",
    padding: spacing.md,
    alignItems: "center",
  },
  metricLabel: { color: "#2a2a2a", fontSize: 7, fontFamily: "monospace", letterSpacing: 1.5, marginBottom: 6 },
  metricValue: { color: "#aaa", fontSize: 18, fontFamily: "monospace", fontWeight: "700" },
  metricUnit: { color: "#2a2a2a", fontSize: 8, fontFamily: "monospace", marginTop: 3 },

  // Sections
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sectionTitle: { color: "#333", fontSize: 9, fontFamily: "monospace", letterSpacing: 2 },
  sectionBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  sectionBadgeText: { color: "#22c55e", fontSize: 8, fontFamily: "monospace", letterSpacing: 1 },
  seeAll: { color: colors.accent, fontSize: 9, fontFamily: "monospace", letterSpacing: 1 },

  // Active agents
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0e0e11",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  activePillLogo: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  activePillLogoText: { fontSize: 16, fontFamily: "monospace", fontWeight: "700" },
  activePillInfo: { flex: 1 },
  activePillName: { color: "#d0d0d0", fontSize: 13, fontFamily: "monospace", fontWeight: "700", marginBottom: 2 },
  activePillAgent: { fontSize: 9, fontFamily: "monospace", letterSpacing: 1 },
  activePillRight: { alignItems: "flex-end", gap: 4 },
  activePillCost: { color: "#555", fontSize: 12, fontFamily: "monospace", fontWeight: "700" },
  activePillArrow: { color: "#333", fontSize: 18 },

  // Tips
  tipCard: {
    backgroundColor: "#0e0e11",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "#1a1a1e",
    borderLeftWidth: 3,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  tipCategory: { fontSize: 8, fontFamily: "monospace", letterSpacing: 1.5, marginBottom: 4 },
  tipText: { color: "#555", fontSize: 12, fontFamily: "monospace", lineHeight: 18 },
  tipSaving: { fontSize: 10, fontFamily: "monospace", marginTop: 4 },

  // Recent rows
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#111114",
    gap: spacing.sm,
  },
  recentDot: { width: 6, height: 6, borderRadius: 3 },
  recentInfo: { flex: 1 },
  recentName: { color: "#666", fontSize: 12, fontFamily: "monospace", fontWeight: "700", marginBottom: 2 },
  recentAgent: { fontSize: 9, fontFamily: "monospace", letterSpacing: 1 },
  recentCost: { color: "#444", fontSize: 11, fontFamily: "monospace" },
  recentArrow: { color: "#2a2a2a", fontSize: 18 },

  // Empty
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { color: "#1a1a1e", fontSize: 64, marginBottom: spacing.md },
  emptyTitle: { color: "#444", fontFamily: "monospace", fontSize: 16, marginBottom: 6 },
  emptySub: { color: "#2a2a2a", fontFamily: "monospace", fontSize: 11, marginBottom: spacing.lg, textAlign: "center" },
  emptyBtn: { backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.sm, marginBottom: spacing.md },
  emptyBtnText: { color: "#000", fontFamily: "monospace", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  seedBtn: { paddingVertical: 8 },
  seedText: { color: "#333", fontFamily: "monospace", fontSize: 11 },
});
