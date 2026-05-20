import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radius } from "../../lib/theme";
import { apiClient, type AgentSession, type BudgetAlert } from "../../lib/api";
import { useRelay } from "../../lib/relay-context";
import type { TokenPayload } from "../../lib/relay";
import { useLiveAnalytics } from "../../hooks/use-live-analytics";

const { width: SCREEN_W } = Dimensions.get("window");

function GlowCard({ children, style, glowColor = colors.accentGlow }: { children: React.ReactNode; style?: any; glowColor?: string }) {
  return (
    <View style={[styles.cardBase, { shadowColor: glowColor }, style]}>
      {children}
    </View>
  );
}

function LiveCostMeter({ value }: { value: number }) {
  const dollars = Math.floor(value);
  const cents = (value - dollars).toFixed(4).slice(2);
  return (
    <GlowCard style={styles.costCard} glowColor={colors.accentGlowStrong}>
      <Text style={styles.costLabel}>TOTAL SPEND</Text>
      <View style={styles.costRow}>
        <Text style={styles.costCurrency}>$</Text>
        <Text style={styles.costDollars}>{dollars}</Text>
        <Text style={styles.costCents}>.{cents}</Text>
      </View>
      <View style={styles.costGlowLine} />
    </GlowCard>
  );
}

function BurnRateBadge({ rate }: { rate: number }) {
  return (
    <GlowCard style={styles.burnCard} glowColor={colors.secondaryGlow}>
      <Text style={styles.metricLabel}>BURN RATE</Text>
      <Text style={styles.metricValue}>{rate.toFixed(0)}</Text>
      <Text style={styles.metricUnit}>tok/min</Text>
    </GlowCard>
  );
}

function ProjectionBadge({ hourly }: { hourly: number }) {
  const color = hourly > 5 ? colors.danger : hourly > 1 ? colors.warning : colors.success;
  return (
    <GlowCard style={styles.projectionCard} glowColor={`${color}20`}>
      <Text style={styles.metricLabel}>HOURLY PROJECTION</Text>
      <Text style={[styles.metricValue, { color }]}>${hourly.toFixed(2)}</Text>
      <Text style={styles.metricUnit}>estimated / hr</Text>
    </GlowCard>
  );
}

function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <View style={[styles.pill, { backgroundColor: connected ? `${colors.success}15` : `${colors.danger}15` }]}>
      <View style={[styles.pillDot, { backgroundColor: connected ? colors.success : colors.danger }]} />
      <Text style={[styles.pillText, { color: connected ? colors.success : colors.danger }]}>
        {connected ? "LIVE" : "OFFLINE"}
      </Text>
    </View>
  );
}

