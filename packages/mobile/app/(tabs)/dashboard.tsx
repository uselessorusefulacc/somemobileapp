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

// ── Design tokens ────────────────────────────────────────────────
const BG      = "#141414";
const SURFACE = "#1c1c1c";
const BORDER  = "#242424";
const LINE    = "#1e1e1e";
const TEXT    = "#f0f0f0";
const TEXT_2  = "#888";
const TEXT_3  = "#444";
const GREEN   = "#22c55e";
const AMBER   = "#f59e0b";
const RED     = "#ef4444";

const AGENT_META: Record<string, { color: string; label: string }> = {
  claude:   { color: "#D4A574", label: "Claude Code" },
  opencode: { color: "#818CF8", label: "OpenCode" },
  codex:    { color: "#10A37F", label: "Codex CLI" },
  gemini:   { color: "#4285F4", label: "Gemini CLI" },
  aider:    { color: "#22c55e", label: "Aider" },
  copilot:  { color: "#a78bfa", label: "GitHub Copilot" },
  cline:    { color: "#fb923c", label: "Cline" },
};

function getAgent(type: string) {
  return AGENT_META[type] ?? { color: TEXT_3, label: type };
}

function formatCost(v: number) {
  if (v < 0.0001) return "<$0.0001";
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Stat card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <View style={c.statCard}>
      <Text style={c.statLabel}>{label}</Text>
      <Text style={[c.statValue, accent && { color: accent }]}>{value}</Text>
      {sub && <Text style={c.statSub}>{sub}</Text>}
    </View>
  );
}

