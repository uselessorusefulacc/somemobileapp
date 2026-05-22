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
import {
  colors,
  spacing,
  radius,
  typography,
  getAgentColor,
  getAgentLabel,
  formatCost,
  getStatusColor,
} from "../../lib/theme";

// ── Status dot (Linear style: 8px filled circle) ───────────────────
function StatusDot({ color, pulsing = false }: { color: string; pulsing?: boolean }) {
  return (
    <View style={[d.statusDot, { backgroundColor: color }, pulsing && d.statusDotPulsing]} />
  );
}

// ── Hero section (Apple Health ring-style stats) ─────────────────────
function HeroSection({ cost, isLive }: { cost: number; isLive: boolean }) {
  return (
    <View style={d.heroCard}>
      <View style={d.heroTop}>
        <Text style={d.heroLabel}>Total Spend</Text>
        <View style={d.liveBadge}>
          <StatusDot color={isLive ? colors.success : colors.textDisabled} pulsing={isLive} />
          <Text style={[d.liveText, { color: isLive ? colors.success : colors.textDisabled }]}>
            {isLive ? "Live" : "Idle"}
          </Text>
        </View>
      </View>
      <Text style={d.heroValue}>{formatCost(cost)}</Text>
      <View style={d.heroBar}>
        <View style={[d.heroBarFill, { width: `${Math.min(100, cost * 10)}%`, backgroundColor: cost > 1 ? colors.danger : cost > 0.1 ? colors.warning : colors.accent }]} />
      </View>
    </View>
  );
}

// ── Metric pill (Stripe-style clean data chips) ────────────────────
function MetricPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={d.pill}>
      <Text style={d.pillLabel}>{label}</Text>
      <Text style={[d.pillValue, { color: color || colors.text }]}>{value}</Text>
    </View>
  );
}