function SessionRow({ session, onPress }: { session: AgentSession; onPress: () => void }) {
  const agentColor =
    session.agentType === "claude"
      ? colors.agentClaude
      : session.agentType === "opencode"
      ? colors.agentOpencode
      : colors.agentCodex;
  const statusColor =
    session.status === "active" ? colors.success : session.status === "error" ? colors.danger : colors.textMuted;

  return (
    <TouchableOpacity style={styles.sessionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.sessionAccent, { backgroundColor: agentColor }]} />
      <View style={styles.sessionBody}>
        <View style={styles.sessionTop}>
          <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}12` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{session.status}</Text>
          </View>
        </View>
        <Text style={styles.sessionMeta}>{session.model}</Text>
        <View style={styles.sessionBottom}>
          <Text style={styles.sessionTokens}>{(session.totalTokens || 0).toLocaleString()} tokens</Text>
          <Text style={styles.sessionCost}>{formatCost(parseFloat(session.totalCost || "0"))}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function TipCard({ tip }: { tip: { category: string; message: string; estimatedSaving?: string } }) {
  const borderColor = tip.category === "urgent" ? colors.danger : tip.category === "model" ? colors.accent : colors.warning;
  return (
    <View style={[styles.tipCard, { borderLeftColor: borderColor }]}>
      <Text style={styles.tipText}>{tip.message}</Text>
      {tip.estimatedSaving && <Text style={styles.tipSaving}>Save {tip.estimatedSaving}</Text>}
    </View>
  );
}

function BudgetAlertStrip({ alerts }: { alerts: BudgetAlert[] }) {
  if (!alerts.length) return null;
  const top = alerts[0];
  const bg = top.level === "critical" ? `${colors.danger}12` : `${colors.warning}12`;
  const textColor = top.level === "critical" ? colors.danger : colors.warning;
  return (
    <View style={[styles.alertStrip, { backgroundColor: bg }]}>
      <Text style={[styles.alertText, { color: textColor }]}>{top.level === "critical" ? "⛔" : "⚠️"} {top.message}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const relay = useRelay();

  // Live state
  const [liveCost, setLiveCost] = useState(0);
  const [liveTokens, setLiveTokens] = useState(0);
  const [recentEvents, setRecentEvents] = useState<TokenPayload[]>([]);
  const [isAgentConnected, setIsAgentConnected] = useState(false);

  // Fallback REST state
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadFromRest = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sessionsData, alertsData] = await Promise.all([
        apiClient.getSessions(),
        apiClient.getAlerts(),
      ]);
      setSessions(sessionsData.sessions || []);
      setAlerts(alertsData.alerts || []);
    } catch (e) {
      console.error("load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // WebSocket listeners
  useEffect(() => {
    if (!relay.client) return;
    const onTokens = (payload: TokenPayload) => {
      setLiveCost((prev) => prev + payload.costUsd);
      setLiveTokens((prev) => prev + payload.inputTokens + payload.outputTokens);
      setRecentEvents((prev) => [...prev, payload].slice(-60));
    };
    const onPeerConnected = () => setIsAgentConnected(true);
    const onPeerDisconnected = () => setIsAgentConnected(false);
    relay.client.on("tokens", onTokens);
    relay.client.on("peer_connected", onPeerConnected);
    relay.client.on("peer_disconnected", onPeerDisconnected);
    return () => {
      relay.client?.off("tokens", onTokens);
      relay.client?.off("peer_connected", onPeerConnected);
      relay.client?.off("peer_disconnected", onPeerDisconnected);
    };
  }, [relay.client]);

  // Fallback polling
  useEffect(() => {
    if (relay.isConnected && isAgentConnected) return;
    const interval = setInterval(() => loadFromRest(true), 10000);
    return () => clearInterval(interval);
  }, [relay.isConnected, isAgentConnected, loadFromRest]);

  useFocusEffect(useCallback(() => { loadFromRest(false); }, [loadFromRest]));

  const { burnRate, hourlyProjection, tips } = useLiveAnalytics(recentEvents);
  const activeSessions = sessions.filter((s) => s.status === "active");

  const seedDemo = async () => {
    setSeeding(true);
    try {
      await apiClient.seedDemo();
      await loadFromRest(true);
      Alert.alert("Demo Loaded", "Realistic agent session data seeded.");
    } catch (e) {
      Alert.alert("Error", "Failed to seed demo data.");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFromRest(true); }} tintColor={colors.accent} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>AgentPilot</Text>
          <Text style={styles.tagline}>AI Cost Intelligence</Text>
        </View>
        <View style={styles.headerRight}>
          <ConnectionPill connected={relay.isConnected && isAgentConnected} />
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/new-session")} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BudgetAlertStrip alerts={alerts} />

      {/* Hero Cost */}
      <LiveCostMeter value={liveCost} />

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <BurnRateBadge rate={burnRate} />
        <ProjectionBadge hourly={hourlyProjection} />
      </View>

      {/* Tokens + Sessions */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{liveTokens > 1000 ? `${(liveTokens / 1000).toFixed(1)}K` : liveTokens}</Text>
          <Text style={styles.statLabel}>TOKENS</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{sessions.length}</Text>
          <Text style={styles.statLabel}>SESSIONS</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{activeSessions.length}</Text>
          <Text style={styles.statLabel}>ACTIVE</Text>
        </View>
      </View>

      {/* Tips */}
      {tips.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Optimization Tips</Text>
          {tips.slice(0, 2).map((tip, i) => <TipCard key={i} tip={tip} />)}
        </>
      )}

      {/* Active Sessions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Sessions</Text>
        {activeSessions.length > 0 && (
          <View style={styles.liveBadge}>
            <Animated.View style={styles.livePulse} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {activeSessions.length === 0 ? (
        <GlowCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No active sessions</Text>
          <Text style={styles.emptySub}>Connect an agent or load demo data</Text>
          <TouchableOpacity style={[styles.seedBtn, seeding && { opacity: 0.5 }]} onPress={seedDemo} disabled={seeding}>
            {seeding ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={styles.seedBtnText}>Load Demo Data</Text>}
          </TouchableOpacity>
        </GlowCard>
      ) : (
        activeSessions.map((s) => (
          <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
        ))
      )}

      {/* Recent */}
      {sessions.length > activeSessions.length && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/sessions")}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          {sessions.filter((s) => s.status !== "active").slice(0, 3).map((s) => (
            <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
          ))}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 40, paddingHorizontal: spacing.md },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: spacing.lg + 8, paddingBottom: spacing.md },
  brand: { color: colors.text, fontSize: 24, fontFamily: "SpaceMono", fontWeight: "700", letterSpacing: -0.5 },
  tagline: { color: colors.textMuted, fontSize: 11, fontFamily: "SpaceMono", marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  addBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  addBtnText: { color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 22 },

  // Pill
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, fontFamily: "SpaceMono", fontWeight: "700", letterSpacing: 0.5 },

  // Alert
  alertStrip: { borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  alertText: { fontSize: 12, fontFamily: "SpaceMono", lineHeight: 18 },

  // Card base
  cardBase: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 4,
  },

  // Cost card
  costCard: { padding: spacing.lg, marginBottom: spacing.md, borderColor: colors.borderHighlight },
  costLabel: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", letterSpacing: 2, marginBottom: 8 },
  costRow: { flexDirection: "row", alignItems: "flex-end" },
  costCurrency: { color: colors.accent, fontSize: 24, fontFamily: "SpaceMono", fontWeight: "700", paddingBottom: 8, marginRight: 2 },
  costDollars: { color: colors.text, fontSize: 56, fontFamily: "SpaceMono", fontWeight: "700", lineHeight: 64 },
  costCents: { color: colors.textSecondary, fontSize: 28, fontFamily: "SpaceMono", paddingBottom: 8 },
  costGlowLine: { marginTop: spacing.md, height: 2, backgroundColor: colors.accent, borderRadius: 1, opacity: 0.4 },

  // Metrics
  metricsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  burnCard: { flex: 1, padding: spacing.md, alignItems: "center" },
  projectionCard: { flex: 1, padding: spacing.md, alignItems: "center" },
  metricLabel: { color: colors.textMuted, fontSize: 9, fontFamily: "SpaceMono", letterSpacing: 1.5, marginBottom: 6 },
  metricValue: { color: colors.text, fontSize: 22, fontFamily: "SpaceMono", fontWeight: "700" },
  metricUnit: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", marginTop: 2 },

  // Stats row
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  statPill: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: 18, fontFamily: "SpaceMono", fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 9, fontFamily: "SpaceMono", letterSpacing: 1, marginTop: 4 },

  // Section
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm, marginTop: spacing.md },
  sectionTitle: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", letterSpacing: 2, textTransform: "uppercase" },
  seeAll: { color: colors.accent, fontSize: 12, fontFamily: "SpaceMono" },

  // Live badge
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: `${colors.success}12`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 9, fontFamily: "SpaceMono", fontWeight: "700", letterSpacing: 1 },

  // Session row
  sessionRow: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, overflow: "hidden" },
  sessionAccent: { width: 3 },
  sessionBody: { flex: 1, padding: spacing.md },
  sessionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sessionName: { color: colors.text, fontSize: 14, fontFamily: "SpaceMono", fontWeight: "700", flex: 1 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontFamily: "SpaceMono", fontWeight: "700" },
  sessionMeta: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", marginBottom: 8 },
  sessionBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sessionTokens: { color: colors.textSecondary, fontSize: 10, fontFamily: "SpaceMono" },
  sessionCost: { color: colors.accent, fontSize: 12, fontFamily: "SpaceMono", fontWeight: "700" },

  // Tips
  tipCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, marginBottom: spacing.sm },
  tipText: { color: colors.textSecondary, fontSize: 12, fontFamily: "SpaceMono", lineHeight: 18 },
  tipSaving: { color: colors.success, fontSize: 10, fontFamily: "SpaceMono", fontWeight: "700", marginTop: 4 },

  // Empty
  emptyCard: { alignItems: "center", padding: spacing.xl, marginBottom: spacing.md },
  emptyTitle: { color: colors.text, fontSize: 15, fontFamily: "SpaceMono", fontWeight: "700", marginBottom: 6 },
  emptySub: { color: colors.textMuted, fontSize: 12, fontFamily: "SpaceMono", textAlign: "center", marginBottom: spacing.md },
  seedBtn: { backgroundColor: colors.accentGlow, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  seedBtnText: { color: colors.accent, fontSize: 13, fontFamily: "SpaceMono", fontWeight: "700" },
});

function formatCost(costUsd: number): string {
  if (costUsd < 0.0001) return "<$0.0001";
  if (costUsd < 1) return `$${costUsd.toFixed(4)}`;
  return `$${costUsd.toFixed(2)}`;
}
