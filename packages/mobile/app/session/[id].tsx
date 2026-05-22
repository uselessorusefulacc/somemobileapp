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
import { colors, fonts, radius, space } from "../../lib/theme";

function formatCost(c: number) {
  if (c === 0) return "$0.00";
  if (c < 0.001) return `$${(c * 100000).toFixed(1)}μ`;
  if (c < 1) return `$${c.toFixed(4)}`;
  return `$${c.toFixed(2)}`;
}

function getStatusColor(s: string) {
  if (s === "active") return colors.success;
  if (s === "paused") return colors.warning;
  if (s === "error") return colors.danger;
  return colors.textTertiary;
}

// ── Event row ──────────────────────────────────────────────────────
function EventRow({ event, last }: { event: TokenEvent; last: boolean }) {
  const cost = event.costUsd ?? 0;
  const costColor = cost > 0.01 ? colors.danger : cost > 0.005 ? colors.warning : colors.textSecondary;
  const time = new Date(event.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const inK = (event.inputTokens / 1000).toFixed(1);
  const outK = (event.outputTokens / 1000).toFixed(1);

  return (
    <View style={[d.row, !last && d.rowBorder]}>
      <Text style={d.rowTime}>{time}</Text>
      <View style={d.rowBody}>
        <Text style={d.rowModel} numberOfLines={1}>{event.model}</Text>
        <Text style={d.rowTokens}>↑{inK}K · ↓{outK}K</Text>
      </View>
      <Text style={[d.rowCost, { color: costColor }]}>{formatCost(cost)}</Text>
    </View>
  );
}

// ── Context warning ───────────────────────────────────────────────
function ContextWarning({ tokens }: { tokens: number }) {
  if (tokens < 50_000) return null;
  const isCritical = tokens >= 200_000;
  const color = isCritical ? colors.danger : colors.warning;
  return (
    <View style={[d.warn, { borderLeftColor: color }]}>
      <Text style={[d.warnTitle, { color }]}>
        {isCritical ? "CONTEXT CRITICAL" : "CONTEXT HIGH"}
      </Text>
      <Text style={d.warnText}>
        {(tokens / 1000).toFixed(0)}K tokens —{" "}
        {isCritical ? "Compact now — cuts costs 50–70%" : "Consider compacting to save tokens"}
      </Text>
    </View>
  );
}

// ── Command button ────────────────────────────────────────────────
function CmdBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
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

  const sendCmd = (action: "pause" | "resume" | "compact" | "switch_model" | "status") => {
    relay.client?.sendCommand(action);
  };

  const headerOpts = {
    title: "",
    headerStyle: { backgroundColor: colors.bg },
    headerShadowVisible: false,
    headerTintColor: colors.textTertiary,
    headerLeft: () => (
      <TouchableOpacity onPress={() => router.back()} style={d.backBtn}>
        <Text style={d.backArrow}>←</Text>
      </TouchableOpacity>
    ),
  };

  if (!id || id === "undefined") {
    return (
      <View style={d.root}>
        <Stack.Screen options={headerOpts} />
        <View style={d.center}>
          <Text style={d.errText}>INVALID SESSION</Text>
          <TouchableOpacity onPress={() => router.back()} style={d.errBackBtn}>
            <Text style={d.errBackText}>BACK</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[d.root, d.center]}>
        <Stack.Screen options={headerOpts} />
        <ActivityIndicator color={colors.textTertiary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[d.root, d.center]}>
        <Stack.Screen options={headerOpts} />
        <Text style={d.errText}>SESSION NOT FOUND</Text>
        <TouchableOpacity onPress={() => router.back()} style={d.errBackBtn}>
          <Text style={d.errBackText}>BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalCost = parseFloat(session.totalCost || "0");
  const totalTokens = session.totalTokens || 0;
  const isActive = session.status === "active";
  const statusColor = getStatusColor(session.status);
  const reversedEvents = events.slice().reverse();

  return (
    <View style={[d.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          ...headerOpts,
          headerRight: () => (
            <View style={d.statusBadge}>
              <View style={[d.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[d.statusLabel, { color: statusColor }]}>
                {session.status.toUpperCase()}
              </Text>
            </View>
          ),
        }}
      />

      <ScrollView
        style={d.scroll}
        contentContainerStyle={d.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={colors.textTertiary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header block ── */}
        <View style={d.header}>
          <View style={d.headerLeft}>
            <Text style={d.agentLabel}>{session.agentType.toUpperCase()}</Text>
            <Text style={d.sessionName} numberOfLines={2}>{session.name}</Text>
            <Text style={d.sessionModel}>{session.model}</Text>
          </View>
          <Text style={[d.heroCost, {
            color: totalCost > 1 ? colors.danger : totalCost > 0.1 ? colors.warning : colors.text,
          }]}>
            {formatCost(totalCost)}
          </Text>
        </View>

        <View style={d.divider} />

        {/* ── Stat row ── */}
        <View style={d.statRow}>
          <View style={d.stat}>
            <Text style={d.statLabel}>TOKENS</Text>
            <Text style={d.statValue}>{(totalTokens / 1000).toFixed(1)}K</Text>
          </View>
          <View style={d.statSep} />
          <View style={d.stat}>
            <Text style={d.statLabel}>API CALLS</Text>
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
          <CmdBtn label="COMPACT" color={colors.textSecondary} onPress={() => sendCmd("compact")} />
          <CmdBtn label="PAUSE" color={colors.warning} onPress={() => sendCmd("pause")} />
          <CmdBtn label="STATUS" color={colors.textSecondary} onPress={() => sendCmd("status")} />
          <CmdBtn
            label="END"
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

        <View style={d.divider} />

        {/* ── API call feed ── */}
        <View style={d.feedHead}>
          <Text style={d.sectionLabel}>API CALLS</Text>
          <Text style={d.feedCount}>{events.length}</Text>
        </View>

        {events.length === 0 ? (
          <View style={d.empty}>
            <Text style={d.emptyTitle}>NO CALLS YET</Text>
            <Text style={d.emptySub}>LLM calls appear here in real-time</Text>
          </View>
        ) : (
          <View>
            {/* Table header */}
            <View style={[d.row, d.rowBorder, d.tableHead]}>
              <Text style={[d.rowTime, d.headCell]}>TIME</Text>
              <View style={d.rowBody}>
                <Text style={d.headCell}>MODEL / TOKENS</Text>
              </View>
              <Text style={[d.rowCost, d.headCell]}>COST</Text>
            </View>
            {reversedEvents.map((e, i) => (
              <EventRow key={e.id} event={e} last={i === reversedEvents.length - 1} />
            ))}
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  divider: { height: 1, backgroundColor: colors.border },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },

  backBtn: { paddingHorizontal: 4 },
  backArrow: {
    fontFamily: fonts.sans,
    fontSize: 20,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginRight: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // Error states
  errText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
  errBackBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    borderRadius: radius.xs,
  },
  errBackText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.lg,
  },
  headerLeft: { flex: 1, paddingRight: space.md },
  agentLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sessionName: {
    fontFamily: fonts.sans,
    fontSize: 20,
    fontWeight: "400",
    letterSpacing: -0.5,
    color: colors.text,
    lineHeight: 26,
    marginBottom: 6,
  },
  sessionModel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },
  heroCost: {
    fontFamily: fonts.sans,
    fontSize: 28,
    fontWeight: "400",
    letterSpacing: -1,
    lineHeight: 32,
    paddingTop: 2,
  },

  // Stats
  statRow: {
    flexDirection: "row",
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 4,
  },
  stat: { flex: 1 },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statValue: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: -0.3,
    color: colors.text,
  },
  statSep: {
    width: 1,
    backgroundColor: colors.border,
    alignSelf: "stretch",
    marginHorizontal: space.sm,
    marginVertical: 2,
  },

  // Context warning
  warn: {
    borderLeftWidth: 2,
    marginHorizontal: space.lg,
    marginVertical: space.md,
    paddingLeft: space.md,
    paddingVertical: 8,
  },
  warnTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  warnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },

  // Section label
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: "uppercase",
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },

  // Commands
  cmdRow: {
    flexDirection: "row",
    gap: space.sm - 2,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  cmdBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  cmdText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },

  // Feed
  feedHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: space.lg,
  },
  feedCount: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
  },
  tableHead: { backgroundColor: colors.surfaceRaised },
  headCell: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },

  // Rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  rowTime: {
    width: 60,
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
  },
  rowBody: { flex: 1 },
  rowModel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
  },
  rowTokens: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  rowCost: {
    width: 72,
    textAlign: "right",
    fontFamily: fonts.mono,
    fontSize: 12,
  },

  // Empty
  empty: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  emptySub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textTertiary,
  },
});
