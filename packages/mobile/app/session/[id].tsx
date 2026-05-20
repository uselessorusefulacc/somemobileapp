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
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useFocusEffect } from "expo-router";
import { colors, spacing, radius } from "../../lib/theme";
import { apiClient, type AgentSession, type TokenEvent } from "../../lib/api";

// Context size thresholds
const CTX_WARN = 3000;    // yellow
const CTX_CRITICAL = 8000; // red

// Models that warrant switch suggestions
const EXPENSIVE_MODELS = ["claude-opus-4-5", "gpt-4o", "o3", "gemini-2-5-pro"];
const MODEL_ALTERNATIVES: Record<string, { name: string; savings: number }> = {
  "claude-opus-4-5": { name: "Claude Haiku 3.5", savings: 95 },
  "gpt-4o": { name: "GPT-4o mini", savings: 90 },
  "o3": { name: "GPT-4o", savings: 75 },
  "gemini-2-5-pro": { name: "Gemini 2.5 Flash", savings: 88 },
};

function EventRow({ event }: { event: TokenEvent }) {
  const cost = event.costUsd ?? 0;
  const costColor =
    cost > 0.01 ? colors.danger : cost > 0.005 ? colors.warning : colors.success;
  const time = new Date(event.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const totalTokens = (event.inputTokens ?? 0) + (event.outputTokens ?? 0);

  return (
    <View style={styles.eventRow}>
      <View style={styles.eventLeft}>
        <Text style={styles.eventTime}>{time}</Text>
        <View style={styles.eventTokens}>
          <Text style={styles.eventModel} numberOfLines={1}>
            {event.model}
          </Text>
          <Text style={styles.eventSep}>·</Text>
          <Text style={[styles.eventIn, { color: colors.accent }]}>
            ↑{(event.inputTokens ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.eventSep}>+</Text>
          <Text style={[styles.eventOut, { color: colors.success }]}>
            ↓{(event.outputTokens ?? 0).toLocaleString()}
          </Text>
        </View>
        <Text style={styles.eventTotal}>
          {totalTokens.toLocaleString()} total tokens
        </Text>
      </View>
      <Text style={[styles.eventCost, { color: costColor }]}>${cost.toFixed(5)}</Text>
    </View>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillLabel}>{label}</Text>
      <Text style={[styles.statPillValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function ContextWarningBanner({ totalTokens }: { totalTokens: number }) {
  if (totalTokens < CTX_WARN) return null;
  const isCritical = totalTokens >= CTX_CRITICAL;
  const bg = isCritical ? colors.danger + "1a" : colors.warning + "1a";
  const border = isCritical ? colors.danger : colors.warning;
  const textColor = isCritical ? colors.danger : colors.warning;
  const pct = Math.min(100, Math.round((totalTokens / CTX_CRITICAL) * 100));

  return (
    <View style={[styles.contextBanner, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.contextBannerHeader}>
        <Text style={[styles.contextBannerTitle, { color: textColor }]}>
          {isCritical ? "⛔ CONTEXT CRITICAL" : "⚠ CONTEXT GROWING"}
        </Text>
        <Text style={[styles.contextBannerTokens, { color: textColor }]}>
          {totalTokens.toLocaleString()} tokens
        </Text>
      </View>
      <View style={styles.contextBarTrack}>
        <View
          style={[
            styles.contextBarFill,
            { width: `${pct}%`, backgroundColor: border },
          ]}
        />
      </View>
      <Text style={[styles.contextBannerTip, { color: textColor + "cc" }]}>
        {isCritical
          ? "Run /compact or context compaction now to reduce costs by 50-70%"
          : "Context is growing — consider summarizing after 10+ turns"}
      </Text>
    </View>
  );
}

function ModelSwitchTip({ model, totalCost }: { model: string; totalCost: number }) {
  const alt = MODEL_ALTERNATIVES[model];
  if (!alt || totalCost < 0.05) return null;
  return (
    <View style={styles.modelSwitchCard}>
      <Text style={styles.modelSwitchTitle}>MODEL OPTIMIZATION</Text>
      <Text style={styles.modelSwitchText}>
        You're using <Text style={{ color: colors.danger }}>{model}</Text>. Switch to{" "}
        <Text style={{ color: colors.success }}>{alt.name}</Text> to save up to{" "}
        <Text style={{ color: colors.success, fontWeight: "700" }}>{alt.savings}%</Text> on routine
        tasks.
      </Text>
      <Text style={styles.modelSwitchSub}>
        Current cost: ${totalCost.toFixed(4)} · Estimated with {alt.name}: $
        {(totalCost * (1 - alt.savings / 100)).toFixed(4)}
      </Text>
    </View>
  );
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<AgentSession | null>(null);
  const [events, setEvents] = useState<TokenEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
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
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  const endSession = async () => {
    Alert.alert("End Session", "Mark this session as completed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End",
        style: "destructive",
        onPress: async () => {
          try {
            await apiClient.patchSession(id, { status: "completed" });
            load(true);
          } catch (e) {
            Alert.alert("Error", "Failed to end session.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Session not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalCost = parseFloat(session.totalCost || "0");
  const agentColor =
    session.agentType === "claude"
      ? colors.agentClaude
      : session.agentType === "opencode"
      ? colors.agentOpencode
      : colors.agentCodex;
  const statusColor =
    session.status === "active"
      ? colors.success
      : session.status === "error"
      ? colors.danger
      : colors.textMuted;

  const costPer1K =
    session.totalTokens > 0
      ? ((totalCost / session.totalTokens) * 1000).toFixed(4)
      : "0";

  const isExpensiveModel = EXPENSIVE_MODELS.includes(session.model);

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: session.name,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: "SpaceMono", fontSize: 14 },
          headerRight: () =>
            session.status === "active" ? (
              <TouchableOpacity onPress={endSession} style={{ marginRight: 12 }}>
                <Text style={{ color: colors.danger, fontFamily: "SpaceMono", fontSize: 12 }}>
                  End
                </Text>
              </TouchableOpacity>
            ) : null,
        }}
      />

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
        {/* Session card */}
        <View style={[styles.sessionCard, { borderTopColor: agentColor }]}>
          <View style={styles.sessionCardHeader}>
            <View>
              <Text style={styles.sessionName}>{session.name}</Text>
              <Text style={styles.sessionMeta}>
                {(session.agentType ?? "unknown").toUpperCase()} · {session.model}
              </Text>
            </View>
            <View style={[styles.statusBadge, { borderColor: statusColor + "55" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {session.status}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatPill
              label="COST"
              value={`$${totalCost.toFixed(4)}`}
              color={totalCost > 0.1 ? colors.danger : totalCost > 0.05 ? colors.warning : colors.success}
            />
            <StatPill
              label="TOKENS"
              value={(session.totalTokens || 0).toLocaleString()}
            />
            <StatPill label="$/1K TOK" value={`$${costPer1K}`} />
            <StatPill label="EVENTS" value={String(events.length)} />
          </View>
        </View>

        {/* Context size warning */}
        <ContextWarningBanner totalTokens={session.totalTokens || 0} />

        {/* Model switch suggestion */}
        {isExpensiveModel && (
          <ModelSwitchTip model={session.model} totalCost={totalCost} />
        )}

        {/* Cost bar visualization */}
        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COST OVER TIME</Text>
            <View style={styles.barChart}>
              {events.slice(-20).map((e) => {
                const cost = e.costUsd ?? 0;
                const maxCostInView = Math.max(
                  ...events.slice(-20).map((ev) => ev.costUsd ?? 0),
                  0.0001
                );
                const pct = (cost / maxCostInView) * 100;
                const barColor =
                  cost > 0.01 ? colors.danger : cost > 0.005 ? colors.warning : colors.success;
                return (
                  <View key={e.id} style={styles.barChartCol}>
                    <View
                      style={[
                        styles.barChartBar,
                        { height: `${Math.max(4, pct)}%`, backgroundColor: barColor },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Optimization tip */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>OPTIMIZATION TIP</Text>
          <Text style={styles.tipText}>
            {isExpensiveModel
              ? `${model_tip(session.model)} — switch to a cheaper model for routine tasks.`
              : session.totalTokens > CTX_WARN
              ? "High context detected. Use /compact after long sessions to compress history and cut costs."
              : "Enable prompt caching for repeated system prompts to reduce input tokens by up to 90%."}
          </Text>
        </View>

        {/* Token events list */}
        <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md, marginBottom: spacing.sm }]}>
          TOKEN EVENTS ({events.length})
        </Text>

        {events.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No events yet</Text>
            <Text style={styles.emptySub}>
              Events appear here as the agent makes LLM calls
            </Text>
          </View>
        ) : (
          <View style={{ height: Math.min(events.length * 80, 400) }}>
            <FlashList
              data={[...events].reverse()}
              keyExtractor={(item) => item.id}
              estimatedItemSize={80}
              renderItem={({ item }) => <EventRow event={item} />}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: colors.border }} />
              )}
            />
          </View>
        )}

        {/* Sandbox URL */}
        {session.sandboxUrl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RUNABLE SANDBOX</Text>
            <View style={styles.sandboxCard}>
              <Text style={styles.sandboxUrl} numberOfLines={2}>
                {session.sandboxUrl}
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function model_tip(model: string): string {
  if (model === "claude-opus-4-5") return "Claude Opus costs $15/M input · $75/M output";
  if (model === "gpt-4o") return "GPT-4o costs $5/M input · $15/M output";
  if (model === "o3") return "o3 costs $10/M input · $40/M output";
  return "This model is in the premium tier";
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
  errorText: { color: colors.textSecondary, fontFamily: "SpaceMono", fontSize: 14 },
  backLink: { color: colors.accent, fontFamily: "SpaceMono", fontSize: 13, marginTop: 8 },
  sessionCard: {
    margin: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sessionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  sessionName: {
    color: colors.text,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    maxWidth: 220,
  },
  sessionMeta: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", marginTop: 3 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontFamily: "SpaceMono" },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  statPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    minWidth: 70,
  },
  statPillLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontFamily: "SpaceMono",
    letterSpacing: 1,
    marginBottom: 2,
  },
  statPillValue: {
    color: colors.text,
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  contextBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  contextBannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  contextBannerTitle: { fontSize: 10, fontFamily: "SpaceMono", fontWeight: "700", letterSpacing: 1 },
  contextBannerTokens: { fontSize: 12, fontFamily: "SpaceMono", fontWeight: "700" },
  contextBarTrack: { height: 4, backgroundColor: "#ffffff22", borderRadius: 2, marginBottom: 8, overflow: "hidden" },
  contextBarFill: { height: 4, borderRadius: 2 },
  contextBannerTip: { fontSize: 11, fontFamily: "SpaceMono", lineHeight: 16 },
  modelSwitchCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.success + "11",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success + "44",
    padding: spacing.md,
  },
  modelSwitchTitle: {
    color: colors.success,
    fontSize: 9,
    fontFamily: "SpaceMono",
    letterSpacing: 2,
    marginBottom: 6,
  },
  modelSwitchText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    lineHeight: 18,
    marginBottom: 6,
  },
  modelSwitchSub: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "SpaceMono",
  },
  section: { marginBottom: spacing.md },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "SpaceMono",
    letterSpacing: 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  barChart: {
    marginHorizontal: spacing.md,
    height: 80,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  barChartCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" },
  barChartBar: { width: "80%", borderRadius: 2, minHeight: 4 },
  tipCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent + "33",
    padding: spacing.md,
  },
  tipTitle: {
    color: colors.accent,
    fontSize: 9,
    fontFamily: "SpaceMono",
    letterSpacing: 2,
    marginBottom: 4,
  },
  tipText: { color: colors.textSecondary, fontSize: 12, fontFamily: "SpaceMono", lineHeight: 18 },
  eventRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
  },
  eventLeft: { flex: 1 },
  eventTime: { color: colors.textMuted, fontSize: 9, fontFamily: "SpaceMono", marginBottom: 2 },
  eventTokens: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  eventModel: { color: colors.text, fontSize: 11, fontFamily: "SpaceMono", maxWidth: 140 },
  eventSep: { color: colors.textMuted, fontSize: 10 },
  eventIn: { fontSize: 11, fontFamily: "SpaceMono" },
  eventOut: { fontSize: 11, fontFamily: "SpaceMono" },
  eventTotal: { color: colors.textMuted, fontSize: 9, fontFamily: "SpaceMono" },
  eventCost: { fontSize: 13, fontFamily: "SpaceMono", fontWeight: "700", marginLeft: spacing.sm },
  empty: { alignItems: "center", padding: spacing.xl },
  emptyText: { color: colors.textSecondary, fontFamily: "SpaceMono", fontSize: 14, marginBottom: 6 },
  emptySub: {
    color: colors.textMuted,
    fontFamily: "SpaceMono",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 17,
  },
  sandboxCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sandboxUrl: { color: colors.accent, fontFamily: "SpaceMono", fontSize: 11 },
});
