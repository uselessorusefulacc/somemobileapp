import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type AgentSession, type TokenEvent } from "../../lib/api";
import { useRelay } from "../../lib/relay-context";
import type { TokenPayload, StatusPayload, OutputPayload, ToolCallPayload } from "../../lib/relay";
import { colors, fonts, radius, space } from "../../lib/theme";
import { formatCost, getStatusColor } from "../../lib/format";

// ── Live output line ───────────────────────────────────────────────────────
interface LiveLine {
  id: string;
  text: string;
  ts: number;
  kind: "output" | "tool" | "status";
}

// ── Event row ──────────────────────────────────────────────────────────────
function EventRow({ event, last }: { event: TokenEvent; last: boolean }) {
  const cost = event.costUsd ?? 0;
  const costTint =
    cost > 0.01 ? colors.danger :
    cost > 0.005 ? colors.warning :
    colors.textSecondary;
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
      <Text style={[d.rowCost, { color: costTint }]}>{formatCost(cost)}</Text>
    </View>
  );
}

// ── Live feed line ─────────────────────────────────────────────────────────
function LiveLineRow({ line }: { line: LiveLine }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, []);

  const textColor =
    line.kind === "tool" ? colors.accent :
    line.kind === "status" ? colors.warning :
    colors.textSecondary;

  return (
    <Animated.View style={[d.liveLine, { opacity }]}>
      <Text style={d.liveTs}>
        {new Date(line.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </Text>
      <Text style={[d.liveText, { color: textColor }]} numberOfLines={2}>
        {line.text}
      </Text>
    </Animated.View>
  );
}

// ── Context warning ───────────────────────────────────────────────────────
function ContextWarning({ tokens }: { tokens: number }) {
  if (tokens < 50_000) return null;
  const isCritical = tokens >= 180_000;
  const color = isCritical ? colors.danger : colors.warning;
  return (
    <View style={[d.warn, { borderLeftColor: color, backgroundColor: isCritical ? colors.dangerMuted : colors.warningMuted }]}>
      <Text style={[d.warnTitle, { color }]}>
        {isCritical ? "CONTEXT CRITICAL" : "CONTEXT HIGH"}
      </Text>
      <Text style={d.warnText}>
        {(tokens / 1000).toFixed(0)}K tokens —{" "}
        {isCritical ? "Compact now · cuts costs 50–70%" : "Consider compacting to save tokens"}
      </Text>
    </View>
  );
}

// ── Command button ────────────────────────────────────────────────────────
function CmdBtn({ label, color, onPress, disabled }: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[d.cmdBtn, { borderColor: color + "30", opacity: disabled ? 0.4 : 1 }]}
      onPress={onPress}
      activeOpacity={0.65}
      disabled={disabled}
    >
      <Text style={[d.cmdText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Error state ───────────────────────────────────────────────────────────
// BUG-33
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={d.center}>
      <Text style={d.errText}>LOAD FAILED</Text>
      <TouchableOpacity onPress={onRetry} style={d.errBackBtn}>
        <Text style={d.errBackText}>RETRY</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
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
  const [error, setError] = useState(false);

  // BUG-18 + GAP-01: live relay events
  const [liveLines, setLiveLines] = useState<LiveLine[]>([]);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveCost, setLiveCost] = useState(0); // accumulated cost from relay tokens
  const liveScrollRef = useRef<ScrollView>(null);

  // BUG-13: AbortController timeout
  const load = useCallback(async (silent = false) => {
    if (!id || id === "undefined") { setLoading(false); return; }
    if (!silent) setLoading(true);
    setError(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const [sessionResult, eventsResult] = await Promise.allSettled([
        apiClient.getSession(id),
        apiClient.getEvents(id),
      ]);
      if (sessionResult.status === "fulfilled") {
        setSession(sessionResult.value);
      } else {
        console.error("[session]", sessionResult.reason);
        setError(true);
      }
      if (eventsResult.status === "fulfilled") {
        setEvents(eventsResult.value.events || []);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        console.error("[session]", e);
        setError(true);
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  // ── Wire relay live events (BUG-18 + GAP-01) ──────────────────────────
  useEffect(() => {
    const { client } = relay;
    if (!client) return;

    const addLine = (line: LiveLine) => {
      setLiveLines((prev) => {
        const next = [...prev, line];
        return next.length > 200 ? next.slice(next.length - 200) : next;
      });
      // Auto-scroll
      setTimeout(() => liveScrollRef.current?.scrollToEnd({ animated: true }), 50);
    };

    const onOutput = (p: OutputPayload) => {
      addLine({ id: `o-${p.timestamp}-${Math.random()}`, text: p.line, ts: p.timestamp, kind: "output" });
    };

    const onTokens = (p: TokenPayload) => {
      setLiveCost((prev) => prev + p.costUsd);
      const text = `${p.model} · ↑${(p.inputTokens / 1000).toFixed(1)}K ↓${(p.outputTokens / 1000).toFixed(1)}K · ${formatCost(p.costUsd)}`;
      addLine({ id: `t-${p.timestamp}-${Math.random()}`, text, ts: p.timestamp, kind: "tool" });
    };

    const onStatus = (p: StatusPayload) => {
      setLiveStatus(p.agentStatus);
      const text = `STATUS → ${p.agentStatus}${p.currentTask ? ` · ${p.currentTask}` : ""}`;
      addLine({ id: `s-${Date.now()}-${Math.random()}`, text, ts: Date.now(), kind: "status" });
    };

    const onToolCall = (p: ToolCallPayload) => {
      addLine({ id: `tc-${p.timestamp}-${Math.random()}`, text: `⚡ ${p.tool}${p.input ? `: ${p.input.slice(0, 80)}` : ""}`, ts: p.timestamp, kind: "tool" });
    };

    client.on("output", onOutput);
    client.on("tokens", onTokens);
    client.on("status", onStatus);
    client.on("tool_call", onToolCall);

    return () => {
      client.off("output", onOutput);
      client.off("tokens", onTokens);
      client.off("status", onStatus);
      client.off("tool_call", onToolCall);
    };
  }, [relay.client]);

  const sendCmd = useCallback((action: "pause" | "resume" | "compact" | "switch_model" | "status") => {
    if (!relay.client) {
      Alert.alert("Not Connected", "Connect the relay first to send commands.");
      return;
    }
    relay.client.sendCommand(action);
  }, [relay.client]);

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

  // ── Guard: invalid id ──────────────────────────────────────────────────
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

  if (error && !session) {
    return (
      <View style={[d.root, d.center]}>
        <Stack.Screen options={headerOpts} />
        <ErrorState onRetry={() => load(false)} />
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

  const totalCost = parseFloat(session.totalCost || "0") + liveCost;
  const totalTokens = session.totalTokens || 0;
  const effectiveStatus = liveStatus ?? session.status;
  const isActive = effectiveStatus === "active" || effectiveStatus === "working";
  const statusColor = getStatusColor(effectiveStatus);
  const reversedEvents = useMemo(() => events.slice().reverse(), [events]);
  const relayConnected = relay.isConnected;

  return (
    <View style={[d.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          ...headerOpts,
          headerRight: () => (
            <View style={d.statusBadge}>
              {relayConnected && <View style={d.liveDot} />}
              <View style={[d.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[d.statusLabel, { color: statusColor }]}>
                {effectiveStatus.toUpperCase()}
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
            onRefresh={() => { setRefreshing(true); load(false); }}
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
            <Text style={d.statLabel}>RELAY</Text>
            <Text style={[d.statValue, { color: relayConnected ? colors.success : colors.textTertiary }]}>
              {relayConnected ? "LIVE" : "OFF"}
            </Text>
          </View>
        </View>

        <View style={d.divider} />

        {/* ── Context warning ── */}
        <ContextWarning tokens={totalTokens} />

        {/* ── Commands ── */}
        <Text style={d.sectionLabel}>COMMANDS</Text>
        <View style={d.cmdRow}>
          <CmdBtn
            label="COMPACT"
            color={colors.textSecondary}
            onPress={() => sendCmd("compact")}
          />
          {isActive
            ? <CmdBtn label="PAUSE" color={colors.warning} onPress={() => sendCmd("pause")} />
            : <CmdBtn label="RESUME" color={colors.success} onPress={() => sendCmd("resume")} />
          }
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
                  onPress: () => apiClient.patchSessionStatus(id, "ended").then(() => load(false)),
                },
              ])
            }
          />
        </View>

        <View style={d.divider} />

        {/* ── Live output feed (BUG-18 + GAP-01) ── */}
        {liveLines.length > 0 && (
          <>
            <View style={d.feedHead}>
              <Text style={d.sectionLabel}>LIVE OUTPUT</Text>
              <View style={d.liveIndicator}>
                <View style={d.livePulseDot} />
                <Text style={d.livePulseText}>STREAMING</Text>
              </View>
            </View>
            <ScrollView
              ref={liveScrollRef}
              style={d.liveFeed}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {liveLines.map((line) => <LiveLineRow key={line.id} line={line} />)}
            </ScrollView>
            <View style={d.divider} />
          </>
        )}

        {/* ── API call feed ── */}
        <View style={d.feedHead}>
          <Text style={d.sectionLabel}>API CALLS</Text>
          <Text style={d.feedCount}>{events.length}</Text>
        </View>

        {events.length === 0 ? (
          <View style={d.empty}>
            <Text style={d.emptyTitle}>NO CALLS YET</Text>
            <Text style={d.emptySub}>
              {relayConnected ? "Waiting for agent activity…" : "LLM calls appear here in real-time"}
            </Text>
          </View>
        ) : (
          <View>
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
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 2,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 8,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },

  // Error
  errText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
  errBackBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    borderRadius: 2,
  },
  errBackText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
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
    fontSize: 8,
    letterSpacing: 1.6,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sessionName: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: "400",
    letterSpacing: -0.6,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 6,
  },
  sessionModel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },
  heroCost: {
    fontFamily: fonts.sans,
    fontSize: 28,
    fontWeight: "300",
    letterSpacing: -1.5,
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
    fontSize: 8,
    letterSpacing: 1.6,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  statValue: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: -0.4,
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
    marginVertical: space.sm,
    paddingLeft: space.md,
    paddingVertical: 10,
    paddingRight: space.md,
    borderRadius: 2,
  },
  warnTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  warnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },

  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },

  // Commands
  cmdRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  cmdBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  cmdText: {
    fontFamily: fonts.sansMedium,
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // Live feed
  feedHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: space.lg,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: space.lg,
  },
  livePulseDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  livePulseText: {
    fontFamily: fonts.sansMedium,
    fontSize: 7,
    letterSpacing: 1.4,
    color: colors.success,
    textTransform: "uppercase",
  },
  liveFeed: {
    maxHeight: 200,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  liveLine: {
    flexDirection: "row",
    paddingHorizontal: space.lg,
    paddingVertical: 6,
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  liveTs: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textTertiary,
    width: 60,
    paddingTop: 1,
  },
  liveText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },

  // Feed / table
  feedCount: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
    marginRight: space.lg,
  },
  tableHead: { backgroundColor: colors.surfaceRaised },
  headCell: {
    fontFamily: fonts.sansMedium,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
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
    fontSize: 9,
    color: colors.textTertiary,
  },
  rowBody: { flex: 1 },
  rowModel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
  },
  rowTokens: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 2,
  },
  rowCost: {
    width: 72,
    textAlign: "right",
    fontFamily: fonts.mono,
    fontSize: 11,
  },

  // Empty
  empty: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
  emptySub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: "center",
  },
});