// ── Session row ──────────────────────────────────────────────────
function SessionRow({ session, onPress }: { session: AgentSession; onPress: () => void }) {
  const agent = getAgent(session.agentType);
  const isActive = session.status === "active";
  const cost = parseFloat(session.totalCost || "0");

  return (
    <TouchableOpacity style={c.sessionRow} onPress={onPress} activeOpacity={0.6}>
      <View style={[c.statusDot, { backgroundColor: isActive ? GREEN : "#222" }]} />
      <View style={{ flex: 1 }}>
        <Text style={c.sessionName} numberOfLines={1}>{session.name}</Text>
        <Text style={[c.sessionAgent, { color: agent.color }]}>{agent.label}</Text>
      </View>
      <Text style={c.sessionCost}>{formatCost(cost)}</Text>
      <Text style={c.sessionArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── Alert banner ─────────────────────────────────────────────────
function AlertBanner({ alerts }: { alerts: BudgetAlert[] }) {
  if (!alerts.length) return null;
  const a = alerts[0];
  const color = a.level === "critical" ? RED : AMBER;
  return (
    <View style={[c.alertBanner, { borderColor: color + "44" }]}>
      <View style={[c.alertDot, { backgroundColor: color }]} />
      <Text style={[c.alertText, { color }]}>{a.message}</Text>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────
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
    } catch (e) { console.error("[dashboard]", e); }
    finally { setLoading(false); setRefreshing(false); }
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
    const iv = setInterval(() => loadRest(true), 12000);
    return () => clearInterval(iv);
  }, [loadRest]);

  useFocusEffect(useCallback(() => { loadRest(false); }, [loadRest]));

  const { burnRate, hourlyProjection, tips } = useLiveAnalytics(recentEvents);
  const activeSessions = sessions.filter((s) => s.status === "active");
  const totalRestCost = sessions.reduce((acc, s) => acc + parseFloat(s.totalCost || "0"), 0);
  const totalCost = liveCost > 0 ? liveCost : totalRestCost;
  const isLive = relay.isConnected && agentConnected;

  const seedDemo = async () => {
    setSeeding(true);
    try { await apiClient.seedDemo(); await loadRest(true); }
    catch { Alert.alert("Error", "Could not seed demo data."); }
    finally { setSeeding(false); }
  };

  if (loading) {
    return (
      <View style={[c.root, c.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#555" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={c.root}
      contentContainerStyle={[c.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRest(true); }} tintColor="#444" />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <View style={c.header}>
        <View>
          <Text style={c.headerTitle}>Overview</Text>
          <Text style={c.headerSub}>AgentPilot</Text>
        </View>
        <View style={c.headerRight}>
          <View style={[c.livePill, { backgroundColor: isLive ? GREEN + "14" : "#1e1e1e" }]}>
            <View style={[c.liveDot, { backgroundColor: isLive ? GREEN : TEXT_3 }]} />
            <Text style={[c.livePillText, { color: isLive ? GREEN : TEXT_3 }]}>
              {isLive ? "Live" : "Offline"}
            </Text>
          </View>
          <TouchableOpacity style={c.newBtn} onPress={() => router.push("/new-session")} activeOpacity={0.8}>
            <Text style={c.newBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AlertBanner alerts={alerts} />

      {/* ── Stats ───────────────────────────────────────── */}
      <View style={c.statsRow}>
        <StatCard label="Total spend" value={formatCost(totalCost)} />
        <StatCard label="Sessions" value={String(sessions.length)} sub={`${activeSessions.length} active`} />
        <StatCard
          label="Burn rate"
          value={`${burnRate.toFixed(0)}`}
          sub="tok/min"
          accent={burnRate > 5000 ? AMBER : undefined}
        />
      </View>

      {/* Hourly projection */}
      {hourlyProjection > 0 && (
        <View style={c.projCard}>
          <Text style={c.projLabel}>Hourly estimate</Text>
          <Text style={[c.projValue, {
            color: hourlyProjection > 5 ? RED : hourlyProjection > 1 ? AMBER : GREEN
          }]}>
            ${hourlyProjection.toFixed(2)}/hr
          </Text>
        </View>
      )}

      {/* ── Active sessions ─────────────────────────────── */}
      {activeSessions.length > 0 && (
        <View style={c.section}>
          <Text style={c.sectionLabel}>Active</Text>
          {activeSessions.map((s) => (
            <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
          ))}
        </View>
      )}

      {/* ── Tips ────────────────────────────────────────── */}
      {tips.length > 0 && (
        <View style={c.section}>
          <Text style={c.sectionLabel}>Suggestions</Text>
          {tips.map((tip, i) => {
            const color = tip.category === "urgent" ? RED : tip.category === "model" ? AMBER : "#f59e0b";
            return (
              <View key={i} style={[c.tipRow, { borderLeftColor: color }]}>
                <Text style={c.tipText}>{tip.message}</Text>
                {tip.estimatedSaving && <Text style={[c.tipSaving, { color }]}>Save {tip.estimatedSaving}</Text>}
              </View>
            );
          })}
        </View>
      )}

      {/* ── Recent sessions ─────────────────────────────── */}
      {sessions.length > 0 && (
        <View style={c.section}>
          <View style={c.sectionHeader}>
            <Text style={c.sectionLabel}>Recent</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/sessions")} activeOpacity={0.7}>
              <Text style={c.sectionAction}>See all</Text>
            </TouchableOpacity>
          </View>
          {sessions.slice(0, 5).map((s) => (
            <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
          ))}
        </View>
      )}

      {/* ── Empty state ─────────────────────────────────── */}
      {sessions.length === 0 && (
        <View style={c.empty}>
          <Text style={c.emptyTitle}>No sessions yet</Text>
          <Text style={c.emptySub}>Launch an agent to start tracking costs</Text>
          <TouchableOpacity style={c.emptyBtn} onPress={() => router.push("/new-session")} activeOpacity={0.8}>
            <Text style={c.emptyBtnText}>New Session</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={seedDemo} style={c.seedBtn} disabled={seeding}>
            {seeding
              ? <ActivityIndicator color="#555" size="small" />
              : <Text style={c.seedText}>Load demo data</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingBottom: 32 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  headerTitle: { color: TEXT, fontSize: 22, fontWeight: "600" },
  headerSub: { color: TEXT_3, fontSize: 12, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  livePillText: { fontSize: 12, fontWeight: "500" },
  newBtn: { backgroundColor: TEXT, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  newBtnText: { color: "#000", fontSize: 13, fontWeight: "600" },

  // Alert
  alertBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderWidth: 1, backgroundColor: SURFACE,
    borderRadius: 10, padding: 12, marginBottom: 16,
  },
  alertDot: { width: 7, height: 7, borderRadius: 4, marginTop: 3 },
  alertText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Stats
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  statCard: { flex: 1, backgroundColor: SURFACE, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER },
  statLabel: { color: TEXT_3, fontSize: 11, marginBottom: 6 },
  statValue: { color: TEXT, fontSize: 18, fontWeight: "600" },
  statSub: { color: TEXT_3, fontSize: 10, marginTop: 3 },

  // Projection
  projCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: SURFACE, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 10, borderWidth: 1, borderColor: BORDER,
  },
  projLabel: { color: TEXT_2, fontSize: 13 },
  projValue: { fontSize: 14, fontWeight: "600" },

  // Sections
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionLabel: { color: TEXT_3, fontSize: 11, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  sectionAction: { color: TEXT_3, fontSize: 12 },

  // Session rows
  sessionRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: LINE,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  sessionName: { color: TEXT_2, fontSize: 13, marginBottom: 2 },
  sessionAgent: { fontSize: 11 },
  sessionCost: { color: TEXT_3, fontSize: 12 },
  sessionArrow: { color: TEXT_3, fontSize: 18 },

  // Tips
  tipRow: { borderLeftWidth: 2, paddingLeft: 12, paddingVertical: 8, marginBottom: 6 },
  tipText: { color: TEXT_2, fontSize: 13, lineHeight: 18 },
  tipSaving: { fontSize: 11, marginTop: 4 },

  // Empty
  empty: { alignItems: "center", paddingTop: 64, gap: 10 },
  emptyTitle: { color: TEXT_2, fontSize: 18, fontWeight: "500" },
  emptySub: { color: TEXT_3, fontSize: 13, textAlign: "center" },
  emptyBtn: { backgroundColor: TEXT, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, marginTop: 8 },
  emptyBtnText: { color: "#000", fontSize: 14, fontWeight: "600" },
  seedBtn: { marginTop: 8, paddingVertical: 8 },
  seedText: { color: TEXT_3, fontSize: 12 },
});
