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
import { colors, spacing, radius } from "../../lib/theme";
import { apiClient, type AgentSession, type TokenEvent } from "../../lib/api";
import { useRelay } from "../../lib/relay-context";

const AGENT_META: Record<string, { color: string; label: string; logo: string }> = {
  claude: { color: "#D4B896", label: "Claude Code", logo: "✦" },
  opencode: { color: "#7C83FD", label: "OpenCode", logo: "</>" },
  codex: { color: "#10A37F", label: "Codex CLI", logo: "⬡" },
  gemini: { color: "#4285F4", label: "Gemini CLI", logo: "◈" },
  aider: { color: "#22c55e", label: "Aider", logo: "⌥" },
};

function getAgent(type: string) {
  return AGENT_META[type] ?? { color: colors.accent, label: type, logo: "▣" };
}

function ToolCallRow({ event }: { event: TokenEvent }) {
  const cost = event.costUsd ?? 0;
  const costColor = cost > 0.01 ? colors.danger : cost > 0.005 ? colors.warning : "#22c55e";
  const time = new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const inK = (event.inputTokens / 1000).toFixed(1);
  const outK = (event.outputTokens / 1000).toFixed(1);

  return (
    <View style={styles.tcRow}>
      <View style={styles.tcLeft}>
        <Text style={styles.tcTime}>{time}</Text>
        <Text style={styles.tcModel} numberOfLines={1}>{event.model}</Text>
      </View>
      <View style={styles.tcMid}>
        <Text style={styles.tcTokens}>↑{inK}K</Text>
        <Text style={styles.tcSep}>·</Text>
        <Text style={styles.tcTokens}>↓{outK}K</Text>
      </View>
      <Text style={[styles.tcCost, { color: costColor }]}>${cost.toFixed(5)}</Text>
    </View>
  );
}

