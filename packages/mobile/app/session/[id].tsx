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

const AGENT_META: Record<string, { color: string; label: string }> = {
  claude:   { color: "#D4B896", label: "Claude Code" },
  opencode: { color: "#7C83FD", label: "OpenCode" },
  codex:    { color: "#10A37F", label: "Codex CLI" },
  gemini:   { color: "#4285F4", label: "Gemini CLI" },
  aider:    { color: "#22c55e", label: "Aider" },
};

function getAgent(type: string) {
  return AGENT_META[type] ?? { color: "#888", label: type };
}

function EventRow({ event }: { event: TokenEvent }) {
  const cost = event.costUsd ?? 0;
  const costColor = cost > 0.01 ? "#ef4444" : cost > 0.005 ? "#f59e0b" : "#22c55e";
  const time = new Date(event.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const inK = (event.inputTokens / 1000).toFixed(1);
  const outK = (event.outputTokens / 1000).toFixed(1);

  return (
    <View style={styles.eventRow}>
      <View style={styles.eventLeft}>
        <Text style={styles.eventTime}>{time}</Text>
        <Text style={styles.eventModel} numberOfLines={1}>{event.model}</Text>
      </View>
      <View style={styles.eventMid}>
        <Text style={styles.eventTokens}>↑{inK}K</Text>
        <Text style={styles.eventSep}>·</Text>
        <Text style={styles.eventTokens}>↓{outK}K</Text>
      </View>
      <Text style={[styles.eventCost, { color: costColor }]}>${cost.toFixed(5)}</Text>
    </View>
  );
}

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

  const sendCmd = (action: string, cmdParams?: Record<string, unknown>) => {
    relay.client?.sendCommand(action as any, cmdParams);
  };

  if (!id || id === "undefined") {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: "Session", headerStyle: { backgroundColor: "#141414" }, headerTintColor: "#aaa" }} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Invalid session ID</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.goBackBtn}>
            <Text style={styles.goBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ title: "Loading…", headerStyle: { backgroundColor: "#141414" }, headerTintColor: "#aaa" }} />
        <ActivityIndicator color="#888" size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ title: "Not found", headerStyle: { backgroundColor: "#141414" }, headerTintColor: "#aaa" }} />
        <Text style={styles.errorText}>Session not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.goBackBtn}>
          <Text style={styles.goBackText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const agent = getAgent(session.agentType);
  const totalCost = parseFloat(session.totalCost || "0");
  const totalTokens = session.totalTokens || 0;
  const totalK = (totalTokens / 1000).toFixed(1);
  const isActive = session.status === "active";

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          title: "",
          headerStyle: { backgroundColor: "#141414" },
          headerShadowVisible: false,
          headerTintColor: "#aaa",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={[styles.statusBadge, { backgroundColor: isActive ? "#22c55e18" : "#25252520" }]}>
              <View style={[styles.statusDot, { backgroundColor: isActive ? "#22c55e" : "#333" }]} />
              <Text style={[styles.statusText, { color: isActive ? "#22c55e" : "#555" }]}>
                {isActive ? "Active" : "Ended"}
              </Text>
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor="#555"
          />
        }
      >
        {/* Session title area */}
        <View style={styles.titleArea}>
          <View style={[styles.agentTag, { backgroundColor: `${agent.color}18` }]}>
            <Text style={[styles.agentTagText, { color: agent.color }]}>{agent.label}</Text>
          </View>
          <Text style={styles.sessionTitle} numberOfLines={2}>{session.name}</Text>
          <Text style={styles.sessionModel}>{session.model}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total cost</Text>
            <Text style={[styles.statValue, {
              color: totalCost > 1 ? "#ef4444" : totalCost > 0.1 ? "#f59e0b" : "#e0e0e0"
            }]}>
              ${totalCost.toFixed(4)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tokens</Text>
            <Text style={styles.statValue}>{totalK}K</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>API calls</Text>
            <Text style={styles.statValue}>{events.length}</Text>
          </View>
        </View>

        {/* Context warning */}
        {totalTokens >= 50_000 && (
          <View style={[styles.ctxWarn, {
            borderLeftColor: totalTokens >= 200_000 ? "#ef4444" : "#f59e0b",
          }]}>
            <Text style={[styles.ctxWarnTitle, { color: totalTokens >= 200_000 ? "#ef4444" : "#f59e0b" }]}>
              {totalTokens >= 200_000 ? "Context critical" : "Context high"}
            </Text>
            <Text style={styles.ctxWarnText}>
              {totalK}K tokens — {totalTokens >= 200_000 ? "compact now to cut costs 50–70%" : "consider compacting soon"}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => sendCmd("compact")}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnText}>Compact</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => sendCmd("pause")}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnText}>Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => sendCmd("status")}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnText}>Status</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            activeOpacity={0.7}
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
          >
            <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>End</Text>
          </TouchableOpacity>
        </View>

        {/* Event feed */}
        <View style={styles.feedSection}>
          <View style={styles.feedHeader}>
            <Text style={styles.feedTitle}>API calls</Text>
            <Text style={styles.feedCount}>{events.length} total</Text>
          </View>

          {events.length === 0 ? (
            <View style={styles.emptyFeed}>
              <Text style={styles.emptyText}>No API calls yet</Text>
              <Text style={styles.emptySubText}>LLM calls appear here in real-time</Text>
            </View>
          ) : (
            <View style={styles.feedCard}>
              <View style={styles.feedHeadRow}>
                <Text style={[styles.feedHeadCell, { width: 70 }]}>Time</Text>
                <Text style={[styles.feedHeadCell, { flex: 1 }]}>Model</Text>
                <Text style={[styles.feedHeadCell, { width: 80, textAlign: "center" }]}>Tokens</Text>
                <Text style={[styles.feedHeadCell, { width: 64, textAlign: "right" }]}>Cost</Text>
              </View>
              {events.slice().reverse().map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#141414" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  backBtn: { paddingHorizontal: 4 },
  backArrow: { color: "#aaa", fontSize: 18 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "500" },

  errorText: { color: "#666", fontSize: 15, marginBottom: 16 },
  goBackBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#303030",
  },
  goBackText: { color: "#888", fontSize: 14 },

  // Title area
  titleArea: { marginBottom: 20 },
  agentTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 10,
  },
  agentTagText: { fontSize: 12, fontWeight: "500" },
  sessionTitle: { color: "#e8e8e8", fontSize: 20, fontWeight: "600", lineHeight: 26, marginBottom: 6 },
  sessionModel: { color: "#444", fontSize: 12 },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1c1c1c",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#252525",
  },
  statLabel: { color: "#555", fontSize: 11, marginBottom: 6 },
  statValue: { color: "#e0e0e0", fontSize: 17, fontWeight: "600" },

  // Context warning
  ctxWarn: {
    borderLeftWidth: 3,
    backgroundColor: "#1c1c1c",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  ctxWarnTitle: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  ctxWarnText: { color: "#666", fontSize: 12, lineHeight: 18 },

  // Actions
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1c1c1c",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    alignItems: "center",
  },
  actionBtnText: { color: "#888", fontSize: 13, fontWeight: "500" },
  actionBtnDanger: { borderColor: "#ef444428", backgroundColor: "#ef444408" },
  actionBtnDangerText: { color: "#ef4444" },

  // Feed
  feedSection: {},
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  feedTitle: { color: "#666", fontSize: 12, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  feedCount: { color: "#444", fontSize: 12 },

  feedCard: {
    backgroundColor: "#1c1c1c",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#252525",
    overflow: "hidden",
  },
  feedHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#252525",
    backgroundColor: "#181818",
  },
  feedHeadCell: { color: "#444", fontSize: 10, letterSpacing: 0.5 },

  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
    gap: 8,
  },
  eventLeft: { width: 70 },
  eventTime: { color: "#444", fontSize: 10, marginBottom: 2 },
  eventModel: { color: "#777", fontSize: 11 },
  eventMid: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  eventTokens: { color: "#555", fontSize: 11 },
  eventSep: { color: "#333" },
  eventCost: { width: 64, textAlign: "right", fontSize: 12, fontWeight: "600" },

  // Empty feed
  emptyFeed: {
    backgroundColor: "#1c1c1c",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#252525",
    padding: 32,
    alignItems: "center",
  },
  emptyText: { color: "#555", fontSize: 14, marginBottom: 6 },
  emptySubText: { color: "#3a3a3a", fontSize: 12, textAlign: "center" },
});
