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
import { apiClient, type AgentSession, type BudgetAlert } from "../../lib/api";
import { useRelay } from "../../lib/relay-context";
import type { TokenPayload } from "../../lib/relay";
import { useLiveAnalytics } from "../../hooks/use-live-analytics";

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

function formatCost(v: number) {
  if (v < 0.0001) return "<$0.0001";
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SessionRow({ session, onPress }: { session: AgentSession; onPress: () => void }) {
  const agent = getAgent(session.agentType);
  const isActive = session.status === "active";
  const cost = parseFloat(session.totalCost || "0");

  return (
    <TouchableOpacity style={styles.sessionRow} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.sessionRowLeft}>
        <View style={[styles.sessionDot, { backgroundColor: isActive ? "#22c55e" : "#2a2a2a" }]} />
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>
          <Text style={[styles.sessionAgent, { color: agent.color }]}>{agent.label}</Text>
        </View>
      </View>
      <View style={styles.sessionRowRight}>
        <Text style={styles.sessionCost}>{formatCost(cost)}</Text>
        <Text style={styles.sessionArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function AlertBanner({ alerts }: { alerts: BudgetAlert[] }) {
  if (!alerts.length) return null;
  const a = alerts[0];
  const c = a.level === "critical" ? "#ef4444" : "#f59e0b";
  return (
    <View style={[styles.alertBanner, { borderLeftColor: c }]}>
      <Text style={[styles.alertText, { color: c }]}>{a.message}</Text>
    </View>
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
    return () => { relay.client?.off("tokens", onTokens); };
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
  const isLive = relay.isConnected && agentConnected;

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
        <ActivityIndicator color="#888" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadRest(true); }}
          tintColor="#555"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Overview</Text>
          <Text style={styles.headerSub}>AgentPilot</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusPill, { backgroundColor: isLive ? "#22c55e18" : "#25252520" }]}>
            <View style={[styles.statusDot, { backgroundColor: isLive ? "#22c55e" : "#333" }]} />
            <Text style={[styles.statusText, { color: isLive ? "#22c55e" : "#555" }]}>
              {isLive ? "Live" : "Offline"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push("/new-session")}
            activeOpacity={0.8}
          >
            <Text style={styles.newBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AlertBanner alerts={alerts} />

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Spend</Text>
          <Text style={styles.statValue}>{formatCost(totalCost)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Sessions</Text>
          <Text style={styles.statValue}>{sessions.length}</Text>
          <Text style={styles.statSub}>{activeSessions.length} active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Burn Rate</Text>
          <Text style={styles.statValue}>{burnRate.toFixed(0)}</Text>
          <Text style={styles.statSub}>tok/min</Text>
        </View>
      </View>

      {/* Hourly projection */}
      {hourlyProjection > 0 && (
        <View style={styles.projRow}>
          <Text style={styles.projLabel}>Hourly estimate</Text>
          <Text style={[styles.projValue, {
            color: hourlyProjection > 5 ? "#ef4444" : hourlyProjection > 1 ? "#f59e0b" : "#22c55e"
          }]}>
            ${hourlyProjection.toFixed(2)}/hr
          </Text>
        </View>
      )}

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Active" />
          {activeSessions.map((s) => (
            <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
          ))}
        </View>
      )}

      {/* Tips */}
      {tips.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Suggestions" />
          {tips.map((tip, i) => {
            const c = tip.category === "urgent" ? "#ef4444" : tip.category === "model" ? "#f97316" : "#f59e0b";
            return (
              <View key={i} style={[styles.tipRow, { borderLeftColor: c }]}>
                <Text style={styles.tipText}>{tip.message}</Text>
                {tip.estimatedSaving && (
                  <Text style={[styles.tipSaving, { color: c }]}>Save {tip.estimatedSaving}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title="Recent"
            action="See all"
            onAction={() => router.push("/(tabs)/sessions")}
          />
          {sessions.slice(0, 5).map((s) => (
            <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
          ))}
        </View>
      )}

      {/* Empty state */}
      {sessions.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>Launch an agent to start tracking costs</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/new-session")} activeOpacity={0.8}>
            <Text style={styles.emptyBtnText}>New Session</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={seedDemo} style={styles.seedBtn} disabled={seeding}>
            {seeding
              ? <ActivityIndicator color="#555" size="small" />
              : <Text style={styles.seedText}>Load demo data</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#141414" },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingBottom: 32 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: { color: "#e8e8e8", fontSize: 22, fontWeight: "600" },
  headerSub: { color: "#444", fontSize: 12, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "500" },
  newBtn: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  newBtnText: { color: "#000", fontSize: 13, fontWeight: "600" },

  // Alert
  alertBanner: {
    borderLeftWidth: 3,
    backgroundColor: "#1e1e1e",
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  alertText: { fontSize: 13, lineHeight: 18 },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1c1c1c",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#252525",
  },
  statLabel: { color: "#555", fontSize: 11, marginBottom: 6 },
  statValue: { color: "#e0e0e0", fontSize: 18, fontWeight: "600" },
  statSub: { color: "#444", fontSize: 10, marginTop: 3 },

  // Projection
  projRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1c1c1c",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#252525",
  },
  projLabel: { color: "#666", fontSize: 13 },
  projValue: { fontSize: 14, fontWeight: "600" },

  // Sections
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: { color: "#666", fontSize: 12, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  sectionAction: { color: "#555", fontSize: 12 },

  // Session rows
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
  },
  sessionRowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  sessionDot: { width: 7, height: 7, borderRadius: 4 },
  sessionInfo: { flex: 1 },
  sessionName: { color: "#c8c8c8", fontSize: 13, fontWeight: "400", marginBottom: 2 },
  sessionAgent: { fontSize: 11 },
  sessionRowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  sessionCost: { color: "#555", fontSize: 12 },
  sessionArrow: { color: "#333", fontSize: 18 },

  // Tips
  tipRow: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  tipText: { color: "#777", fontSize: 13, lineHeight: 18 },
  tipSaving: { fontSize: 11, marginTop: 4 },

  // Empty
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { color: "#666", fontSize: 18, fontWeight: "500" },
  emptySub: { color: "#444", fontSize: 13, textAlign: "center" },
  emptyBtn: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  emptyBtnText: { color: "#000", fontSize: 14, fontWeight: "600" },
  seedBtn: { marginTop: 8, paddingVertical: 8 },
  seedText: { color: "#444", fontSize: 12 },
});