function StatBox({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CmdBtn({ label, sub, color, onPress }: { label: string; sub: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.cmdBtn, { borderColor: `${color}30`, backgroundColor: `${color}08` }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.cmdLabel, { color }]}>{label}</Text>
      <Text style={styles.cmdSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

export default function SessionDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  // Fix: guard against undefined id
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const relay = useRelay();
  const [session, setSession] = useState<AgentSession | null>(null);
  const [events, setEvents] = useState<TokenEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
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
  }, [id]);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const sendCmd = (action: string, params?: Record<string, unknown>) => {
    relay.client?.sendCommand(action as any, params);
  };

  if (!id || id === "undefined") {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: "Session", headerStyle: { backgroundColor: "#0c0c0e" }, headerTintColor: colors.text }} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Invalid session ID</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ title: "Loading…", headerStyle: { backgroundColor: "#0c0c0e" }, headerTintColor: colors.text }} />
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ title: "Not Found", headerStyle: { backgroundColor: "#0c0c0e" }, headerTintColor: colors.text }} />
        <Text style={styles.errorText}>Session not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const agent = getAgent(session.agentType);
  const totalCost = parseFloat(session.totalCost || "0");
  const totalTokens = session.totalTokens || 0;
  const totalK = (totalTokens / 1000).toFixed(1);

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "",
          headerStyle: { backgroundColor: "#0c0c0e" },
          headerTintColor: colors.text,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 4, paddingRight: 8 }}>
              <Text style={{ color: agent.color, fontFamily: "monospace", fontSize: 18 }}>←</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={agent.color}
          />
        }
      >
        {/* Agent header */}
        <View style={[styles.agentHeader, { borderColor: `${agent.color}30`, backgroundColor: `${agent.color}06` }]}>
          <View style={[styles.agentLogo, { backgroundColor: `${agent.color}15` }]}>
            <Text style={[styles.agentLogoText, { color: agent.color }]}>{agent.logo}</Text>
          </View>
          <View style={styles.agentHeaderInfo}>
            <Text style={[styles.agentName, { color: agent.color }]}>{agent.label}</Text>
            <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>
            <View style={styles.sessionMetaRow}>
              <View style={[styles.statusPill, {
                backgroundColor: session.status === "active" ? "#22c55e15" : "#44444415"
              }]}>
                <View style={[styles.statusDot, {
                  backgroundColor: session.status === "active" ? "#22c55e" : "#555"
                }]} />
                <Text style={[styles.statusText, {
                  color: session.status === "active" ? "#22c55e" : "#555"
                }]}>{session.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.modelLabel}>{session.model}</Text>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatBox value={`$${totalCost.toFixed(4)}`} label="TOTAL COST" color={totalCost > 1 ? colors.danger : totalCost > 0.1 ? colors.warning : "#22c55e"} />
          <StatBox value={`${totalK}K`} label="TOKENS" />
          <StatBox value={String(events.length)} label="CALLS" />
        </View>

        {/* Command strip */}
        <View style={styles.cmdStrip}>
          <Text style={styles.stripLabel}>COMMANDS</Text>
          <View style={styles.cmdRow}>
            <CmdBtn label="PAUSE" sub="interrupt" color={colors.warning} onPress={() => sendCmd("pause")} />
            <CmdBtn label="COMPACT" sub="save ctx" color={agent.color} onPress={() => sendCmd("compact")} />
            <CmdBtn label="STATUS" sub="ping" color={colors.tertiary} onPress={() => sendCmd("status")} />
            <CmdBtn
              label="END"
              sub="terminate"
              color={colors.danger}
              onPress={() =>
                Alert.alert("End Session", "Terminate this agent session?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "End",
                    style: "destructive",
                    onPress: () => {
                      apiClient.patchSessionStatus(id, "ended").then(() => load(true));
                    },
                  },
                ])
              }
            />
          </View>
        </View>

        {/* Context warning */}
        {totalTokens >= 50_000 && (
          <View style={[styles.ctxWarn, {
            borderLeftColor: totalTokens >= 200_000 ? colors.danger : colors.warning,
            backgroundColor: totalTokens >= 200_000 ? "#ef444408" : "#f59e0b08",
          }]}>
            <Text style={[styles.ctxWarnTitle, { color: totalTokens >= 200_000 ? colors.danger : colors.warning }]}>
              {totalTokens >= 200_000 ? "⛔  CONTEXT CRITICAL" : "⚠  CONTEXT HIGH"}
            </Text>
            <Text style={styles.ctxWarnSub}>
              {totalK}K tokens — {totalTokens >= 200_000 ? "compact now to cut costs 50–70%" : "consider compacting soon"}
            </Text>
          </View>
        )}

        {/* Tool call feed */}
        <View style={styles.feedHeader}>
          <Text style={styles.feedTitle}>TOOL CALL FEED</Text>
          <Text style={styles.feedCount}>{events.length} calls</Text>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyFeed}>
            <Text style={styles.emptyIcon}>◌</Text>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptySub}>LLM calls appear here in real-time</Text>
          </View>
        ) : (
          <View style={styles.feed}>
            {/* Feed header row */}
            <View style={styles.feedRowHeader}>
              <Text style={[styles.feedColLabel, { width: 60 }]}>TIME</Text>
              <Text style={[styles.feedColLabel, { flex: 1 }]}>MODEL</Text>
              <Text style={[styles.feedColLabel, { width: 80, textAlign: "center" }]}>TOKENS</Text>
              <Text style={[styles.feedColLabel, { width: 64, textAlign: "right" }]}>COST</Text>
            </View>
            {events
              .slice()
              .reverse()
              .map((e) => (
                <ToolCallRow key={e.id} event={e} />
              ))}
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c0c0e" },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.md, paddingBottom: 40 },

  errorText: { color: "#555", fontFamily: "monospace", fontSize: 14, marginBottom: 16 },
  backBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: radius.sm, borderWidth: 1, borderColor: "#333" },
  backBtnText: { color: colors.accent, fontFamily: "monospace", fontSize: 13 },

  // Agent header
  agentHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  agentLogo: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  agentLogoText: { fontSize: 24, fontFamily: "monospace", fontWeight: "700" },
  agentHeaderInfo: { flex: 1 },
  agentName: { fontSize: 10, fontFamily: "monospace", letterSpacing: 2, marginBottom: 3 },
  sessionName: { color: "#e0e0e0", fontSize: 16, fontFamily: "monospace", fontWeight: "700", marginBottom: 6 },
  sessionMetaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontFamily: "monospace", fontWeight: "700", letterSpacing: 1 },
  modelLabel: { color: "#333", fontSize: 10, fontFamily: "monospace" },

  // Stats
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: "#111114",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#1e1e22",
    padding: spacing.sm,
    alignItems: "center",
    paddingVertical: 14,
  },
  statValue: { color: "#e0e0e0", fontSize: 15, fontFamily: "monospace", fontWeight: "700", marginBottom: 4 },
  statLabel: { color: "#333", fontSize: 8, fontFamily: "monospace", letterSpacing: 1.5 },

  // Commands
  cmdStrip: { marginBottom: spacing.md },
  stripLabel: { color: "#333", fontSize: 9, fontFamily: "monospace", letterSpacing: 2, marginBottom: spacing.sm },
  cmdRow: { flexDirection: "row", gap: spacing.sm },
  cmdBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
  cmdLabel: { fontSize: 9, fontFamily: "monospace", fontWeight: "900", letterSpacing: 0.5 },
  cmdSub: { color: "#333", fontSize: 8, fontFamily: "monospace", marginTop: 2 },

  // Context warning
  ctxWarn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderLeftWidth: 3,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  ctxWarnTitle: { fontSize: 10, fontFamily: "monospace", fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  ctxWarnSub: { color: "#555", fontSize: 11, fontFamily: "monospace" },

  // Feed
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  feedTitle: { color: "#333", fontSize: 9, fontFamily: "monospace", letterSpacing: 2 },
  feedCount: { color: "#333", fontSize: 9, fontFamily: "monospace" },
  feed: {
    backgroundColor: "#0e0e11",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#1a1a1e",
    overflow: "hidden",
  },
  feedRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1e",
    backgroundColor: "#0c0c0e",
  },
  feedColLabel: { color: "#2a2a2a", fontSize: 8, fontFamily: "monospace", letterSpacing: 1.5 },

  tcRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#111114",
    gap: spacing.sm,
  },
  tcLeft: { width: 60 },
  tcTime: { color: "#333", fontSize: 9, fontFamily: "monospace", marginBottom: 2 },
  tcModel: { color: "#555", fontSize: 10, fontFamily: "monospace" },
  tcMid: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  tcTokens: { color: "#444", fontSize: 10, fontFamily: "monospace" },
  tcSep: { color: "#2a2a2a" },
  tcCost: { width: 64, textAlign: "right", fontSize: 11, fontFamily: "monospace", fontWeight: "700" },

  // Empty
  emptyFeed: {
    backgroundColor: "#0e0e11",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#1a1a1e",
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyIcon: { color: "#222", fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: { color: "#444", fontFamily: "monospace", fontSize: 13, marginBottom: 6 },
  emptySub: { color: "#2a2a2a", fontFamily: "monospace", fontSize: 10, textAlign: "center" },
});
