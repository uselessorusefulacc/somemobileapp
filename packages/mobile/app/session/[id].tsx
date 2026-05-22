import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type AgentSession, type TokenEvent } from "../../lib/api";
import { useRelay } from "../../lib/relay-context";
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

// ── Event row (Stripe table-style) ────────────────────────────────
function EventRow({ event }: { event: TokenEvent }) {
  const cost = event.costUsd ?? 0;
  const costColor = cost > 0.01 ? colors.danger : cost > 0.005 ? colors.warning : colors.textSecondary;
  const time = new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const inK = (event.inputTokens / 1000).toFixed(1);
  const outK = (event.outputTokens / 1000).toFixed(1);

  return (
    <View style={d.row}>
      <Text style={d.rowTime}>{time}</Text>
      <View style={d.rowBody}>
        <Text style={d.rowModel} numberOfLines={1}>{event.model}</Text>
        <Text style={d.rowTokens}>↑{inK}K · ↓{outK}K</Text>
      </View>
      <Text style={[d.rowCost, { color: costColor }]}>${cost.toFixed(5)}</Text>
    </View>
  );
}

// ── Command button (Linear ghost button style) ─────────────────────
function CmdButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[d.cmdBtn, { borderColor: color + "30", backgroundColor: color + "08" }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[d.cmdText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Context warning (Apple Health-style banner) ──────────────────
function ContextWarning({ tokens }: { tokens: number }) {
  if (tokens < 50_000) return null;
  const isCritical = tokens >= 200_000;
  const color = isCritical ? colors.danger : colors.warning;
  const title = isCritical ? "Context critical" : "Context high";
  const message = isCritical
    ? "Compact now to cut costs 50–70%"
    : "Consider compacting soon to save tokens";

  return (
    <View style={[d.warnCard, { borderLeftColor: color, backgroundColor: color + "08" }]}>
      <Text style={[d.warnTitle, { color }]}>{title}</Text>
      <Text style={d.warnText}>{(tokens / 1000).toFixed(0)}K tokens — {message}</Text>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────
export default function SessionDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const relay = useRelay();

  const [session, setSession] = useState<AgentSession | null>(null);
  const [events, setEvents] = useState<TokenEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!id || id === "undefined") { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const [sessionData, eventsData] = await Promise.all([
        apiClient.getSession(id),
        apiClient.getEvents(id),
      ]);
      setSession(sessionData);
      setEvents(eventsData.events || []);
    } catch (e) {
      console.error("[session detail]", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const sendCmd = (action: string, cmdParams?: Record<string, unknown>) => {
    relay.client?.sendCommand(action as "pause" | "resume" | "compact" | "switch_model" | "status", cmdParams);
  };

  if (!id || id === "undefined") {
    return (
      <View style={d.root}>
        <Stack.Screen options={{ title: "Session", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textSecondary }} />
        <View style={d.center}>
          <Text style={d.error}>Invalid session</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={d.errorAction}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[d.root, d.center]}>
        <Stack.Screen options={{ title: "Loading…", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textSecondary }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[d.root, d.center]}>
        <Stack.Screen options={{ title: "Not found", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textSecondary }} />
        <Text style={d.error}>Session not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={d.errorAction}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const agentColor = getAgentColor(session.agentType);
  const totalCost = parseFloat(session.totalCost || "0");
  const totalTokens = session.totalTokens || 0;
  const totalK = (totalTokens / 1000).toFixed(1);
  const isActive = session.status === "active";
  const statusColor = getStatusColor(session.status);

  return (
    <View style={[d.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          title: "",
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.textSecondary,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={d.backBtn}>
              <Text style={d.backArrow}>←</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={[d.statusBadge, { backgroundColor: statusColor + "10" }]}>
              <View style={[d.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[d.statusText, { color: statusColor }]}>{isActive ? "Active" : "Ended"}</Text>
            </View>
          ),
        }}
      />

      <ScrollView
        style={d.scroll}
        contentContainerStyle={d.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />
        }
      >
        {/* Title */}
        <View style={d.titleArea}>
          <View style={[d.agentTag, { backgroundColor: agentColor + "15" }]}>
            <Text style={[d.agentTagText, { color: agentColor }]}>{getAgentLabel(session.agentType)}</Text>
          </View>
          <Text style={d.title} numberOfLines={2}>{session.name}</Text>
          <Text style={d.subtitle}>{session.model}</Text>
        </View>

        {/* Stats */}
        <View style={d.statsRow}>
          <View style={d.statCard}>
            <Text style={d.statLabel}>Cost</Text>
            <Text style={[d.statValue, { color: totalCost > 1 ? colors.danger : totalCost > 0.1 ? colors.warning : colors.text }]}>
              ${totalCost.toFixed(4)}
            </Text>
          </View>
          <View style={d.statCard}>
            <Text style={d.statLabel}>Tokens</Text>
            <Text style={d.statValue}>{totalK}K</Text>
          </View>
          <View style={d.statCard}>
            <Text style={d.statLabel}>Calls</Text>
            <Text style={d.statValue}>{events.length}</Text>
          </View>
        </View>

        {/* Context warning */}
        <ContextWarning tokens={totalTokens} />

        {/* Commands */}
        <View style={d.cmdRow}>
          <CmdButton label="Compact" color={colors.accent} onPress={() => sendCmd("compact")} />
          <CmdButton label="Pause" color={colors.warning} onPress={() => sendCmd("pause")} />
          <CmdButton label="Status" color={colors.info} onPress={() => sendCmd("status")} />
          <CmdButton
            label="End"
            color={colors.danger}
            onPress={() =>
              Alert.alert("End Session", "Terminate this agent session?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "End",
                  style: "destructive",
                  onPress: () => apiClient.patchSessionStatus(id, "ended").then(() => load(true)),
                },
              ])
            }
          />
        </View>

        {/* Event feed */}
        <View style={d.section}>
          <View style={d.sectionHeader}>
            <Text style={d.sectionTitle}>API calls</Text>
            <Text style={d.sectionCount}>{events.length} total</Text>
          </View>

          {events.length === 0 ? (
            <View style={d.emptyCard}>
              <Text style={d.emptyTitle}>No API calls yet</Text>
              <Text style={d.emptySub}>LLM calls appear here in real-time</Text>
            </View>
          ) : (
            <View style={d.feedCard}>
              <View style={d.feedHead}>
                <Text style={[d.feedHeadCell, { width: 50 }]}>Time</Text>
                <Text style={[d.feedHeadCell, { flex: 1 }]}>Model</Text>
                <Text style={[d.feedHeadCell, { width: 80, textAlign: "right" }]}>Cost</Text>
              </View>
              {events.slice().reverse().map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing["4xl"] },

  backBtn: { paddingHorizontal: 4 },
  backArrow: { color: colors.textSecondary, fontSize: 18 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginRight: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "600" },

  error: { ...typography.body, color: colors.textTertiary, marginBottom: spacing.lg },
  errorAction: { color: colors.accent, fontSize: 15, fontWeight: "500" },

  // Title
  titleArea: { marginBottom: spacing.xl },
  agentTag: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  agentTagText: { ...typography.caption, fontWeight: "600" },
  title: { ...typography.title2, color: colors.text, lineHeight: 28 },
  subtitle: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.xs },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  statLabel: { ...typography.label, color: colors.textTertiary, marginBottom: spacing.xs },
  statValue: { ...typography.number, color: colors.text, fontWeight: "700" },

  // Warning
  warnCard: {
    borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.xl,
  },
  warnTitle: { ...typography.body, fontWeight: "600", marginBottom: 2 },
  warnText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },

  // Commands
  cmdRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing["2xl"],
  },
  cmdBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  cmdText: { ...typography.caption, fontWeight: "600" },

  // Section
  section: { marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.base,
  },
  sectionTitle: { ...typography.label, color: colors.textTertiary },
  sectionCount: { ...typography.caption, color: colors.textDisabled },

  // Feed
  feedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  feedHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  feedHeadCell: { ...typography.label, color: colors.textDisabled },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rowTime: { width: 50, ...typography.caption, color: colors.textDisabled },
  rowBody: { flex: 1 },
  rowModel: { ...typography.bodySmall, color: colors.textSecondary },
  rowTokens: { ...typography.caption, color: colors.textDisabled, marginTop: 1 },
  rowCost: { width: 80, textAlign: "right", ...typography.body, fontSize: 13, fontWeight: "600" },

  // Empty
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing["3xl"],
    alignItems: "center",
  },
  emptyTitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
  emptySub: { ...typography.caption, color: colors.textDisabled, textAlign: "center" },
});
