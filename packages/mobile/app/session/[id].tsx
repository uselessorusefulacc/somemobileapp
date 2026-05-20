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

const CTX_WARN = 50_000;
const CTX_CRITICAL = 200_000;

function CommandButton({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.cmdBtn, { backgroundColor: `${color}12`, borderColor: `${color}30` }]} onPress={onPress} activeOpacity={0.7}>
      <Text style={{ fontSize: 16, marginBottom: 2 }}>{icon}</Text>
      <Text style={[styles.cmdLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EventRow({ event }: { event: TokenEvent }) {
  const cost = event.costUsd ?? 0;
  const costColor = cost > 0.01 ? colors.danger : cost > 0.005 ? colors.warning : colors.success;
  const time = new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <View style={styles.eventRow}>
      <View style={styles.eventLeft}>
        <Text style={styles.eventTime}>{time}</Text>
        <View style={styles.eventMeta}>
          <Text style={styles.eventModel} numberOfLines={1}>{event.model}</Text>
          <Text style={styles.eventSep}>·</Text>
          <Text style={styles.eventTokens}>↑{event.inputTokens.toLocaleString()} ↓{event.outputTokens.toLocaleString()}</Text>
        </View>
      </View>
      <Text style={[styles.eventCost, { color: costColor }]}>${cost.toFixed(5)}</Text>
    </View>
  );
}

function ContextBar({ totalTokens }: { totalTokens: number }) {
  if (totalTokens < CTX_WARN) return null;
  const isCritical = totalTokens >= CTX_CRITICAL;
  const pct = Math.min(100, (totalTokens / CTX_CRITICAL) * 100);
  const color = isCritical ? colors.danger : colors.warning;
  return (
    <View style={[styles.ctxCard, { borderLeftColor: color }]}>
      <View style={styles.ctxHeader}>
        <Text style={[styles.ctxTitle, { color }]}>{isCritical ? "⛔ CONTEXT CRITICAL" : "⚠ CONTEXT LARGE"}</Text>
        <Text style={[styles.ctxValue, { color }]}>{(totalTokens / 1000).toFixed(0)}K</Text>
      </View>
      <View style={styles.ctxTrack}>
        <View style={[styles.ctxFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.ctxTip, { color }]}>
        {isCritical ? "Compact now to reduce costs by 50-70%" : "Consider compacting after this task"}
      </Text>
    </View>
  );
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const relay = useRelay();
  const [session, setSession] = useState<AgentSession | null>(null);
  const [events, setEvents] = useState<TokenEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sessionData, eventsData] = await Promise.all([
        apiClient.getSession(id),
        apiClient.getEvents(id),
      ]);
      setSession(sessionData);
      setEvents(eventsData.events || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const sendCmd = (action: string, params?: Record<string, unknown>) => {
    relay.client?.sendCommand(action as any, params);
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.root}>
        <Text style={styles.errorText}>Session not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalCost = parseFloat(session.totalCost || "0");
  const agentColor = session.agentType === "claude" ? colors.agentClaude : session.agentType === "opencode" ? colors.agentOpencode : colors.agentCodex;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: session.name, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerTitleStyle: { fontFamily: "SpaceMono", fontSize: 14 } }} />

      <ScrollView style={styles.root} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />}>

        {/* Session Header Card */}
        <View style={[styles.headerCard, { borderTopColor: agentColor }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerName}>{session.name}</Text>
              <Text style={styles.headerMeta}>{session.agentType.toUpperCase()} · {session.model}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: session.status === "active" ? `${colors.success}15` : `${colors.textMuted}15` }]}>
              <Text style={[styles.statusText, { color: session.status === "active" ? colors.success : colors.textMuted }]}>{session.status}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>${totalCost.toFixed(4)}</Text>
              <Text style={styles.statLabel}>COST</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{(session.totalTokens || 0).toLocaleString()}</Text>
              <Text style={styles.statLabel}>TOKENS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{events.length}</Text>
              <Text style={styles.statLabel}>CALLS</Text>
            </View>
          </View>
        </View>

        {/* Command Buttons */}
        <View style={styles.cmdRow}>
          <CommandButton icon="⏸" label="Pause" color={colors.warning} onPress={() => sendCmd("pause")} />
          <CommandButton icon="🗜" label="Compact" color={colors.accent} onPress={() => sendCmd("compact")} />
          <CommandButton icon="🔄" label="Sonnet" color={colors.success} onPress={() => sendCmd("switch_model", { model: "claude-sonnet-4-5" })} />
          <CommandButton icon="ℹ️" label="Status" color={colors.tertiary} onPress={() => sendCmd("status")} />
        </View>

        {/* Context Warning */}
        <ContextBar totalTokens={session.totalTokens || 0} />

        {/* Events */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Token Events</Text>
          <Text style={styles.sectionCount}>{events.length} calls</Text>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No events yet</Text>
            <Text style={styles.emptySub}>Events appear as the agent makes LLM calls</Text>
          </View>
        ) : (
          <View style={styles.eventsCard}>
            {events.slice().reverse().map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 40 },
  errorText: { color: colors.textSecondary, fontFamily: "SpaceMono", fontSize: 14 },
  backLink: { color: colors.accent, fontFamily: "SpaceMono", fontSize: 13, marginTop: 8 },

  // Header card
  headerCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderTopWidth: 3, padding: spacing.lg, marginBottom: spacing.md },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md },
  headerName: { color: colors.text, fontSize: 18, fontFamily: "SpaceMono", fontWeight: "700", maxWidth: 240 },
  headerMeta: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  statusText: { fontSize: 10, fontFamily: "SpaceMono", fontWeight: "700" },

  // Stats
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: 14, fontFamily: "SpaceMono", fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 8, fontFamily: "SpaceMono", letterSpacing: 1, marginTop: 2 },

  // Commands
  cmdRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  cmdBtn: { flex: 1, borderRadius: radius.md, borderWidth: 1, paddingVertical: spacing.sm, alignItems: "center" },
  cmdLabel: { fontSize: 10, fontFamily: "SpaceMono", fontWeight: "700", marginTop: 2 },

  // Context
  ctxCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, marginBottom: spacing.md },
  ctxHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  ctxTitle: { fontSize: 10, fontFamily: "SpaceMono", fontWeight: "700", letterSpacing: 1 },
  ctxValue: { fontSize: 14, fontFamily: "SpaceMono", fontWeight: "700" },
  ctxTrack: { height: 4, backgroundColor: "#ffffff15", borderRadius: 2, marginBottom: 8, overflow: "hidden" },
  ctxFill: { height: 4, borderRadius: 2 },
  ctxTip: { fontSize: 11, fontFamily: "SpaceMono", lineHeight: 16 },

  // Section
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm, marginTop: spacing.md },
  sectionTitle: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", letterSpacing: 2, textTransform: "uppercase" },
  sectionCount: { color: colors.textSecondary, fontSize: 10, fontFamily: "SpaceMono" },

  // Events
  eventsCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  eventRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  eventLeft: { flex: 1 },
  eventTime: { color: colors.textMuted, fontSize: 9, fontFamily: "SpaceMono", marginBottom: 2 },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  eventModel: { color: colors.text, fontSize: 11, fontFamily: "SpaceMono", maxWidth: 160 },
  eventSep: { color: colors.textMuted, fontSize: 10 },
  eventTokens: { color: colors.textSecondary, fontSize: 10, fontFamily: "SpaceMono" },
  eventCost: { fontSize: 13, fontFamily: "SpaceMono", fontWeight: "700" },

  // Empty
  emptyCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: "center", marginBottom: spacing.md },
  emptyText: { color: colors.textSecondary, fontFamily: "SpaceMono", fontSize: 14, marginBottom: 6 },
  emptySub: { color: colors.textMuted, fontFamily: "SpaceMono", fontSize: 11, textAlign: "center", lineHeight: 17 },
});