// ── Section header (Things 3 style: clear, generous) ───────────────
function SectionHeader({ title, action, actionLabel }: { title: string; action?: () => void; actionLabel?: string }) {
  return (
    <View style={d.sectionHeader}>
      <Text style={d.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action} activeOpacity={0.7}>
          <Text style={d.sectionAction}>{actionLabel || "See all"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Session row (Linear list style: clean, minimal, full-width) ────
function SessionRow({ session, onPress }: { session: AgentSession; onPress: () => void }) {
  const agentColor = getAgentColor(session.agentType);
  const statusColor = getStatusColor(session.status);
  const cost = parseFloat(session.totalCost || "0");

  return (
    <TouchableOpacity style={d.row} onPress={onPress} activeOpacity={0.6}>
      <StatusDot color={statusColor} />
      <View style={d.rowContent}>
        <Text style={d.rowName} numberOfLines={1}>{session.name}</Text>
        <Text style={[d.rowMeta, { color: agentColor }]}>{getAgentLabel(session.agentType)} · {session.model}</Text>
      </View>
      <Text style={[d.rowCost, { color: cost > 0.1 ? colors.warning : colors.textSecondary }]}>
        {formatCost(cost)}
      </Text>
    </TouchableOpacity>
  );
}

// ── Tip card (Linear-style bordered cards with accent left border) ───
function TipCard({ tip }: { tip: { message: string; category: string; estimatedSaving?: string } }) {
  const accentColor = tip.category === "urgent" ? colors.danger : tip.category === "model" ? colors.warning : colors.accent;
  return (
    <View style={[d.tipCard, { borderLeftColor: accentColor }]}>
      <View style={d.tipContent}>
        <Text style={d.tipText}>{tip.message}</Text>
        {tip.estimatedSaving && (
          <Text style={[d.tipSaving, { color: accentColor }]}>Save {tip.estimatedSaving}</Text>
        )}
      </View>
    </View>
  );
}

// ── Budget alert banner (Apple Health-style warning banner) ──────────
function AlertBanner({ alert }: { alert: BudgetAlert }) {
  const color = alert.level === "critical" ? colors.danger : colors.warning;
  const bgColor = alert.level === "critical" ? colors.dangerDim : colors.warningDim;
  return (
    <View style={[d.alertBanner, { backgroundColor: bgColor, borderColor: color + "30" }]}>
      <StatusDot color={color} />
      <Text style={[d.alertText, { color }]}>{alert.message}</Text>
    </View>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────
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
      <View style={[d.root, d.center, { paddingTop: insets.top + spacing["2xl"] }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={d.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing["4xl"] }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRest(true); }} tintColor={colors.accent} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={d.header}>
        <View>
          <Text style={d.headerTitle}>Overview</Text>
          <Text style={d.headerSubtitle}>AgentPilot</Text>
        </View>
        <TouchableOpacity style={d.headerBtn} onPress={() => router.push("/new-session")} activeOpacity={0.7}>
          <Text style={d.headerBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Alerts */}
      {alerts.length > 0 && <AlertBanner alert={alerts[0]} />}

      {/* Hero */}
      <HeroSection cost={totalCost} isLive={isLive} />

      {/* Metrics */}
      <View style={d.metricsRow}>
        <MetricPill label="Sessions" value={String(sessions.length)} />
        <MetricPill label="Active" value={String(activeSessions.length)} color={activeSessions.length > 0 ? colors.success : colors.textSecondary} />
        <MetricPill label="Burn" value={burnRate > 0 ? `${burnRate.toFixed(0)}/min` : "—"} color={burnRate > 5000 ? colors.warning : colors.textSecondary} />
      </View>

      {hourlyProjection > 0 && (
        <MetricPill label="Est. hourly" value={`$${hourlyProjection.toFixed(2)}`} color={hourlyProjection > 5 ? colors.danger : hourlyProjection > 1 ? colors.warning : colors.success} />
      )}

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <View style={d.section}>
          <SectionHeader title="Active now" action={() => router.push("/(tabs)/sessions")} />
          <View style={d.listCard}>
            {activeSessions.map((s) => (
              <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
            ))}
          </View>
        </View>
      )}

      {/* Tips */}
      {tips.length > 0 && (
        <View style={d.section}>
          <SectionHeader title="Suggestions" />
          {tips.map((tip, i) => (
            <TipCard key={i} tip={tip} />
          ))}
        </View>
      )}

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <View style={d.section}>
          <SectionHeader title="Recent" action={() => router.push("/(tabs)/sessions")} actionLabel="See all" />
          <View style={d.listCard}>
            {sessions.slice(0, 5).map((s) => (
              <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
            ))}
          </View>
        </View>
      )}

      {/* Empty state */}
      {sessions.length === 0 && (
        <View style={d.empty}>
          <View style={d.emptyIconBg}>
            <Text style={d.emptyIcon}>◈</Text>
          </View>
          <Text style={d.emptyTitle}>No sessions yet</Text>
          <Text style={d.emptySub}>Create a session to start tracking your AI agent costs in real time.</Text>
          <TouchableOpacity style={d.emptyBtn} onPress={() => router.push("/new-session")} activeOpacity={0.7}>
            <Text style={d.emptyBtnText}>Create Session</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={seedDemo} disabled={seeding}>
            {seeding ? <ActivityIndicator color={colors.textDisabled} size="small" /> : <Text style={d.emptyLink}>Load demo data</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  headerTitle: { ...typography.title1, color: colors.text },
  headerSubtitle: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.xs },
  headerBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  headerBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Hero card
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  heroLabel: { ...typography.label, color: colors.textTertiary },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  liveText: { ...typography.caption, fontWeight: "600" },
  heroValue: { ...typography.hero, color: colors.text, marginBottom: spacing.sm },
  heroBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  heroBarFill: { height: 4, borderRadius: 2 },

  // Status dot
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotPulsing: {
    shadowColor: colors.success,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },

  // Metrics
  metricsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  pill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  pillLabel: { ...typography.label, color: colors.textTertiary, marginBottom: spacing.xs },
  pillValue: { ...typography.number, fontWeight: "700" },

  // Section
  section: { marginTop: spacing["2xl"], paddingHorizontal: spacing.lg },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.base,
  },
  sectionTitle: { ...typography.title3, color: colors.text },
  sectionAction: { ...typography.caption, color: colors.accent, fontWeight: "500" },

  // List card
  listCard: {
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
    gap: spacing.base,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowContent: { flex: 1 },
  rowName: { ...typography.body, color: colors.text, marginBottom: spacing.px },
  rowMeta: { ...typography.caption, fontWeight: "500" },
  rowCost: { ...typography.body, fontWeight: "600" },

  // Tip card
  tipCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  tipContent: { flex: 1 },
  tipText: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  tipSaving: { ...typography.caption, fontWeight: "600", marginTop: spacing.xs },

  // Alert
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.base,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  alertText: { flex: 1, ...typography.bodySmall, fontWeight: "500" },

  // Empty
  empty: { alignItems: "center", paddingTop: spacing["4xl"], paddingHorizontal: spacing["2xl"] },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyIcon: { fontSize: 28, color: colors.accent },
  emptyTitle: { ...typography.title2, color: colors.text, marginBottom: spacing.sm },
  emptySub: { ...typography.bodySmall, color: colors.textTertiary, textAlign: "center", lineHeight: 22 },
  emptyBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.base,
    borderRadius: radius.md,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  emptyLink: { ...typography.caption, color: colors.textTertiary },
});
