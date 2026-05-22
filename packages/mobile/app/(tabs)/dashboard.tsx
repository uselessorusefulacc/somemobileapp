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
  formatTokens,
} from "../../lib/theme";

function SessionRow({ session, onPress }: { session: AgentSession; onPress: () => void }) {
  const statusColor = getStatusColor(session.status);
  const agentColor = getAgentColor(session.agentType);
  const cost = parseFloat(session.totalCost || "0");
  const isActive = session.status === "active";

  return (
    <TouchableOpacity style={d.row} onPress={onPress} activeOpacity={0.5}>
      <View style={[d.rowAccent, { backgroundColor: isActive ? statusColor : "transparent" }]} />
      <View style={d.rowContent}>
        <View style={d.rowTop}>
          <Text style={d.rowName} numberOfLines={1}>{session.name}</Text>
          <Text style={[d.rowCost, cost > 0.5 ? { color: colors.warning } : {}]}>
            {formatCost(cost)}
          </Text>
        </View>
        <Text style={[d.rowMeta, { color: agentColor }]}>
          {getAgentLabel(session.agentType).toUpperCase()}
        </Text>
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
      <View style={[d.root, d.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.textTertiary} size="small" />
      </View>
    );
  }

  return (
    <ScrollView
      style={d.root}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadRest(true); }}
          tintColor={colors.textTertiary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={d.header}>
        <Text style={d.headerTitle}>Overview</Text>
        <View style={d.headerRight}>
          {isLive && (
            <View style={d.liveChip}>
              <View style={d.liveDot} />
              <Text style={d.liveText}>LIVE</Text>
            </View>
          )}
          <TouchableOpacity style={d.newBtn} onPress={() => router.push("/new-session")} activeOpacity={0.7}>
            <Text style={d.newBtnText}>NEW</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={d.divider} />

      {/* Alert */}
      {alerts.length > 0 && (
        <View style={[d.alertRow, { borderLeftColor: alerts[0].level === "critical" ? colors.danger : colors.warning }]}>
          <Text style={[d.alertText, { color: alerts[0].level === "critical" ? colors.danger : colors.warning }]}>
            {alerts[0].message}
          </Text>
        </View>
      )}

      {/* Hero cost */}
      <View style={d.hero}>
        <Text style={d.heroLabel}>TOTAL SPEND</Text>
        <Text style={d.heroValue}>{formatCost(totalCost)}</Text>
        {burnRate > 0 && (
          <Text style={d.heroBurn}>
            {burnRate.toFixed(0)} tokens/min · est. ${hourlyProjection.toFixed(2)}/hr
          </Text>
        )}
      </View>

      <View style={d.divider} />

      {/* Stat row */}
      <View style={d.statsRow}>
        <View style={d.statCell}>
          <Text style={d.statLabel}>SESSIONS</Text>
          <Text style={d.statValue}>{sessions.length}</Text>
        </View>
        <View style={d.statDivider} />
        <View style={d.statCell}>
          <Text style={d.statLabel}>ACTIVE</Text>
          <Text style={[d.statValue, activeSessions.length > 0 ? { color: colors.success } : {}]}>
            {activeSessions.length}
          </Text>
        </View>
        <View style={d.statDivider} />
        <View style={d.statCell}>
          <Text style={d.statLabel}>TOKENS</Text>
          <Text style={d.statValue}>{formatTokens(liveTokens)}</Text>
        </View>
      </View>

      <View style={d.divider} />

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <>
          <View style={d.sectionHeader}>
            <Text style={d.sectionLabel}>ACTIVE NOW</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/sessions")} activeOpacity={0.6}>
              <Text style={d.sectionAction}>ALL →</Text>
            </TouchableOpacity>
          </View>
          {activeSessions.map((s) => (
            <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
          ))}
          <View style={d.divider} />
        </>
      )}

      {/* Suggestions */}
      {tips.length > 0 && (
        <>
          <View style={d.sectionHeader}>
            <Text style={d.sectionLabel}>SUGGESTIONS</Text>
          </View>
          {tips.map((tip, i) => (
            <View key={i} style={[d.tipRow, { borderLeftColor: tip.category === "urgent" ? colors.danger : colors.warning }]}>
              <Text style={d.tipText}>{tip.message}</Text>
              {tip.estimatedSaving && (
                <Text style={d.tipSaving}>Save {tip.estimatedSaving}</Text>
              )}
            </View>
          ))}
          <View style={d.divider} />
        </>
      )}

      {/* Recent */}
      {sessions.length > 0 && (
        <>
          <View style={d.sectionHeader}>
            <Text style={d.sectionLabel}>RECENT</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/sessions")} activeOpacity={0.6}>
              <Text style={d.sectionAction}>ALL →</Text>
            </TouchableOpacity>
          </View>
          {sessions.slice(0, 5).map((s) => (
            <SessionRow key={s.id} session={s} onPress={() => router.push(`/session/${s.id}`)} />
          ))}
        </>
      )}

      {/* Empty */}
      {sessions.length === 0 && (
        <View style={d.empty}>
          <Text style={d.emptyTitle}>No sessions yet</Text>
          <Text style={d.emptySub}>Create a session to start tracking your agent spend.</Text>
          <TouchableOpacity style={d.emptyBtn} onPress={() => router.push("/new-session")} activeOpacity={0.7}>
            <Text style={d.emptyBtnText}>CREATE SESSION</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={seedDemo} disabled={seeding} style={{ marginTop: spacing.base }}>
            {seeding
              ? <ActivityIndicator color={colors.textTertiary} size="small" />
              : <Text style={d.emptyLink}>Load demo data</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
  },
  headerTitle: { ...typography.title1, color: colors.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },

  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(40,200,64,0.2)",
    backgroundColor: colors.successDim,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success },
  liveText: { fontSize: 9, fontWeight: "600", letterSpacing: 0.6, color: colors.success },

  newBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newBtnText: { ...typography.label, color: colors.text },

  divider: { height: 1, backgroundColor: colors.border },

  alertRow: {
    borderLeftWidth: 2,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.base,
    paddingLeft: spacing.sm,
  },
  alertText: { ...typography.bodySmall, fontWeight: "500" },

  hero: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing["2xl"],
  },
  heroLabel: { ...typography.label, color: colors.textTertiary, marginBottom: spacing.sm },
  heroValue: { ...typography.hero, color: colors.text, marginBottom: 6 },
  heroBurn: { ...typography.caption, color: colors.textTertiary },

  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  statCell: {
    flex: 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: 6,
  },
  statDivider: { width: 1, backgroundColor: colors.border },
  statLabel: { ...typography.label, color: colors.textTertiary },
  statValue: { ...typography.number, color: colors.text },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionLabel: { ...typography.label, color: colors.textTertiary },
  sectionAction: { ...typography.label, color: colors.textSecondary },

  row: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowAccent: { width: 2, marginVertical: 4 },
  rowContent: {
    flex: 1,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    gap: 4,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowName: { ...typography.body, color: colors.text, flex: 1, marginRight: spacing.sm },
  rowCost: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: "500" },
  rowMeta: { fontSize: 9, fontWeight: "600", letterSpacing: 0.5 },

  tipRow: {
    borderLeftWidth: 2,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
    paddingVertical: 4,
  },
  tipText: { ...typography.bodySmall, color: colors.textSecondary },
  tipSaving: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },

  empty: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: spacing["2xl"],
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.title3, color: colors.textSecondary },
  emptySub: { ...typography.caption, color: colors.textTertiary, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
  },
  emptyBtnText: { ...typography.label, color: colors.text },
  emptyLink: { ...typography.caption, color: colors.textTertiary },
});
