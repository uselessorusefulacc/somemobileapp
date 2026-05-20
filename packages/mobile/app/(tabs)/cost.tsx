import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { colors, spacing, radius } from "../../lib/theme";
import { apiClient, type Analytics, type BudgetConfig, type ModelBreakdown } from "../../lib/api";

const MODEL_INPUT_COSTS: Record<string, number> = {
  "claude-opus-4-5": 15,
  "claude-sonnet-4-5": 3,
  "claude-haiku-3-5": 0.8,
  "gpt-4o": 5,
  "gpt-4o-mini": 0.15,
  "o3-mini": 1.1,
  "gemini-2.5-pro": 1.25,
  "gemini-2.0-flash": 0.1,
};

const MODEL_OUTPUT_COSTS: Record<string, number> = {
  "claude-opus-4-5": 75,
  "claude-sonnet-4-5": 15,
  "claude-haiku-3-5": 4,
  "gpt-4o": 15,
  "gpt-4o-mini": 0.6,
  "o3-mini": 4.4,
  "gemini-2.5-pro": 10,
  "gemini-2.0-flash": 0.4,
};

function Bar({ pct, color }: { pct: number; color: string }) {
  // #92/#93: clamp width to [2, 100] to prevent overflow
  const clampedPct = Math.min(100, Math.max(2, pct));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${clampedPct}%`, backgroundColor: color }]} />
    </View>
  );
}

function ModelRow({
  model,
  cost,
  tokens,
  pct,
  isTop,
}: {
  model: string;
  cost: number;
  tokens: number;
  pct: number;
  isTop: boolean;
}) {
  const costColor = cost > 0.05 ? colors.danger : cost > 0.01 ? colors.warning : colors.success;
  return (
    <View style={[styles.modelRow, isTop && styles.modelRowTop]}>
      <View style={styles.modelLeft}>
        <View style={styles.modelNameRow}>
          <Text style={styles.modelName} numberOfLines={1}>
            {model}
          </Text>
          {isTop && (
            <View style={styles.topBadge}>
              <Text style={styles.topBadgeText}>TOP</Text>
            </View>
          )}
        </View>
        <Bar pct={pct} color={costColor} />
        <Text style={styles.modelTokens}>{tokens.toLocaleString()} tokens</Text>
      </View>
      <Text style={[styles.modelCost, { color: costColor }]}>${cost.toFixed(4)}</Text>
    </View>
  );
}

function PricingRow({ model }: { model: string }) {
  const input = MODEL_INPUT_COSTS[model];
  const output = MODEL_OUTPUT_COSTS[model];
  if (!input) return null;
  const tier = input < 1 ? "cheap" : input < 5 ? "mid" : "expensive";
  const tierColor =
    tier === "cheap" ? colors.success : tier === "mid" ? colors.warning : colors.danger;
  return (
    <View style={styles.pricingRow}>
      <View style={styles.pricingLeft}>
        <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
        <Text style={styles.pricingModel} numberOfLines={1}>
          {model}
        </Text>
      </View>
      <View style={styles.pricingCosts}>
        <Text style={styles.pricingCost}>${input}/M in</Text>
        <Text style={styles.pricingCostSep}>·</Text>
        <Text style={styles.pricingCost}>${output}/M out</Text>
      </View>
    </View>
  );
}

function CacheHitCard({ rate, savingsPct, cacheTokens, totalTokens }: {
  rate: number;
  savingsPct: number;
  cacheTokens: number;
  totalTokens: number;
}) {
  const pct = Math.round(rate * 100);
  const barColor = pct > 60 ? colors.success : pct > 30 ? colors.warning : colors.danger;
  const label = pct > 60 ? "Excellent" : pct > 30 ? "Good" : "Low — add cache breakpoints";
  return (
    <View style={styles.cacheCard}>
      <View style={styles.cacheHeader}>
        <Text style={styles.cacheTitle}>PROMPT CACHE HIT RATE</Text>
        <Text style={[styles.cachePct, { color: barColor }]}>{pct}%</Text>
      </View>
      <View style={styles.cacheBarTrack}>
        <View style={[styles.cacheBarFill, { width: `${Math.max(2, pct)}%`, backgroundColor: barColor }]} />
      </View>
      <View style={styles.cacheFooter}>
        <Text style={[styles.cacheLabel, { color: barColor }]}>{label}</Text>
        {savingsPct > 0 && (
          <Text style={styles.cacheSavings}>~{savingsPct}% cost saved via cache</Text>
        )}
      </View>
      <View style={styles.cacheStats}>
        <View style={styles.cacheStatItem}>
          <Text style={styles.cacheStatValue}>{cacheTokens.toLocaleString()}</Text>
          <Text style={styles.cacheStatLabel}>Cached tokens</Text>
        </View>
        <View style={styles.cacheStatDivider} />
        <View style={styles.cacheStatItem}>
          <Text style={styles.cacheStatValue}>{totalTokens.toLocaleString()}</Text>
          <Text style={styles.cacheStatLabel}>Total input tokens</Text>
        </View>
      </View>
    </View>
  );
}

function BudgetModal({ visible, budget, onSave, onClose }: {
  visible: boolean;
  budget: BudgetConfig;
  onSave: (b: BudgetConfig) => void;
  onClose: () => void;
}) {
  const [monthly, setMonthly] = useState(String(budget.monthlyLimitUsd ?? ""));
  const [daily, setDaily] = useState(String(budget.dailyLimitUsd ?? ""));
  const [alertPct, setAlertPct] = useState(String(budget.alertAtPct));

  const save = () => {
    // #80: validate inputs before saving
    const monthlyVal = monthly ? parseFloat(monthly) : null;
    const dailyVal = daily ? parseFloat(daily) : null;
    const alertVal = parseInt(alertPct, 10);

    if (monthly && (isNaN(monthlyVal!) || monthlyVal! <= 0)) {
      Alert.alert("Invalid", "Monthly limit must be a positive number.");
      return;
    }
    if (daily && (isNaN(dailyVal!) || dailyVal! <= 0)) {
      Alert.alert("Invalid", "Daily limit must be a positive number.");
      return;
    }
    if (isNaN(alertVal) || alertVal < 1 || alertVal > 100) {
      Alert.alert("Invalid", "Alert threshold must be between 1 and 100.");
      return;
    }

    onSave({
      monthlyLimitUsd: monthlyVal,
      dailyLimitUsd: dailyVal,
      alertAtPct: alertVal,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>BUDGET SETTINGS</Text>
          <Text style={styles.modalLabel}>Monthly limit (USD)</Text>
          <TextInput
            style={styles.modalInput}
            value={monthly}
            onChangeText={setMonthly}
            placeholder="e.g. 50"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
          <Text style={styles.modalLabel}>Daily limit (USD, optional)</Text>
          <TextInput
            style={styles.modalInput}
            value={daily}
            onChangeText={setDaily}
            placeholder="e.g. 5"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
          <Text style={styles.modalLabel}>Alert at (% of limit)</Text>
          <TextInput
            style={styles.modalInput}
            value={alertPct}
            onChangeText={setAlertPct}
            placeholder="80"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSave} onPress={save}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CostScreen() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [budget, setBudget] = useState<BudgetConfig>({ dailyLimitUsd: null, monthlyLimitUsd: 50, alertAtPct: 80 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [analyticsData, budgetData] = await Promise.all([
        apiClient.getAnalytics(),
        apiClient.getBudget(),
      ]);
      setAnalytics(analyticsData);
      setBudget(budgetData);
    } catch (e) {
      console.error("cost load error:", e);
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

  const saveBudget = async (cfg: BudgetConfig) => {
    try {
      const updated = await apiClient.setBudget(cfg);
      setBudget(updated);
      Alert.alert("Saved", "Budget settings updated.");
      // #96: re-fetch analytics after saving budget so projections update
      load(true);
    } catch {
      Alert.alert("Error", "Failed to save budget.");
    }
  };

  const totalCost = parseFloat(analytics?.totalCost || "0");
  // #65: use dailyCost field from API, not totalCost (which is lifetime)
  const todayCost = analytics?.dailyCost ?? 0;
  const monthlyProjection = analytics?.projectedMonthlyCost ?? analytics?.monthlyCost ?? totalCost;
  const projectionOverBudget = budget.monthlyLimitUsd !== null && monthlyProjection > budget.monthlyLimitUsd;
  const projectionWarning = budget.monthlyLimitUsd !== null && monthlyProjection > budget.monthlyLimitUsd * 0.8;

  const modelBreakdown: ModelBreakdown[] = analytics?.modelBreakdown || [];
  const maxCost = Math.max(...modelBreakdown.map((m) => parseFloat(m.totalCost)), 0.0001);

  const cacheHitRate = analytics?.cacheHitRate ?? 0;
  const totalCacheTokens = analytics?.totalInputTokens
    ? Math.round(analytics.totalInputTokens * cacheHitRate)
    : 0;

  return (
    <>
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
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Costs</Text>
            <Text style={styles.headerSub}>Token spend breakdown</Text>
          </View>
          <TouchableOpacity style={styles.budgetBtn} onPress={() => setShowBudgetModal(true)}>
            <Text style={styles.budgetBtnText}>Set Budget</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Summary cards */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>TODAY</Text>
                <Text style={styles.summaryValue}>${todayCost.toFixed(4)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>PROJECTED / MO</Text>
                <Text style={[
                  styles.summaryValue,
                  projectionOverBudget
                    ? { color: colors.danger }
                    : projectionWarning
                    ? { color: colors.warning }
                    : monthlyProjection > 10
                    ? { color: colors.warning }
                    : {}
                ]}>
                  ${monthlyProjection.toFixed(2)}
                </Text>
                {budget.monthlyLimitUsd !== null && (
                  <Text style={[styles.summaryBudgetLabel, projectionOverBudget && { color: colors.danger }]}>
                    / ${budget.monthlyLimitUsd} limit
                  </Text>
                )}
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>SESSIONS</Text>
                <Text style={styles.summaryValue}>{analytics?.totalSessions ?? 0}</Text>
              </View>
            </View>

            {/* Budget bar */}
            {budget.monthlyLimitUsd !== null && (
              <View style={styles.budgetSection}>
                <Text style={styles.budgetBarLabel}>
                  MONTHLY BUDGET — {Math.round((monthlyProjection / budget.monthlyLimitUsd) * 100)}% projected
                </Text>
                <View style={styles.budgetBarTrack}>
                  <View
                    style={[
                      styles.budgetBarFill,
                      {
                        width: `${Math.min(100, (monthlyProjection / budget.monthlyLimitUsd) * 100)}%`,
                        backgroundColor: projectionOverBudget
                          ? colors.danger
                          : projectionWarning
                          ? colors.warning
                          : colors.success,
                      },
                    ]}
                  />
                  {/* Alert threshold marker */}
                  <View
                    style={[
                      styles.budgetMarker,
                      { left: `${budget.alertAtPct}%` as any },
                    ]}
                  />
                </View>
                <Text style={styles.budgetBarSub}>
                  Alert at {budget.alertAtPct}% · $
                  {((budget.monthlyLimitUsd * budget.alertAtPct) / 100).toFixed(0)}
                </Text>
              </View>
            )}

            {/* Cache hit rate card */}
            {analytics?.cacheHitRate !== undefined && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>CACHE EFFICIENCY</Text>
                <CacheHitCard
                  rate={cacheHitRate}
                  savingsPct={analytics?.estimatedSavingsPct ?? 0}
                  cacheTokens={totalCacheTokens}
                  totalTokens={analytics?.totalInputTokens ?? 0}
                />
              </View>
            )}

            {/* Token breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TOKEN BREAKDOWN</Text>
              <View style={styles.tokenCard}>
                <View style={styles.tokenRow}>
                  <Text style={styles.tokenLabel}>Total tokens</Text>
                  <Text style={styles.tokenValue}>
                    {(analytics?.totalTokens || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.tokenDivider} />
                <View style={styles.tokenRow}>
                  <View style={styles.tokenLabelRow}>
                    <View style={[styles.tokenDot, { backgroundColor: colors.accent }]} />
                    <Text style={styles.tokenLabel}>Avg / session</Text>
                  </View>
                  <Text style={styles.tokenValue}>
                    {analytics?.totalSessions
                      ? Math.round(
                          (analytics.totalTokens || 0) / analytics.totalSessions
                        ).toLocaleString()
                      : "—"}
                  </Text>
                </View>
                <View style={styles.tokenDivider} />
                <View style={styles.tokenRow}>
                  <View style={styles.tokenLabelRow}>
                    <View style={[styles.tokenDot, { backgroundColor: colors.success }]} />
                    <Text style={styles.tokenLabel}>Cost efficiency</Text>
                  </View>
                  <Text style={[styles.tokenValue, { color: colors.success }]}>
                    {analytics?.totalTokens && totalCost > 0
                      ? `$${((totalCost / analytics.totalTokens) * 1000).toFixed(3)}/K`
                      : "—"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Per-model breakdown */}
            {modelBreakdown.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>BY MODEL</Text>
                <View style={styles.modelCard}>
                  {modelBreakdown.map((m, i) => {
                    const cost = parseFloat(m.totalCost);
                    const pct = (cost / maxCost) * 100;
                    return (
                      <ModelRow
                        key={m.model}
                        model={m.model}
                        cost={cost}
                        tokens={m.totalTokens}
                        pct={pct}
                        isTop={i === 0}
                      />
                    );
                  })}
                </View>
              </View>
            )}

            {/* Pricing reference */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MODEL PRICING REFERENCE</Text>
              <Text style={styles.sectionSub}>per 1M tokens (input / output)</Text>
              <View style={styles.pricingCard}>
                {Object.keys(MODEL_INPUT_COSTS).map((model) => (
                  <PricingRow key={model} model={model} />
                ))}
              </View>
            </View>

            {/* Cost saving tip */}
            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>COST OPTIMIZATION TIP</Text>
              <Text style={styles.tipText}>
                Switching from Claude Opus to Claude Haiku can reduce costs by up to 95% for
                repetitive tasks. Use Opus only for complex reasoning.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <BudgetModal
        visible={showBudgetModal}
        budget={budget}
        onSave={saveBudget}
        onClose={() => setShowBudgetModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  headerSub: { color: colors.textMuted, fontSize: 11, fontFamily: "SpaceMono", marginTop: 2 },
  budgetBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  budgetBtnText: { color: colors.accent, fontSize: 11, fontFamily: "SpaceMono" },
  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontFamily: "SpaceMono",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  summaryBudgetLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: "SpaceMono",
    marginTop: 2,
  },
  budgetSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  budgetBarLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: "SpaceMono",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  budgetBarTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "visible",
    marginBottom: 6,
    position: "relative",
  },
  budgetBarFill: { height: 8, borderRadius: 4 },
  budgetMarker: {
    position: "absolute",
    top: -4,
    width: 2,
    height: 16,
    backgroundColor: colors.textMuted + "88",
    borderRadius: 1,
  },
  budgetBarSub: { color: colors.textMuted, fontSize: 9, fontFamily: "SpaceMono" },
  cacheCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cacheHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cacheTitle: { color: colors.textMuted, fontSize: 9, fontFamily: "SpaceMono", letterSpacing: 1.5 },
  cachePct: { fontSize: 22, fontFamily: "SpaceMono", fontWeight: "700" },
  cacheBarTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginBottom: 6, overflow: "hidden" },
  cacheBarFill: { height: 6, borderRadius: 3 },
  cacheFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cacheLabel: { fontSize: 11, fontFamily: "SpaceMono" },
  cacheSavings: { color: colors.success, fontSize: 10, fontFamily: "SpaceMono" },
  cacheStats: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cacheStatItem: { flex: 1, padding: spacing.sm, alignItems: "center" },
  cacheStatDivider: { width: 1, backgroundColor: colors.border },
  cacheStatValue: { color: colors.text, fontSize: 14, fontFamily: "SpaceMono", fontWeight: "700" },
  cacheStatLabel: { color: colors.textMuted, fontSize: 9, fontFamily: "SpaceMono", marginTop: 2 },
  section: { marginBottom: spacing.md },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "SpaceMono",
    letterSpacing: 2,
    paddingHorizontal: spacing.md,
    marginBottom: 6,
  },
  sectionSub: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "SpaceMono",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    opacity: 0.6,
  },
  tokenCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
  },
  tokenLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tokenDot: { width: 8, height: 8, borderRadius: 4 },
  tokenLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: "SpaceMono" },
  tokenValue: { color: colors.text, fontSize: 14, fontFamily: "SpaceMono", fontWeight: "700" },
  tokenDivider: { height: 1, backgroundColor: colors.border },
  modelCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  modelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modelRowTop: { backgroundColor: colors.accentDim },
  modelLeft: { flex: 1, marginRight: spacing.md },
  modelNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 },
  modelName: { color: colors.text, fontSize: 12, fontFamily: "SpaceMono", flex: 1 },
  topBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topBadgeText: { color: "#fff", fontSize: 8, fontFamily: "SpaceMono", fontWeight: "700" },
  barTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 4,
    overflow: "hidden",
  },
  barFill: { height: 4, borderRadius: 2 },
  modelTokens: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono" },
  modelCost: { fontSize: 14, fontFamily: "SpaceMono", fontWeight: "700" },
  pricingCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pricingLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  pricingModel: { color: colors.text, fontSize: 12, fontFamily: "SpaceMono", flex: 1 },
  pricingCosts: { flexDirection: "row", alignItems: "center", gap: 4 },
  pricingCost: { color: colors.textSecondary, fontSize: 10, fontFamily: "SpaceMono" },
  pricingCostSep: { color: colors.textMuted, fontSize: 10 },
  tipCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.accentDim,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent + "44",
    padding: spacing.md,
  },
  tipTitle: { color: colors.accent, fontSize: 9, fontFamily: "SpaceMono", letterSpacing: 2, marginBottom: 6, fontWeight: "700" },
  tipText: { color: colors.textSecondary, fontSize: 12, fontFamily: "SpaceMono", lineHeight: 18 },
  // Budget modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "#000000cc",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: 40,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: spacing.lg,
  },
  modalLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "SpaceMono",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: colors.text,
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
  },
  modalCancelText: { color: colors.textMuted, fontFamily: "SpaceMono", fontSize: 13 },
  modalSave: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
  },
  modalSaveText: { color: "#fff", fontFamily: "SpaceMono", fontSize: 13, fontWeight: "700" },
});
