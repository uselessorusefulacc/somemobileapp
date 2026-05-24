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

// ── Types ─────────────────────────────────────────────────────────────────
interface LiveLine {
  id: string;
  text: string;
  ts: number;
  kind: "output" | "tool" | "status";
}

// ── Pulsing dot ───────────────────────────────────────────────────────────
function PulseDot({ color, size = 6 }: { color: string; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 2.2, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(500),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute", width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, opacity, transform: [{ scale }],
      }} />
      <View style={{ width: size * 0.55, height: size * 0.55, borderRadius: size * 0.275, backgroundColor: color }} />
    </View>
  );
}

// ── Event row ─────────────────────────────────────────────────────────────
function EventRow({ event, last }: { event: TokenEvent; last: boolean }) {
  const cost = event.costUsd ?? 0;
  const costTint = cost > 0.01 ? colors.danger : cost > 0.005 ? colors.warning : colors.textSecondary;
  const time = new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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

// ── Live line row ─────────────────────────────────────────────────────────
function LiveLineRow({ line }: { line: LiveLine }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);
  const textColor =
    line.kind === "tool" ? colors.accent :
    line.kind === "status" ? colors.warning :
    colors.textSecondary;
  const prefix = line.kind === "tool" ? "⚡ " : line.kind === "status" ? "◆ " : "› ";
  return (
    <Animated.View style={[d.liveLine, { opacity }]}>
      <Text style={d.liveTs}>
        {new Date(line.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </Text>
      <Text style={[d.liveText, { color: textColor }]} numberOfLines={3}>
        {prefix}{line.text}
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
    <View style={[d.warn, { borderColor: color + "40", backgroundColor: color + "0D" }]}>
      <View style={[d.warnStripe, { backgroundColor: color }]} />
      <View style={d.warnBody}>
        <Text style={[d.warnTitle, { color }]}>
          {isCritical ? "⚠ CONTEXT CRITICAL" : "▲ CONTEXT HIGH"}
        </Text>
        <Text style={d.warnText}>
          {(tokens / 1000).toFixed(0)}K tokens —{" "}
          {isCritical ? "Compact now · saves 50–70%" : "Consider compacting to save tokens"}
        </Text>
      </View>
    </View>
  );
}

// ── Command button ────────────────────────────────────────────────────────
function CmdBtn({ label, color, onPress, disabled }: { label: string; color: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[d.cmdBtn, { borderColor: color + "50", backgroundColor: color + "10", opacity: disabled ? 0.4 : 1 }]}
      onPress={onPress}
      activeOpacity={0.65}
      disabled={disabled}
    >
      <Text style={[d.cmdText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Error state ───────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={d.center}>
      <View style={d.errorIcon}><Text style={d.errorIconText}>!</Text></View>
      <Text style={d.errText}>LOAD FAILED</Text>
      <TouchableOpacity onPress={onRetry} style={d.errBackBtn}>
        <Text style={d.errBackText}>↻  RETRY</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, valueColor, accent }: { label: string; value: string; valueColor?: string; accent?: string }) {
  return (
    <View style={[d.statCard, accent && { borderColor: accent + "50" }]}>
      {accent && <View style={[d.statCardGlow, { backgroundColor: accent + "0A" }]} />}
      <Text style={d.statCardLabel}>{label}</Text>
      <Text style={[d.statCardValue, valueColor && { color: valueColor }]}>{value}</Text>
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

  const [liveLines, setLiveLines] = useState<LiveLine[]>([]);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveCost, setLiveCost] = useState(0);
  const liveScrollRef = useRef<ScrollView>(null);
  const headerOpacity = useRef(new Animated.Value(0)).current;

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
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      } else {
        setError(true);
      }
      if (eventsResult.status === "fulfilled") {
        setEvents(eventsResult.value.events || []);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(true);
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  // ── Wire relay ────────────────────────────────────────────────────────
  useEffect(() => {
    const { client } = relay;
    if (!client) return;
    const addLine = (line: LiveLine) => {
      setLiveLines((prev) => {
        const next = [...prev, line];
        return next.length > 200 ? next.slice(next.length - 200) : next;
      });
      setTimeout(() => liveScrollRef.current?.scrollToEnd({ animated: true }), 50);
    };
    const onOutput = (p: OutputPayload) => addLine({ id: `o-${p.timestamp}-${Math.random()}`, text: p.line, ts: p.timestamp, kind: "output" });
    const onTokens = (p: TokenPayload) => {
      setLiveCost((prev) => prev + p.costUsd);
      addLine({ id: `t-${p.timestamp}-${Math.random()}`, text: `${p.model} · ↑${(p.inputTokens / 1000).toFixed(1)}K ↓${(p.outputTokens / 1000).toFixed(1)}K · ${formatCost(p.costUsd)}`, ts: p.timestamp, kind: "tool" });
    };
    const onStatus = (p: StatusPayload) => {
      setLiveStatus(p.agentStatus);
      addLine({ id: `s-${Date.now()}-${Math.random()}`, text: `STATUS → ${p.agentStatus}${p.currentTask ? ` · ${p.currentTask}` : ""}`, ts: Date.now(), kind: "status" });
    };
    const onToolCall = (p: ToolCallPayload) => addLine({ id: `tc-${p.timestamp}-${Math.random()}`, text: `${p.tool}${p.input ? `: ${p.input.slice(0, 80)}` : ""}`, ts: p.timestamp, kind: "tool" });
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
        <ActivityIndicator color={colors.accent} />
        <Text style={d.loadText}>LOADING</Text>
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

  const costColor =
    totalCost > 1 ? colors.danger :
    totalCost > 0.1 ? colors.warning :
    colors.success;

  return (
    <View style={[d.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          ...headerOpts,
          headerRight: () => (
            <View style={d.statusBadge}>
              {relayConnected && <PulseDot color={colors.success} size={5} />}
              <View style={[d.statusPill, { borderColor: statusColor + "50", backgroundColor: statusColor + "15" }]}>
                {isActive && <PulseDot color={statusColor} size={5} />}
                {!isActive && <View style={[d.statusDot, { backgroundColor: statusColor }]} />}
                <Text style={[d.statusLabel, { color: statusColor }]}>
                  {effectiveStatus.toUpperCase()}
                </Text>
              </View>
            </View>
          ),
        }}
      />

      <ScrollView
        style={d.scroll}
        contentContainerStyle={d.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero header ── */}
        <Animated.View style={[d.header, { opacity: headerOpacity }]}>
          <View style={d.headerTop}>
            <View style={d.agentBadge}>
              <Text style={d.agentBadgeText}>{session.agentType.toUpperCase()}</Text>
            </View>
            {isActive && (
              <View style={d.liveBadge}>
                <PulseDot color={colors.success} size={5} />
                <Text style={d.liveBadgeText}>LIVE</Text>
              </View>
            )}
          </View>
          <Text style={d.sessionName} numberOfLines={2}>{session.name}</Text>
          <Text style={d.sessionModel}>{session.model}</Text>

          <View style={d.costRow}>
            <Text style={[d.heroCost, {
              color: costColor,
              textShadowColor: costColor + "60",
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 16,
            }]}>
              {formatCost(totalCost)}
            </Text>
            {liveCost > 0 && (
              <View style={d.liveCostBadge}>
                <Text style={d.liveCostText}>+{formatCost(liveCost)} live</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Accent divider ── */}
        <View style={d.accentDivider} />

        {/* ── Stat cards ── */}
        <View style={d.statGrid}>
          <StatCard
            label="TOKENS"
            value={`${(totalTokens / 1000).toFixed(1)}K`}
            accent={colors.accent}
          />
          <StatCard
            label="API CALLS"
            value={String(events.length)}
          />
          <StatCard
            label="RELAY"
            value={relayConnected ? "LIVE" : "OFF"}
            valueColor={relayConnected ? colors.success : colors.textTertiary}
            accent={relayConnected ? colors.success : undefined}
          />
        </View>

        {/* ── Context warning ── */}
        <ContextWarning tokens={totalTokens} />

        {/* ── Commands ── */}
        <View style={d.sectionHead}>
          <Text style={d.sectionLabel}>COMMANDS</Text>
          <View style={d.sectionLine} />
        </View>
        <View style={d.cmdRow}>
          <CmdBtn label="COMPACT" color={colors.textSecondary} onPress={() => sendCmd("compact")} />
          {isActive
            ? <CmdBtn label="PAUSE" color={colors.warning} onPress={() => sendCmd("pause")} />
            : <CmdBtn label="RESUME" color={colors.success} onPress={() => sendCmd("resume")} />
          }
          <CmdBtn label="STATUS" color={colors.accent} onPress={() => sendCmd("status")} />
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

        {/* ── Live output feed ── */}
        {liveLines.length > 0 && (
          <>
            <View style={d.sectionHead}>
              <Text style={[d.sectionLabel, { color: colors.success }]}>LIVE OUTPUT</Text>
              <View style={d.sectionLine} />
              <View style={d.streamingBadge}>
                <PulseDot color={colors.success} size={5} />
                <Text style={d.streamingText}>STREAMING</Text>
              </View>
            </View>
            <View style={d.liveFeedWrapper}>
              <ScrollView
                ref={liveScrollRef}
                style={d.liveFeed}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {liveLines.map((line) => <LiveLineRow key={line.id} line={line} />)}
              </ScrollView>
            </View>
          </>
        )}

        {/* ── API calls ── */}
        <View style={d.sectionHead}>
          <Text style={d.sectionLabel}>API CALLS</Text>
          <View style={d.sectionLine} />
          {events.length > 0 && <Text style={d.feedCount}>{events.length}</Text>}
        </View>

        {events.length === 0 ? (
          <View style={d.empty}>
            <Text style={d.emptyGlyph}>◎</Text>
            <Text style={d.emptyTitle}>NO CALLS YET</Text>
            <Text style={d.emptySub}>
              {relayConnected ? "Waiting for agent activity…" : "LLM calls appear here in real-time"}
            </Text>
          </View>
        ) : (
          <View style={d.tableBlock}>
            <View style={[d.row, d.tableHead]}>
              <Text style={[d.rowTime, d.headCell]}>TIME</Text>
              <View style={d.rowBody}><Text style={d.headCell}>MODEL</Text></View>
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
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  loadText: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 2, color: colors.textTertiary, textTransform: "uppercase" },

  backBtn: { paddingHorizontal: 4 },
  backArrow: { fontFamily: fonts.sans, fontSize: 20, color: colors.textSecondary, lineHeight: 24 },

  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginRight: 4 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2, borderWidth: 1,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.4, textTransform: "uppercase" },

  errorIcon: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerMuted,
    alignItems: "center", justifyContent: "center",
  },
  errorIconText: { fontFamily: fonts.sansMedium, fontSize: 20, color: colors.danger, lineHeight: 24 },
  errText: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.8, color: colors.textTertiary, textTransform: "uppercase" },
  errBackBtn: {
    borderWidth: 1, borderColor: colors.accentBorder, backgroundColor: colors.accentMuted,
    paddingHorizontal: space.lg, paddingVertical: 8, borderRadius: 2,
  },
  errBackText: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.4, color: colors.accent, textTransform: "uppercase" },

  // Header
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  agentBadge: {
    borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2,
  },
  agentBadgeText: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.6, color: colors.textTertiary, textTransform: "uppercase" },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: colors.successBorder, backgroundColor: colors.successMuted,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2,
  },
  liveBadgeText: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.4, color: colors.success, textTransform: "uppercase" },
  sessionName: {
    fontFamily: fonts.sans, fontSize: 22, fontWeight: "300",
    letterSpacing: -1, color: colors.text, lineHeight: 28, marginBottom: 6,
  },
  sessionModel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textTertiary, letterSpacing: 0.3, marginBottom: 12 },
  costRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  heroCost: { fontFamily: fonts.sans, fontSize: 36, fontWeight: "300", letterSpacing: -2, lineHeight: 40 },
  liveCostBadge: {
    borderWidth: 1, borderColor: colors.accentBorder, backgroundColor: colors.accentMuted,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2,
  },
  liveCostText: { fontFamily: fonts.mono, fontSize: 10, color: colors.accent },

  accentDivider: { height: 1, backgroundColor: colors.accent + "25", marginHorizontal: space.lg, marginVertical: space.sm },

  // Stat cards
  statGrid: { flexDirection: "row", gap: 8, paddingHorizontal: space.md, marginBottom: space.sm },
  statCard: {
    flex: 1, backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    padding: 10, minHeight: 58, justifyContent: "space-between", overflow: "hidden",
  },
  statCardGlow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.sm },
  statCardLabel: { fontFamily: fonts.sansMedium, fontSize: 7, letterSpacing: 1.6, color: colors.textTertiary, textTransform: "uppercase" },
  statCardValue: { fontFamily: fonts.sans, fontSize: 15, fontWeight: "300", letterSpacing: -0.5, color: colors.text },

  // Warn
  warn: {
    flexDirection: "row",
    marginHorizontal: space.lg, marginVertical: space.sm,
    borderWidth: 1, borderRadius: radius.sm, overflow: "hidden",
  },
  warnStripe: { width: 3 },
  warnBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  warnTitle: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 4 },
  warnText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  // Section
  sectionHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, marginTop: space.md, marginBottom: 4, gap: 10 },
  sectionLabel: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 2.0, color: colors.textTertiary, textTransform: "uppercase", flexShrink: 0 },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },
  streamingBadge: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  streamingText: { fontFamily: fonts.sansMedium, fontSize: 7, letterSpacing: 1.4, color: colors.success, textTransform: "uppercase" },

  // Commands
  cmdRow: { flexDirection: "row", gap: 6, paddingHorizontal: space.lg, paddingBottom: space.sm },
  cmdBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.sm,
    borderWidth: 1, alignItems: "center",
  },
  cmdText: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.2, textTransform: "uppercase" },

  // Live feed
  liveFeedWrapper: {
    marginHorizontal: space.md, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.successBorder,
    backgroundColor: "#001A0D",
    overflow: "hidden", marginBottom: space.sm,
  },
  liveFeed: { maxHeight: 220 },
  liveLine: {
    flexDirection: "row", paddingHorizontal: 12, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: colors.border + "80",
    gap: 10,
  },
  liveTs: { fontFamily: fonts.mono, fontSize: 9, color: colors.textTertiary + "80", width: 58, paddingTop: 1 },
  liveText: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, flex: 1 },

  feedCount: { fontFamily: fonts.mono, fontSize: 10, color: colors.textTertiary, flexShrink: 0 },

  // Table
  tableBlock: {
    marginHorizontal: space.md, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    overflow: "hidden",
  },
  tableHead: { backgroundColor: colors.surfaceRaised, borderBottomWidth: 1, borderBottomColor: colors.border },
  headCell: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.4, color: colors.textTertiary, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: space.md, gap: space.sm },
  rowTime: { width: 56, fontFamily: fonts.mono, fontSize: 9, color: colors.textTertiary },
  rowBody: { flex: 1 },
  rowModel: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  rowTokens: { fontFamily: fonts.mono, fontSize: 9, color: colors.textTertiary, marginTop: 2 },
  rowCost: { width: 68, textAlign: "right", fontFamily: fonts.mono, fontSize: 11 },

  // Empty
  empty: { paddingVertical: 40, alignItems: "center", gap: 8 },
  emptyGlyph: { fontFamily: fonts.sans, fontSize: 24, color: colors.textTertiary, marginBottom: 4 },
  emptyTitle: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.8, color: colors.textTertiary, textTransform: "uppercase" },
  emptySub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textTertiary, textAlign: "center" },
});
