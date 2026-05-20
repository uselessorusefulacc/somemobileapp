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
const BG      = "#080808";
const SURFACE = "#111111";
const CARD    = "#141414";
const BORDER  = "#1f1f1f";
const LINE    = "#161616";
const TEXT    = "#ffffff";
const TEXT_2  = "#888";
const TEXT_3  = "#3a3a3a";
const GREEN   = "#22c55e";
const AMBER   = "#f59e0b";
const RED     = "#ef4444";
const PURPLE  = "#a78bfa";
const VIOLET  = "#7c3aed";

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
  if (v < 0.0001) return "$0.00";
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

// ── Hero stat ─────────────────────────────────────────────────────
function HeroStat({ value, label, isLive }: { value: string; label: string; isLive: boolean }) {
  return (
    <View style={h.heroWrap}>
      <View style={h.heroGlow} />
      <Text style={h.heroLabel}>{label}</Text>
      <Text style={[h.heroValue, isLive && { color: GREEN }]}>{value}</Text>
      {isLive && (
        <View style={h.liveRow}>
          <View style={[h.liveDot, {
            shadowColor: GREEN, shadowOpacity: 1, shadowRadius: 6,
          }]} />
          <Text style={h.liveText}>streaming live</Text>
        </View>
      )}
    </View>
  );
}

// ── Stat card ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent?: string; icon?: string;
}) {
  const color = accent || TEXT;
  return (
    <View style={[c.statCard, accent && {
      borderColor: accent + "25",
      shadowColor: accent,
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 4,
    }]}>
      {icon && <Text style={c.statIcon}>{icon}</Text>}
      <Text style={[c.statValue, { color }]}>{value}</Text>
      <Text style={c.statLabel}>{label}</Text>
      {sub && <Text style={[c.statSub, accent && { color: accent + "aa" }]}>{sub}</Text>}
    </View>
  );
}

