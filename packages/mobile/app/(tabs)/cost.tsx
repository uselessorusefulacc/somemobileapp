import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type Analytics } from "../../lib/api";
import { colors, fonts, radius, space } from "../../lib/theme";

function formatCost(c: number) {
  if (c === 0) return "$0.00";
  if (c < 0.001) return `$${(c * 100000).toFixed(1)}μ`;
  if (c < 1) return `$${c.toFixed(4)}`;
  return `$${c.toFixed(2)}`;
}

const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-5":    { in: 15,   out: 75   },
  "claude-sonnet-4-5":  { in: 3,    out: 15   },
  "claude-haiku-3-5":   { in: 0.8,  out: 4    },
  "gpt-4o":             { in: 2.5,  out: 10   },
  "gpt-4o-mini":        { in: 0.15, out: 0.6  },
  "o3":                 { in: 10,   out: 40   },
  "o3-mini":            { in: 1.1,  out: 4.4  },
  "gemini-2-5-pro":     { in: 1.25, out: 10   },
  "gemini-2-5-flash":   { in: 0.075,out: 0.3  },
};

function ModelSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mo.overlay}>
        <View style={[mo.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={mo.sheetHandle} />
          <View style={mo.sheetHead}>
            <Text style={mo.sheetTitle}>MODEL PRICING</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={mo.closeX}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={mo.divider} />

          {/* Table header */}
          <View style={mo.tableHead}>
            <Text style={[mo.col1, mo.headCell]}>MODEL</Text>
            <Text style={[mo.col2, mo.headCell]}>IN /1M</Text>
            <Text style={[mo.col2, mo.headCell]}>OUT /1M</Text>
          </View>
          <View style={mo.divider} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {Object.entries(MODEL_PRICING).map(([model, price], i, arr) => (
              <View key={model}>
                <View style={mo.tableRow}>
                  <Text style={[mo.col1, mo.modelName]} numberOfLines={1}>{model}</Text>
                  <Text style={[mo.col2, mo.priceCell]}>${price.in}</Text>
                  <Text style={[mo.col2, mo.priceCell]}>${price.out}</Text>
                </View>
                {i < arr.length - 1 && <View style={mo.rowDivider} />}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function CostScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      const d = await apiClient.getAnalytics();
      setStats(d);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const totalCost = parseFloat(stats?.totalCost || "0");
  const todayCost = stats?.dailyCost || 0;
  const totalTokens = stats?.totalTokens || 0;
  const modelBreakdown = stats?.modelBreakdown;

  return (
    <View style={[co.root, { paddingTop: insets.top }]}>
      <View style={co.topBar}>
        <Text style={co.pageTitle}>COST</Text>
        <TouchableOpacity
          onPress={() => setShowPricing(true)}
          style={co.pricingBtn}
          activeOpacity={0.7}
        >
          <Text style={co.pricingBtnText}>PRICING</Text>
        </TouchableOpacity>
      </View>

      <View style={co.divider} />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={colors.textTertiary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={co.heroBlock}>
          <Text style={co.heroLabel}>ALL-TIME SPEND</Text>
          <Text style={[co.heroCost, { color: totalCost > 10 ? colors.danger : totalCost > 1 ? colors.warning : colors.text }]}>
            {formatCost(totalCost)}
          </Text>
        </View>

        <View style={co.divider} />

        {/* ── Stats ── */}
        <View style={co.statRow}>
          <View style={co.stat}>
            <Text style={co.statLabel}>TODAY</Text>
            <Text style={[co.statValue, { color: todayCost > 1 ? colors.warning : colors.text }]}>
              {formatCost(todayCost)}
            </Text>
          </View>
          <View style={co.statSep} />
          <View style={co.stat}>
            <Text style={co.statLabel}>TOKENS</Text>
            <Text style={co.statValue}>
              {totalTokens >= 1_000_000
                ? `${(totalTokens / 1_000_000).toFixed(2)}M`
                : `${(totalTokens / 1_000).toFixed(1)}K`}
            </Text>
          </View>
          <View style={co.statSep} />
          <View style={co.stat}>
            <Text style={co.statLabel}>AVG/SESSION</Text>
            <Text style={co.statValue}>
              {(stats?.totalSessions ?? 0) > 0
                ? formatCost(totalCost / stats!.totalSessions)
                : "$0.00"}
            </Text>
          </View>
        </View>

        <View style={co.divider} />

        {/* ── Cost by model ── */}
        {modelBreakdown && modelBreakdown.length > 0 && (
          <>
            <Text style={co.sectionLabel}>BY MODEL</Text>
            {modelBreakdown
              .sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost))
              .map((m, i, arr) => {
                const cost = parseFloat(m.totalCost);
                const maxCost = parseFloat(arr[0].totalCost);
                const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
                return (
                  <View key={m.model}>
                    <View style={co.modelRow}>
                      <Text style={co.modelName} numberOfLines={1}>{m.model}</Text>
                      <View style={co.barTrack}>
                        <View style={[co.barFill, { width: `${Math.max(pct, 1)}%` }]} />
                      </View>
                      <Text style={co.modelCost}>{formatCost(cost)}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={co.rowDivider} />}
                  </View>
                );
              })}
            <View style={co.divider} />
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ModelSheet visible={showPricing} onClose={() => setShowPricing(false)} />
    </View>
  );
}

const co = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  divider: { height: 1, backgroundColor: colors.border },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: space.lg },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  pageTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  pricingBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.sm + 4,
    paddingVertical: 5,
    borderRadius: radius.xs,
  },
  pricingBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },

  heroBlock: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl + 8,
    paddingBottom: space.xl,
  },
  heroLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: space.sm,
  },
  heroCost: {
    fontFamily: fonts.sans,
    fontSize: 52,
    fontWeight: "400",
    letterSpacing: -2.5,
    lineHeight: 52,
  },

  statRow: {
    flexDirection: "row",
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 4,
  },
  stat: { flex: 1, alignItems: "flex-start" },
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
    fontSize: 15,
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

  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    gap: space.sm,
  },
  modelName: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    width: 110,
  },
  barTrack: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.textTertiary,
  },
  modelCost: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
    width: 68,
    textAlign: "right",
  },
});

const mo = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    maxHeight: "80%",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderStrong,
  },
  sheetHandle: {
    width: 32,
    height: 2,
    backgroundColor: colors.textTertiary,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 1,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  sheetTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  closeX: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textTertiary,
  },
  divider: { height: 1, backgroundColor: colors.border },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: space.lg },

  tableHead: {
    flexDirection: "row",
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    backgroundColor: colors.surfaceRaised,
  },
  headCell: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    alignItems: "center",
  },
  col1: { flex: 1, marginRight: space.sm },
  col2: { width: 64, textAlign: "right" },
  modelName: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
  },
  priceCell: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
