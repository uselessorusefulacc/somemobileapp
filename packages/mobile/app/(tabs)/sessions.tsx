import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, spacing, radius } from "../../lib/theme";
import { apiClient, type AgentSession } from "../../lib/api";

const STATUS_COLORS: Record<string, string> = {
  active: colors.success,
  completed: colors.textMuted,
  error: colors.danger,
  paused: colors.warning,
};

const AGENT_COLORS: Record<string, string> = {
  claude: colors.agentClaude,
  opencode: colors.agentOpencode,
  codex: colors.agentCodex,
};

function SessionRow({ session, onPress }: { session: AgentSession; onPress: () => void }) {
  const statusColor = STATUS_COLORS[session.status] || colors.textMuted;
  const agentColor = AGENT_COLORS[session.agentType] || colors.accent;
  const cost = parseFloat(session.totalCost || "0");
  const costColor =
    cost > 0.1 ? colors.danger : cost > 0.05 ? colors.warning : colors.success;
  const duration =
    session.updatedAt && session.status !== "active"
      ? Math.round(
          (new Date(session.updatedAt).getTime() - new Date(session.createdAt).getTime()) / 1000
        )
      : null;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowLeft}>
        {/* Agent type indicator bar */}
        <View style={[styles.agentBar, { backgroundColor: agentColor }]} />
        <View style={styles.rowMid}>
          <View style={styles.rowTitleRow}>
            <Text style={styles.rowName} numberOfLines={1}>
              {session.name}
            </Text>
            <View style={[styles.statusPill, { borderColor: statusColor + "44" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {session.status}
              </Text>
            </View>
          </View>
          <View style={styles.rowMeta}>
            <Text style={styles.metaText}>{session.model}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>
              {(session.totalTokens || 0).toLocaleString()} tok
            </Text>
            {duration !== null && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{duration}s</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.costText, { color: costColor }]}>${cost.toFixed(4)}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SessionsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiClient.getSessions();
      setSessions(data.sessions || []);
    } catch (e) {
      console.error("sessions load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  const filters = ["all", "active", "completed", "error"];
  const filtered =
    filter === "all" ? sessions : sessions.filter((s) => s.status === filter);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sessions</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push("/new-session")}
        >
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <FilterChip
            key={f}
            label={f.charAt(0).toUpperCase() + f.slice(1)}
            active={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      {/* Count */}
      <Text style={styles.countText}>
        {filtered.length} session{filtered.length !== 1 ? "s" : ""}
      </Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No sessions yet</Text>
          <Text style={styles.emptySub}>
            Create a new session or load demo data from Dashboard
          </Text>
          <TouchableOpacity
            style={styles.newBtnLarge}
            onPress={() => router.push("/new-session")}
          >
            <Text style={styles.newBtnLargeText}>Create Session</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          estimatedItemSize={80}
          renderItem={({ item }) => (
            <SessionRow
              session={item}
              onPress={() => router.push(`/session/${item.id}`)}
            />
          )}
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
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
          )}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  newBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  newBtnText: { color: "#fff", fontSize: 13, fontFamily: "SpaceMono", fontWeight: "700" },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  chipText: { color: colors.textMuted, fontSize: 11, fontFamily: "SpaceMono" },
  chipTextActive: { color: colors.accent },
  countText: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "SpaceMono",
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.text,
    fontSize: 16,
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: "SpaceMono",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  newBtnLarge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  newBtnLargeText: {
    color: "#fff",
    fontFamily: "SpaceMono",
    fontWeight: "700",
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    backgroundColor: colors.bg,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  agentBar: { width: 3, height: 48, borderRadius: 2, marginHorizontal: spacing.md },
  rowMid: { flex: 1 },
  rowTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingRight: spacing.sm,
  },
  rowName: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    flex: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginLeft: 8,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontFamily: "SpaceMono" },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono" },
  metaDot: { color: colors.textMuted, fontSize: 10 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  costText: { fontSize: 14, fontFamily: "SpaceMono", fontWeight: "700" },
  chevron: { color: colors.textMuted, fontSize: 18, fontWeight: "300" },
});