// ── Session row ───────────────────────────────────────────────────
function SessionRow({ session, onPress }: { session: AgentSession; onPress: () => void }) {
  const agent = getAgent(session.agentType);
  const isActive = session.status === "active";
  const cost = parseFloat(session.totalCost || "0");

  return (
    <TouchableOpacity style={c.sessionRow} onPress={onPress} activeOpacity={0.55}>
      <View style={[c.statusDot, {
        backgroundColor: isActive ? GREEN : TEXT_3,
        shadowColor: isActive ? GREEN : "transparent",
        shadowOpacity: isActive ? 1 : 0,
        shadowRadius: isActive ? 5 : 0,
        elevation: isActive ? 3 : 0,
      }]} />
      <View style={{ flex: 1 }}>
        <Text style={c.sessionName} numberOfLines={1}>{session.name}</Text>
        <Text style={[c.sessionAgent, { color: agent.color }]}>{agent.label}</Text>
      </View>
      <Text style={[c.sessionCost, cost > 0.1 && { color: AMBER }]}>{formatCost(cost)}</Text>
      <Text style={c.sessionArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── Alert banner ──────────────────────────────────────────────────
function AlertBanner({ alerts }: { alerts: BudgetAlert[] }) {
  if (!alerts.length) return null;
  const a = alerts[0];
  const color = a.level === "critical" ? RED : AMBER;
  return (
    <View style={[c.alertBanner, {
      borderColor: color + "40",
      backgroundColor: color + "0a",
      shadowColor: color,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 4,
    }]}>
      <Text style={{ fontSize: 16 }}>{a.level === "critical" ? "🚨" : "⚠️"}</Text>
      <Text style={[c.alertText, { color }]}>{a.message}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────
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
        <ActivityIndicator color={PURPLE} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={c.root}
      contentContainerStyle={[c.content, { paddingTop: insets.top + 20 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadRest(true); }}
          tintColor={PURPLE}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Top bar ──────────────────────────────────── */}
      <View style={c.topBar}>
        <View>
          <Text style={c.greeting}>Overview</Text>
          <Text style={c.greetingSub}>AgentPilot</Text>
        </View>
        <View style={c.topBarRight}>
          <View style={[c.connectionChip, {
            borderColor: isLive ? GREEN + "50" : BORDER,
            backgroundColor: isLive ? GREEN + "0d" : SURFACE,
          }]}>
            <View style={[c.connectionDot, {
              backgroundColor: isLive ? GREEN : TEXT_3,
              shadowColor: isLive ? GREEN : "transparent",
              shadowOpacity: 1,
              shadowRadius: 5,
            }]} />
            <Text style={[c.connectionText, { color: isLive ? GREEN : TEXT_3 }]}>
              {isLive ? "Live" : "Idle"}
            </Text>
          </View>
          <TouchableOpacity
            style={[c.newBtn, {
              shadowColor: VIOLET,
              shadowOpacity: 0.6,
              shadowRadius: 12,
              elevation: 8,
            }]}
            onPress={() => router.push("/new-session")}
            activeOpacity={0.8}
          >
            <Text style={c.newBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AlertBanner alerts={alerts} />

      {/* ── Hero total spend ─────────────────────────── */}
      <HeroStat
        value={formatCost(totalCost)}
        label="Total spend"
        isLive={isLive}
      />

      {/* ── Stat cards row ───────────────────────────── */}
      <View style={c.statsRow}>
        <StatCard
          label="Sessions"
          value={String(sessions.length)}
          sub={activeSessions.length > 0 ? `${activeSessions.length} active` : undefined}
          accent={activeSessions.length > 0 ? GREEN : undefined}
          icon="⚡"
        />
        <StatCard
          label="Burn rate"
          value={`${burnRate > 0 ? burnRate.toFixed(0) : "—"}`}
          sub={burnRate > 0 ? "tok/min" : "not running"}
          accent={burnRate > 5000 ? AMBER : burnRate > 0 ? PURPLE : undefined}
          icon="🔥"
        />
        {hourlyProjection > 0 && (
          <StatCard
            label="Est/hour"
            value={`$${hourlyProjection.toFixed(2)}`}
            accent={hourlyProjection > 5 ? RED : hourlyProjection > 1 ? AMBER : GREEN}
            icon="📈"
          />
        )}
      </View>

      {/* ── Active sessions ──────────────────────────── */}
      {activeSessions.length > 0 && (
        <View style={c.section}>
          <View style={c.sectionHeader}>
            <View style={[c.sectionDot, {
              backgroundColor: GREEN,
              shadowColor: GREEN,
              shadowOpacity: 1,
              shadowRadius: 5,
            }]} />
            <Text style={c.sectionLabel}>Active now</Text>
          </View>
          <View style={[c.sectionCard, { borderColor: GREEN + "25" }]}>
            {activeSessions.map((s) => (
              <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
            ))}
          </View>
        </View>
      )}

      {/* ── Tips ─────────────────────────────────────── */}
      {tips.length > 0 && (
        <View style={c.section}>
          <View style={c.sectionHeader}>
            <Text style={c.sectionLabel}>Suggestions</Text>
          </View>
          {tips.map((tip, i) => {
            const color = tip.category === "urgent" ? RED : tip.category === "model" ? AMBER : PURPLE;
            return (
              <View key={i} style={[c.tipCard, {
                borderColor: color + "25",
                shadowColor: color,
                shadowOpacity: 0.15,
                shadowRadius: 8,
              }]}>
                <View style={[c.tipAccent, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={c.tipText}>{tip.message}</Text>
                  {tip.estimatedSaving && (
                    <Text style={[c.tipSaving, { color }]}>Save {tip.estimatedSaving}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Recent sessions ──────────────────────────── */}
      {sessions.length > 0 && (
        <View style={c.section}>
          <View style={c.sectionHeader}>
            <Text style={c.sectionLabel}>Recent</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/sessions")} activeOpacity={0.7}>
              <Text style={c.sectionAction}>See all →</Text>
            </TouchableOpacity>
          </View>
          <View style={c.sectionCard}>
            {sessions.slice(0, 5).map((s) => (
              <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
            ))}
          </View>
        </View>
      )}

      {/* ── Empty state ──────────────────────────────── */}
      {sessions.length === 0 && (
        <View style={c.empty}>
          <View style={c.emptyGlow} />
          <Text style={c.emptyIcon}>🚀</Text>
          <Text style={c.emptyTitle}>Launch your first agent</Text>
          <Text style={c.emptySub}>Track cost, tokens, and performance in real time</Text>
          <TouchableOpacity
            style={[c.emptyBtn, {
              shadowColor: VIOLET,
              shadowOpacity: 0.7,
              shadowRadius: 20,
              elevation: 10,
            }]}
            onPress={() => router.push("/new-session")}
            activeOpacity={0.8}
          >
            <Text style={c.emptyBtnText}>New Session</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={seedDemo} style={c.seedBtn} disabled={seeding}>
            {seeding
              ? <ActivityIndicator color={TEXT_3} size="small" />
              : <Text style={c.seedText}>Load demo data</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Hero styles ───────────────────────────────────────────────────
const h = StyleSheet.create({
  heroWrap: {
    alignItems: "center",
    paddingVertical: 32,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    position: "relative",
  },
  heroGlow: {
    position: "absolute",
    bottom: -20,
    left: "25%",
    right: "25%",
    height: 80,
    borderRadius: 40,
    backgroundColor: VIOLET + "20",
  },
  heroLabel: {
    color: TEXT_3,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  heroValue: {
    color: TEXT,
    fontSize: 52,
    fontWeight: "700",
    letterSpacing: -2,
    lineHeight: 60,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  liveText: { color: GREEN, fontSize: 12, fontWeight: "500" },
});

const CARD_DEF = "#141414";

const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  // Top bar
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: { color: TEXT, fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  greetingSub: { color: TEXT_3, fontSize: 12, marginTop: 2 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  connectionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  connectionDot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { fontSize: 12, fontWeight: "600" },
  newBtn: {
    backgroundColor: VIOLET,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Alert
  alertBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  alertText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "500" },

  // Stats
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  statCard: {
    flex: 1,
    backgroundColor: CARD_DEF,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "flex-start",
  },
  statIcon: { fontSize: 16, marginBottom: 8 },
  statValue: { color: TEXT, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  statLabel: { color: TEXT_3, fontSize: 10, fontWeight: "500", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  statSub: { color: TEXT_3, fontSize: 10, marginTop: 3 },

  // Sections
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionLabel: {
    color: TEXT_3,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    flex: 1,
  },
  sectionAction: { color: PURPLE, fontSize: 12, fontWeight: "500" },
  sectionCard: {
    backgroundColor: CARD_DEF,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },

  // Session rows
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  sessionName: { color: TEXT_2, fontSize: 13, marginBottom: 2, fontWeight: "500" },
  sessionAgent: { fontSize: 11, fontWeight: "500" },
  sessionCost: { color: TEXT_3, fontSize: 12, fontWeight: "500" },
  sessionArrow: { color: TEXT_3, fontSize: 18 },

  // Tips
  tipCard: {
    flexDirection: "row",
    backgroundColor: CARD_DEF,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    overflow: "hidden",
  },
  tipAccent: { width: 3, borderRadius: 2, marginRight: 12 },
  tipText: { color: TEXT_2, fontSize: 13, lineHeight: 19 },
  tipSaving: { fontSize: 11, marginTop: 5, fontWeight: "600" },

  // Empty
  empty: { alignItems: "center", paddingTop: 60, gap: 10, position: "relative" },
  emptyGlow: {
    position: "absolute",
    top: 0,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: VIOLET + "08",
  },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { color: TEXT, fontSize: 22, fontWeight: "700", letterSpacing: -0.5, textAlign: "center" },
  emptySub: { color: TEXT_3, fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    backgroundColor: VIOLET,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    marginTop: 8,
  },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  seedBtn: { marginTop: 4, paddingVertical: 8 },
  seedText: { color: TEXT_3, fontSize: 12 },
});


