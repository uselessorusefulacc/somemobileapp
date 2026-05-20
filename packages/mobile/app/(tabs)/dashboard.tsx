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
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radius } from "../../lib/theme";
import { apiClient, type Analytics, type AgentSession, type BudgetAlert } from "../../lib/api";

function CostMeter({ value }: { value: number }) {
  const formatted = value.toFixed(4);
  const dollars = Math.floor(value);
  const cents = formatted.split(".")[1];
  return (
    <View style={styles.meterContainer}>
      <Text style={styles.meterLabel}>TOTAL SPEND</Text>
      <View style={styles.meterRow}>
        <Text style={styles.meterDollar}>$</Text>
        <Text style={styles.meterValue}>{dollars}</Text>
        <Text style={styles.meterCents}>.{cents}</Text>
      </View>
    </View>
  );
}

function OptimizationRing({ score }: { score: number }) {
  const color =
    score >= 80 ? colors.success : score >= 50 ? colors.warning : colors.danger;
  return (
    <View style={styles.ringContainer}>
      <View style={[styles.ring, { borderColor: color }]}>
        <Text style={[styles.ringScore, { color }]}>{score}</Text>
        <Text style={styles.ringLabel}>OPT</Text>
      </View>
    </View>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function SessionCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const statusColor =
    session.status === "active"
      ? colors.success
      : session.status === "error"
      ? colors.danger
      : colors.textMuted;
  const agentColor =
    session.agentType === "claude"
      ? colors.agentClaude
      : session.agentType === "opencode"
      ? colors.agentOpencode
      : colors.agentCodex;

  return (
    <TouchableOpacity style={styles.sessionCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.sessionHeader}>
        <View style={[styles.agentBadge, { backgroundColor: agentColor + "22" }]}>
          <View style={[styles.agentDot, { backgroundColor: agentColor }]} />
          <Text style={[styles.agentBadgeText, { color: agentColor }]}>
            {session.agentType.toUpperCase()}
          </Text>
        </View>
        <View style={styles.sessionMeta}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {session.status}
          </Text>
        </View>
      </View>
      <Text style={styles.sessionName} numberOfLines={1}>
        {session.name}
      </Text>
      <Text style={styles.sessionModel}>{session.model}</Text>
      <View style={styles.sessionFooter}>
        <Text style={styles.sessionTokens}>
          {(session.totalTokens || 0).toLocaleString()} tokens
        </Text>
        <Text style={styles.sessionCost}>${parseFloat(session.totalCost || "0").toFixed(4)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function PulsingDot() {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [anim]);

  return (
    <Animated.View style={[styles.liveDotInner, { opacity: anim }]} />
  );
}

function BudgetAlertBanner({ alerts }: { alerts: BudgetAlert[] }) {
  if (!alerts.length) return null;
  const top = alerts[0];
  const bg = top.level === "critical" ? colors.danger + "22" : colors.warning + "22";
  const border = top.level === "critical" ? colors.danger : colors.warning;
  const textColor = top.level === "critical" ? colors.danger : colors.warning;
  return (
    <View style={[styles.alertBanner, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.alertIcon, { color: textColor }]}>
        {top.level === "critical" ? "⛔" : "⚠"}
      </Text>
      <Text style={[styles.alertText, { color: textColor }]}>{top.message}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusedRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [analyticsData, sessionsData, alertsData] = await Promise.all([
        apiClient.getAnalytics(),
        apiClient.getSessions(),
        apiClient.getAlerts(),
      ]);
      setAnalytics(analyticsData);
      setSessions(sessionsData.sessions || []);
      setAlerts(alertsData.alerts || []);
      setLastRefresh(Date.now());
    } catch (e) {
      console.error("load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Start/stop polling when screen is focused
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      load(true);
      pollingRef.current = setInterval(() => {
        if (focusedRef.current) load(true);
      }, 10_000);
      return () => {
        focusedRef.current = false;
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }, [load])
  );

  useEffect(() => {
    load();
  }, []);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      await apiClient.seedDemo();
      await load(true);
      Alert.alert("Demo Loaded", "Realistic agent session data seeded.");
    } catch (e) {
      Alert.alert("Error", "Failed to seed demo data.");
    } finally {
      setSeeding(false);
    }
  };

  const totalCost = parseFloat(analytics?.totalCost || "0");
  const optimizationScore = Math.min(
    100,
    Math.max(0, 100 - Math.floor((totalCost / Math.max(1, totalCost + 1)) * 50))
  );
  const activeSessions = sessions.filter((s) => s.status === "active");
  const secAgo = Math.round((Date.now() - lastRefresh) / 1000);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Initializing…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load(true);
          }}
          tintColor={colors.accent}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AgentPilot</Text>
          <Text style={styles.headerSub}>AI Cost Intelligence</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push("/new-session")}
          activeOpacity={0.8}
        >
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Budget alert banner */}
      <BudgetAlertBanner alerts={alerts} />

      {/* Cost meter + optimization ring */}
      <View style={styles.heroRow}>
        <CostMeter value={totalCost} />
        <OptimizationRing score={optimizationScore} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard
          label="Sessions"
          value={analytics?.totalSessions ?? 0}
          sub={`${analytics?.activeSessions ?? 0} active`}
        />
        <StatCard
          label="Tokens"
          value={
            analytics?.totalTokens
              ? analytics.totalTokens > 1000
                ? `${(analytics.totalTokens / 1000).toFixed(1)}K`
                : analytics.totalTokens
              : 0
          }
        />
        <StatCard
          label="Avg/Session"
          value={`$${parseFloat(analytics?.avgCostPerSession || "0").toFixed(3)}`}
        />
      </View>

      {/* Active sessions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>ACTIVE SESSIONS</Text>
        <View style={styles.liveRow}>
          {activeSessions.length > 0 && (
            <View style={styles.liveDot}>
              <PulsingDot />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          <Text style={styles.refreshText}>
            {secAgo < 5 ? "just now" : `${secAgo}s ago`}
          </Text>
        </View>
      </View>

      {activeSessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No active sessions</Text>
          <Text style={styles.emptySub}>
            Connect an agent or load demo data to get started
          </Text>
          <TouchableOpacity
            style={[styles.demoBtn, seeding && styles.demoBtnDisabled]}
            onPress={seedDemo}
            disabled={seeding}
          >
            {seeding ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.demoBtnText}>Load Demo Data</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll}>
          {activeSessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onPress={() => router.push(`/session/${s.id}`)}
            />
          ))}
        </ScrollView>
      )}

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/sessions")}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {sessions.slice(0, 3).map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.recentRow}
              onPress={() => router.push(`/session/${s.id}`)}
              activeOpacity={0.75}
            >
              <View style={styles.recentLeft}>
                <View
                  style={[
                    styles.recentDot,
                    {
                      backgroundColor:
                        s.agentType === "claude"
                          ? colors.agentClaude
                          : s.agentType === "opencode"
                          ? colors.agentOpencode
                          : colors.agentCodex,
                    },
                  ]}
                />
                <View>
                  <Text style={styles.recentName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.recentModel}>{s.model}</Text>
                </View>
              </View>
              <Text style={styles.recentCost}>
                ${parseFloat(s.totalCost || "0").toFixed(4)}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Demo button at bottom if data exists */}
          <TouchableOpacity
            style={[styles.demoBtnSmall, seeding && styles.demoBtnDisabled]}
            onPress={seedDemo}
            disabled={seeding}
          >
            {seeding ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.demoBtnSmallText}>↺ Reload Demo Data</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: colors.textMuted, fontFamily: "SpaceMono", fontSize: 13 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerSub: {
    color: colors.accent,
    fontSize: 11,
    fontFamily: "SpaceMono",
    letterSpacing: 2,
    marginTop: 2,
  },
  newBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  newBtnText: { color: "#fff", fontSize: 13, fontFamily: "SpaceMono", fontWeight: "700" },
  alertBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertIcon: { fontSize: 14 },
  alertText: { fontSize: 11, fontFamily: "SpaceMono", flex: 1, lineHeight: 16 },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  meterContainer: { flex: 1 },
  meterLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "SpaceMono",
    letterSpacing: 2,
    marginBottom: 4,
  },
  meterRow: { flexDirection: "row", alignItems: "flex-end" },
  meterDollar: {
    color: colors.accent,
    fontSize: 20,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    paddingBottom: 4,
  },
  meterValue: {
    color: colors.text,
    fontSize: 48,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    lineHeight: 56,
  },
  meterCents: {
    color: colors.textSecondary,
    fontSize: 24,
    fontFamily: "SpaceMono",
    paddingBottom: 6,
  },
  ringContainer: { alignItems: "center", justifyContent: "center", marginLeft: spacing.lg },
  ring: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  ringScore: { fontSize: 24, fontFamily: "SpaceMono", fontWeight: "700" },
  ringLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: "SpaceMono",
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: "SpaceMono",
    letterSpacing: 1,
    marginTop: 2,
    textAlign: "center",
  },
  statSub: {
    color: colors.accent,
    fontSize: 9,
    fontFamily: "SpaceMono",
    marginTop: 2,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "SpaceMono",
    letterSpacing: 2,
  },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { flexDirection: "row", alignItems: "center", gap: 4 },
  liveDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: { color: colors.success, fontSize: 10, fontFamily: "SpaceMono", letterSpacing: 1 },
  refreshText: { color: colors.textMuted, fontSize: 9, fontFamily: "SpaceMono" },
  seeAll: { color: colors.accent, fontSize: 11, fontFamily: "SpaceMono" },
  emptyCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.text,
    fontSize: 15,
    fontFamily: "SpaceMono",
    marginBottom: 6,
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  demoBtn: {
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 160,
    alignItems: "center",
  },
  demoBtnDisabled: { opacity: 0.5 },
  demoBtnText: { color: colors.accent, fontSize: 13, fontFamily: "SpaceMono", fontWeight: "700" },
  cardScroll: { paddingLeft: spacing.md },
  sessionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    width: 200,
    marginRight: spacing.sm,
    marginBottom: spacing.md,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  agentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  agentDot: { width: 5, height: 5, borderRadius: 3 },
  agentBadgeText: { fontSize: 9, fontFamily: "SpaceMono", fontWeight: "700", letterSpacing: 0.5 },
  sessionMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontFamily: "SpaceMono" },
  sessionName: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    marginBottom: 2,
  },
  sessionModel: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", marginBottom: spacing.sm },
  sessionFooter: { flexDirection: "row", justifyContent: "space-between" },
  sessionTokens: { color: colors.textSecondary, fontSize: 10, fontFamily: "SpaceMono" },
  sessionCost: { color: colors.accent, fontSize: 12, fontFamily: "SpaceMono", fontWeight: "700" },
  recentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recentLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  recentDot: { width: 8, height: 8, borderRadius: 4 },
  recentName: {
    color: colors.text,
    fontSize: 13,
    fontFamily: "SpaceMono",
    maxWidth: 200,
  },
  recentModel: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono" },
  recentCost: { color: colors.accent, fontSize: 13, fontFamily: "SpaceMono", fontWeight: "700" },
  demoBtnSmall: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  demoBtnSmallText: { color: colors.textMuted, fontSize: 11, fontFamily: "SpaceMono" },
});
