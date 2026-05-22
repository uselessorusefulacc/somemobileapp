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
  getAgentLabel,
  formatCost,
  getStatusColor,
} from "../../lib/theme";

// ── Event row ─────────────────────────────────────────────────────
function EventRow({ event, last }: { event: TokenEvent; last: boolean }) {
  const cost = event.costUsd ?? 0;
  const costColor =
    cost > 0.01 ? colors.danger : cost > 0.005 ? colors.warning : colors.textSecondary;
  const time = new Date(event.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const inK = (event.inputTokens / 1000).toFixed(1);
  const outK = (event.outputTokens / 1000).toFixed(1);

  return (
    <View style={[d.row, !last && d.rowBorder]}>
      <Text style={d.rowTime}>{time}</Text>
      <View style={d.rowBody}>
        <Text style={d.rowModel} numberOfLines={1}>
          {event.model}
        </Text>
        <Text style={d.rowTokens}>
          ↑{inK}K · ↓{outK}K
        </Text>
      </View>
      <Text style={[d.rowCost, { color: costColor }]}>${cost.toFixed(5)}</Text>
    </View>
  );
}

// ── Context warning ───────────────────────────────────────────────
function ContextWarning({ tokens }: { tokens: number }) {
  if (tokens < 50_000) return null;
  const isCritical = tokens >= 200_000;
  const color = isCritical ? colors.danger : colors.warning;
  const title = isCritical ? "CONTEXT CRITICAL" : "CONTEXT HIGH";
  const message = isCritical
    ? "Compact now — cuts costs 50–70%"
    : "Consider compacting to save tokens";

  return (
    <View style={[d.warn, { borderLeftColor: color }]}>
      <Text style={[d.warnTitle, { color }]}>{title}</Text>
      <Text style={d.warnText}>
        {(tokens / 1000).toFixed(0)}K tokens — {message}
      </Text>
    </View>
  );
}

// ── Command button ────────────────────────────────────────────────
function CmdButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[d.cmdBtn, { borderColor: color + "40" }]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <Text style={[d.cmdText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Main ──────────────────────────────────────────────────────────
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

  const load = useCallback(
    async (silent = false) => {
      if (!id || id === "undefined") {
        setLoading(false);
        return;
      }
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
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  const sendCmd = (
    action: string,
    cmdParams?: Record<string, unknown>
  ) => {
    relay.client?.sendCommand(
      action as "pause" | "resume" | "compact" | "switch_model" | "status",
      cmdParams
    );
  };

  // ── Error states ──────────────────────────────────────────────
  if (!id || id === "undefined") {
    return (
      <View style={d.root}>
        <Stack.Screen
          options={{
            title: "",
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerTintColor: colors.textSecondary,
          }}
        />
        <View style={d.center}>
          <Text style={d.errText}>Invalid session</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={d.errBack}>← BACK</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[d.root, d.center]}>
        <Stack.Screen
          options={{
            title: "",
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
          }}
        />
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[d.root, d.center]}>
        <Stack.Screen
          options={{
            title: "",
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
          }}
        />
        <Text style={d.errText}>Session not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={d.errBack}>← BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalCost = parseFloat(session.totalCost || "0");
  const totalTokens = session.totalTokens || 0;
  const totalK = (totalTokens / 1000).toFixed(1);
  const isActive = session.status === "active";
  const statusColor = getStatusColor(session.status);
  const reversedEvents = events.slice().reverse();

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
            <View style={d.statusBadge}>
              <View style={[d.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[d.statusLabel, { color: statusColor }]}>
                {isActive ? "ACTIVE" : "ENDED"}
              </Text>
            </View>
          ),
        }}
      />

      <ScrollView
        style={d.scroll}
        contentContainerStyle={d.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={colors.textTertiary}
          />
        }
      >
        {/* ── Header ── */}
        <View style={d.header}>
          <View style={d.headerLeft}>
            <Text style={d.agentLabel}>{getAgentLabel(session.agentType).toUpperCase()}</Text>
            <Text style={d.sessionName} numberOfLines={2}>
              {session.name}
            </Text>
            <Text style={d.sessionModel}>{session.model}</Text>
          </View>
          <Text
            style={[
              d.heroCost,
              {
                color:
                  totalCost > 1
                    ? colors.danger
                    : totalCost > 0.1
                    ? colors.warning
                    : colors.text,
              },
            ]}
          >
            {formatCost(totalCost)}
          </Text>
        </View>

        <View style={d.divider} />

        {/* ── Stat row ── */}
        <View style={d.statRow}>
          <View style={d.stat}>
            <Text style={d.statLabel}>TOKENS</Text>
            <Text style={d.statValue}>{totalK}K</Text>
          </View>
          <View style={d.statSep} />
          <View style={d.stat}>
            <Text style={d.statLabel}>CALLS</Text>
            <Text style={d.statValue}>{events.length}</Text>
          </View>
          <View style={d.statSep} />
          <View style={d.stat}>
            <Text style={d.statLabel}>STATUS</Text>
            <Text style={[d.statValue, { color: statusColor }]}>
              {session.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={d.divider} />

        {/* ── Context warning ── */}
        <ContextWarning tokens={totalTokens} />

        {/* ── Commands ── */}
        <Text style={d.sectionLabel}>COMMANDS</Text>
        <View style={d.cmdRow}>
          <CmdButton
            label="COMPACT"
            color={colors.textSecondary}
            onPress={() => sendCmd("compact")}
          />
          <CmdButton
            label="PAUSE"
            color={colors.warning}
            onPress={() => sendCmd("pause")}
          />
          <CmdButton
            label="STATUS"
            color={colors.textSecondary}
            onPress={() => sendCmd("status")}
          />
          <CmdButton
            label="END"
            color={colors.danger}
            onPress={() =>
              Alert.alert("End Session", "Terminate this agent session?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "End",
                  style: "destructive",
                  onPress: () =>
                    apiClient.patchSessionStatus(id, "ended").then(() => load(true)),
                },
              ])
            }
          />
        </View>

        <View style={d.divider} />

        {/* ── API call feed ── */}
        <View style={d.feedHeader}>
          <Text style={d.sectionLabel}>API CALLS</Text>
          <Text style={d.feedCount}>{events.length}</Text>
        </View>

        {events.length === 0 ? (
          <View style={d.empty}>
            <Text style={d.emptyText}>No API calls yet</Text>
            <Text style={d.emptySub}>LLM calls appear here in real-time</Text>
          </View>
        ) : (
          <View>
            {/* Table head */}
            <View style={[d.row, d.rowBorder, d.tableHead]}>
              <Text style={[d.rowTime, d.headCell]}>TIME</Text>
              <View style={d.rowBody}>
                <Text style={d.headCell}>MODEL</Text>
              </View>
              <Text style={[d.rowCost, d.headCell]}>COST</Text>
            </View>
            {reversedEvents.map((e, i) => (
              <EventRow key={e.id} event={e} last={i === reversedEvents.length - 1} />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing["4xl"] },

  // Back / status header
  backBtn: { paddingHorizontal: 4 },
  backArrow: { color: colors.textSecondary, fontSize: 20 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginRight: 4,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: { ...typography.label, letterSpacing: 0.6 },

  // Error
  errText: { ...typography.body, color: colors.textTertiary, marginBottom: spacing.lg },
  errBack: { ...typography.label, color: colors.textSecondary, letterSpacing: 1 },

  // ── Header block ──
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerLeft: { flex: 1, paddingRight: spacing.base },
  agentLabel: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  sessionName: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 26,
    marginBottom: spacing.xs,
  },
  sessionModel: {
    fontFamily: "monospace",
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },
  heroCost: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    paddingTop: 2,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },

  // ── Stat row ──
  statRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
  },
  stat: { flex: 1, alignItems: "flex-start" },
  statLabel: {
    ...typography.label,
    color: colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    letterSpacing: 0.2,
  },
  statSep: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
    marginHorizontal: spacing.base,
  },

  // ── Context warning ──
  warn: {
    borderLeftWidth: 2,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.base,
    paddingLeft: spacing.base,
    paddingVertical: spacing.xs,
  },
  warnTitle: {
    ...typography.label,
    letterSpacing: 1,
    marginBottom: 2,
  },
  warnText: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },

  // ── Section label ──
  sectionLabel: {
    ...typography.label,
    color: colors.textTertiary,
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },

  // ── Commands ──
  cmdRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
  },
  cmdBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  cmdText: { ...typography.label, letterSpacing: 0.5 },

  // ── Feed ──
  feedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  feedCount: {
    ...typography.label,
    color: colors.textDisabled,
    letterSpacing: 0.5,
  },
  tableHead: {
    backgroundColor: colors.bgElevated,
  },
  headCell: {
    ...typography.label,
    color: colors.textDisabled,
    letterSpacing: 0.8,
    fontSize: 9,
  },

  // ── Rows ──
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTime: {
    width: 48,
    fontFamily: "monospace",
    fontSize: 11,
    color: colors.textDisabled,
  },
  rowBody: { flex: 1 },
  rowModel: {
    fontFamily: "monospace",
    fontSize: 12,
    color: colors.textSecondary,
  },
  rowTokens: {
    fontFamily: "monospace",
    fontSize: 10,
    color: colors.textDisabled,
    marginTop: 1,
  },
  rowCost: {
    width: 76,
    textAlign: "right",
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Empty ──
  empty: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing["3xl"],
    alignItems: "center",
  },
  emptyText: { ...typography.body, color: colors.textSecondary, marginBottom: 4 },
  emptySub: { ...typography.caption, color: colors.textDisabled, textAlign: "center" },
});
