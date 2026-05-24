import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type AgentSession } from "../../lib/api";
import { colors, fonts, radius, space } from "../../lib/theme";
import { formatCost, getStatusColor } from "../../lib/format";

// ── Pulse dot ─────────────────────────────────────────────────────────────
function PulseDot({ color, size = 6 }: { color: string; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 2, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(400),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute",
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, opacity, transform: [{ scale }],
      }} />
      <View style={{ width: size * 0.6, height: size * 0.6, borderRadius: size * 0.3, backgroundColor: color }} />
    </View>
  );
}

// ── Session row ────────────────────────────────────────────────────────────
function SessionRow({ item, onPress, index = 0 }: { item: AgentSession; onPress: () => void; index?: number }) {
  const cost = parseFloat(item.totalCost || "0");
  const isActive = item.status === "active";
  const statusColor = getStatusColor(item.status);
  const date = new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const tokens = item.totalTokens ? `${(item.totalTokens / 1000).toFixed(1)}K` : "—";
  const costTint =
    cost > 1 ? colors.danger :
    cost > 0.1 ? colors.warning :
    colors.textSecondary;

  const rowOpacity = useRef(new Animated.Value(0)).current;
  const rowSlide = useRef(new Animated.Value(18)).current;
  const rowScale = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const delay = Math.min(index * 55, 300);
    Animated.parallel([
      Animated.timing(rowOpacity, { toValue: 1, duration: 320, delay, useNativeDriver: true }),
      Animated.timing(rowSlide, { toValue: 0, duration: 320, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn = () => Animated.spring(rowScale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(rowScale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  return (
    <Animated.View style={{ opacity: rowOpacity, transform: [{ translateX: rowSlide }, { scale: rowScale }] }}>
    <TouchableOpacity
      style={[s.row, isActive && s.rowActive]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
    >
      {/* Left accent bar — glows when active */}
      <View style={[s.accentBar, {
        backgroundColor: isActive ? colors.success : statusColor + "60",
        shadowColor: isActive ? colors.success : "transparent",
        shadowRadius: isActive ? 6 : 0,
        shadowOpacity: isActive ? 1 : 0,
      }]} />

      <View style={s.rowBody}>
        <View style={s.rowTop}>
          <Text style={[s.name, isActive && s.nameActive]} numberOfLines={1}>{item.name}</Text>
          <Text style={[s.cost, { color: costTint }]}>{formatCost(cost)}</Text>
        </View>
        <View style={s.rowMeta}>
          {isActive
            ? <PulseDot color={colors.success} size={5} />
            : <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          }
          <Text style={[s.metaStatus, { color: isActive ? colors.success : colors.textTertiary }]}>
            {item.status.toUpperCase()}
          </Text>
          <Text style={s.metaSep}>·</Text>
          <Text style={s.metaText}>{item.agentType.toUpperCase()}</Text>
          <Text style={s.metaSep}>·</Text>
          <Text style={s.metaText}>{tokens}</Text>
          <Text style={s.metaSep}>·</Text>
          <Text style={s.metaDate}>{date}</Text>
        </View>
      </View>

      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
    </Animated.View>
  );
}

// ── Empty ─────────────────────────────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyGlyph}><Text style={s.emptyGlyphText}>◎</Text></View>
      <Text style={s.emptyTitle}>NO SESSIONS</Text>
      <Text style={s.emptySub}>Start your first agent session</Text>
      <TouchableOpacity style={s.emptyBtn} onPress={onNew} activeOpacity={0.7}>
        <Text style={s.emptyBtnText}>⊕  NEW SESSION</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Error ─────────────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={s.empty}>
      <View style={[s.emptyGlyph, { borderColor: colors.dangerBorder, backgroundColor: colors.dangerMuted }]}>
        <Text style={[s.emptyGlyphText, { color: colors.danger }]}>!</Text>
      </View>
      <Text style={[s.emptyTitle, { color: colors.danger }]}>LOAD FAILED</Text>
      <Text style={s.emptySub}>Could not fetch sessions from API</Text>
      <TouchableOpacity style={[s.emptyBtn, { borderColor: colors.accentBorder, backgroundColor: colors.accentMuted }]} onPress={onRetry} activeOpacity={0.7}>
        <Text style={[s.emptyBtnText, { color: colors.accent }]}>↻  RETRY</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function SessionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const data = await apiClient.getSessions();
      setSessions(data.sessions || []);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(true);
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const activeCount = sessions.filter((ss) => ss.status === "active").length;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <View style={s.topLeft}>
          <Text style={s.pageTitle}>SESSIONS</Text>
          <Text style={s.sessionCount}>{sessions.length}</Text>
        </View>
        <View style={s.topRight}>
          {activeCount > 0 && (
            <View style={s.activePill}>
              <PulseDot color={colors.success} size={5} />
              <Text style={s.activeText}>{activeCount} LIVE</Text>
            </View>
          )}
          <TouchableOpacity
            style={s.newBtn}
            onPress={() => router.push("/new-session")}
            activeOpacity={0.7}
          >
            <Text style={s.newBtnText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={s.topAccent} />

      {loading && !refreshing ? (
        <View style={s.loadWrap}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={s.loadText}>LOADING</Text>
        </View>
      ) : error ? (
        <ErrorState onRetry={() => load(false)} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <SessionRow item={item} index={index} onPress={() => router.push(`/session/${item.id}`)} />
          )}
          ItemSeparatorComponent={() => <View style={s.divider} />}
          ListEmptyComponent={<EmptyState onNew={() => router.push("/new-session")} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sessions.length === 0 ? { flex: 1 } : undefined}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  divider: { height: 1, backgroundColor: colors.border },
  topAccent: { height: 1, backgroundColor: colors.accent + "30" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  pageTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.accent,
    textTransform: "uppercase",
  },
  sessionCount: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  activePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.successBorder,
    backgroundColor: colors.successMuted,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2,
  },
  activeText: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.4, color: colors.success, textTransform: "uppercase" },
  newBtn: {
    width: 30, height: 30,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.accentBorder,
    backgroundColor: colors.accentMuted,
    borderRadius: 2,
  },
  newBtnText: { fontFamily: fonts.sans, fontSize: 17, color: colors.accent, lineHeight: 22 },

  loadWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadText: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 2, color: colors.textSecondary, textTransform: "uppercase" },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingRight: space.lg,
    backgroundColor: colors.bg,
  },
  rowActive: {
    backgroundColor: colors.successMuted,
  },
  accentBar: {
    width: 3,
    alignSelf: "stretch",
    marginRight: space.md,
    borderRadius: 2,
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  name: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400",
    letterSpacing: -0.2,
    color: colors.text,
    paddingRight: space.sm,
  },
  nameActive: { color: colors.text },
  cost: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: -0.2 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  metaStatus: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.0, textTransform: "uppercase" },
  metaText: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.0, color: colors.textSecondary, textTransform: "uppercase" },
  metaSep: { fontFamily: fonts.sans, fontSize: 10, color: colors.textSecondary },
  metaDate: { fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary },
  chevron: { fontFamily: fonts.sans, fontSize: 18, color: colors.textSecondary, marginLeft: space.sm, lineHeight: 22 },

  // Empty / error
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: space.xl },
  emptyGlyph: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  emptyGlyphText: { fontFamily: fonts.sans, fontSize: 20, color: colors.textSecondary },
  emptyTitle: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.8, color: colors.textSecondary, textTransform: "uppercase" },
  emptySub: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  emptyBtn: {
    borderWidth: 1, borderColor: colors.borderStrong,
    paddingHorizontal: space.lg, paddingVertical: 10,
    borderRadius: radius.xs, marginTop: 4,
  },
  emptyBtnText: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.6, color: colors.textSecondary, textTransform: "uppercase" },
});
