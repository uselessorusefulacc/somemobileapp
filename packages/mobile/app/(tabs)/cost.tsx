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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type Analytics, type BudgetConfig, type ModelBreakdown } from "../../lib/api";
import { colors, spacing, radius, typography, formatCost } from "../../lib/theme";

const MODEL_INPUT_COSTS: Record<string, number> = {
  "claude-opus-4-5": 15, "claude-sonnet-4-5": 3, "claude-haiku-3-5": 0.8,
  "gpt-4o": 5, "gpt-4o-mini": 0.15, "o3-mini": 1.1,
  "gemini-2-5-pro": 1.25, "gemini-2-5-flash": 0.1,
};
const MODEL_OUTPUT_COSTS: Record<string, number> = {
  "claude-opus-4-5": 75, "claude-sonnet-4-5": 15, "claude-haiku-3-5": 4,
  "gpt-4o": 15, "gpt-4o-mini": 0.6, "o3-mini": 4.4,
  "gemini-2-5-pro": 10, "gemini-2-5-flash": 0.4,
};

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
    onSave({
      monthlyLimitUsd: monthly ? parseFloat(monthly) : null,
      dailyLimitUsd: daily ? parseFloat(daily) : null,
      alertAtPct: Math.max(1, Math.min(100, parseInt(alertPct) || 80)),
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={c.modalOverlay}>
        <View style={c.modalSheet}>
          <View style={c.modalHandle} />
          <Text style={c.modalTitle}>Budget</Text>

          <Text style={c.fieldLabel}>MONTHLY LIMIT (USD)</Text>
          <TextInput style={c.fieldInput} value={monthly} onChangeText={setMonthly}
            placeholder="50.00" placeholderTextColor={colors.textDisabled} keyboardType="decimal-pad" />

          <Text style={c.fieldLabel}>DAILY LIMIT (OPTIONAL)</Text>
          <TextInput style={c.fieldInput} value={daily} onChangeText={setDaily}
            placeholder="5.00" placeholderTextColor={colors.textDisabled} keyboardType="decimal-pad" />

          <Text style={c.fieldLabel}>ALERT AT (%)</Text>
          <TextInput style={c.fieldInput} value={alertPct} onChangeText={setAlertPct}
            placeholder="80" placeholderTextColor={colors.textDisabled} keyboardType="number-pad" />

          <View style={c.modalBtns}>
            <TouchableOpacity style={c.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={c.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={c.saveBtn} onPress={save} activeOpacity={0.7}>
              <Text style={c.saveBtnText}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ModelBar({ model, cost, maxCost }: { model: string; cost: number; maxCost: number }) {
  const pct = Math.max(4, (cost / maxCost) * 100);
  const costColor = cost > 0.05 ? colors.danger : cost > 0.01 ? colors.warning : colors.success;
  return (
    <View style={c.modelRow}>
      <View style={c.modelTop}>
        <Text style={c.modelName}>{model}</Text>
        <Text style={[c.modelCost, { color: costColor }]}>{formatCost(cost)}</Text>
      </View>
      <View style={c.barTrack}>
        <View style={[c.barFill, { width: `${pct}%` as any, backgroundColor: costColor }]} />
      </View>
    </View>
  );
}

export default function CostScreen() {
  const insets = useSafeAreaInsets();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [budget, setBudget] = useState<BudgetConfig>({
    dailyLimitUsd: null, monthlyLimitUsd: 50, alertAtPct: 80,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [a, b] = await Promise.all([apiClient.getAnalytics(), apiClient.getBudget()]);
      setAnalytics(a);
      setBudget(b);
    } catch (e) { console.error("cost load:", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const saveBudget = async (cfg: BudgetConfig) => {
    try {
      const updated = await apiClient.setBudget(cfg);
      setBudget(updated);
      Alert.alert("Saved", "Budget updated.");
    } catch { Alert.alert("Error", "Failed to save budget."); }
  };

  const totalCost = parseFloat(analytics?.totalCost || "0");
  const monthlyProj = analytics?.projectedMonthlyCost ?? totalCost * 30;
  const modelBreakdown: ModelBreakdown[] = analytics?.modelBreakdown || [];
  const maxCost = Math.max(...modelBreakdown.map((m) => parseFloat(m.totalCost)), 0.0001);
  const overBudget = budget.monthlyLimitUsd !== null && monthlyProj > budget.monthlyLimitUsd;
  const warnBudget = budget.monthlyLimitUsd !== null && monthlyProj > budget.monthlyLimitUsd * 0.8;
  const budgetPct = budget.monthlyLimitUsd !== null
    ? Math.min(100, (monthlyProj / budget.monthlyLimitUsd) * 100) : 0;
  const budgetColor = overBudget ? colors.danger : warnBudget ? colors.warning : colors.success;

  return (
    <>
      <ScrollView
        style={c.root}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.textTertiary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={c.header}>
          <Text style={c.headerTitle}>Costs</Text>
          <TouchableOpacity style={c.budgetBtn} onPress={() => setShowModal(true)} activeOpacity={0.7}>
            <Text style={c.budgetBtnText}>BUDGET</Text>
          </TouchableOpacity>
        </View>

        <View style={c.divider} />

        {loading ? (
          <View style={c.center}>
            <ActivityIndicator color={colors.textTertiary} size="small" />
          </View>
        ) : (
          <>
            {/* Hero */}
            <View style={c.hero}>
              <Text style={c.heroLabel}>TOTAL SPEND</Text>
              <Text style={c.heroValue}>{formatCost(totalCost)}</Text>
              {budget.monthlyLimitUsd && (
                <Text style={[c.heroBudget, { color: budgetColor }]}>
                  {Math.round(budgetPct)}% of ${budget.monthlyLimitUsd}/mo limit
                </Text>
              )}
            </View>

            <View style={c.divider} />

            {/* Budget bar */}
            {budget.monthlyLimitUsd !== null && (
              <>
                <View style={c.budgetSection}>
                  <View style={c.budgetHeader}>
                    <Text style={c.budgetLabel}>MONTHLY BUDGET</Text>
                    <Text style={[c.budgetPct, { color: budgetColor }]}>
                      {formatCost(monthlyProj)} / ${budget.monthlyLimitUsd}
                    </Text>
                  </View>
                  <View style={c.budgetTrack}>
                    <View style={[c.budgetFill, { width: `${Math.min(100, budgetPct)}%` as any, backgroundColor: budgetColor }]} />
                  </View>
                  {overBudget && <Text style={[c.budgetStatus, { color: colors.danger }]}>OVER BUDGET</Text>}
                  {warnBudget && !overBudget && <Text style={[c.budgetStatus, { color: colors.warning }]}>APPROACHING LIMIT</Text>}
                </View>
                <View style={c.divider} />
              </>
            )}

            {/* Stats row */}
            <View style={c.statsRow}>
              <View style={c.statCell}>
                <Text style={c.statLabel}>TODAY</Text>
                <Text style={c.statValue}>{formatCost(totalCost)}</Text>
              </View>
              <View style={c.statDivider} />
              <View style={c.statCell}>
                <Text style={c.statLabel}>PROJECTED</Text>
                <Text style={[c.statValue, { color: budgetColor }]}>{formatCost(monthlyProj)}</Text>
              </View>
              <View style={c.statDivider} />
              <View style={c.statCell}>
                <Text style={c.statLabel}>SESSIONS</Text>
                <Text style={c.statValue}>{analytics?.totalSessions ?? 0}</Text>
              </View>
            </View>

            <View style={c.divider} />

            {/* Model breakdown */}
            {modelBreakdown.length > 0 && (
              <>
                <Text style={c.sectionLabel}>MODEL BREAKDOWN</Text>
                {modelBreakdown.map((m, i) => (
                  <React.Fragment key={m.model}>
                    {i > 0 && <View style={c.divider} />}
                    <ModelBar model={m.model} cost={parseFloat(m.totalCost)} maxCost={maxCost} />
                  </React.Fragment>
                ))}
                <View style={c.divider} />
              </>
            )}

            {/* Pricing table */}
            <Text style={c.sectionLabel}>PRICING ($/1M TOKENS)</Text>
            <View style={c.priceHeader}>
              <Text style={[c.priceCell, { flex: 2 }]}>MODEL</Text>
              <Text style={[c.priceCell, { textAlign: "center" }]}>INPUT</Text>
              <Text style={[c.priceCell, { textAlign: "right" }]}>OUTPUT</Text>
            </View>
            <View style={c.divider} />
            {Object.keys(MODEL_INPUT_COSTS).map((model, i) => (
              <React.Fragment key={model}>
                {i > 0 && <View style={c.divider} />}
                <View style={c.priceRow}>
                  <Text style={[c.priceModel, { flex: 2 }]}>{model}</Text>
                  <Text style={[c.priceVal, { textAlign: "center" }]}>${MODEL_INPUT_COSTS[model]}</Text>
                  <Text style={[c.priceVal, { textAlign: "right" }]}>${MODEL_OUTPUT_COSTS[model]}</Text>
                </View>
              </React.Fragment>
            ))}
          </>
        )}
      </ScrollView>

      <BudgetModal visible={showModal} budget={budget} onSave={saveBudget} onClose={() => setShowModal(false)} />
    </>
  );
}

const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", paddingTop: 80 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
  },
  headerTitle: { ...typography.title1, color: colors.text },
  budgetBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  budgetBtnText: { ...typography.label, color: colors.text },

  divider: { height: 1, backgroundColor: colors.border },

  hero: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing["2xl"],
  },
  heroLabel: { ...typography.label, color: colors.textTertiary, marginBottom: spacing.sm },
  heroValue: { fontSize: 36, fontWeight: "600", letterSpacing: -1, lineHeight: 42, color: colors.text, marginBottom: 6 },
  heroBudget: { ...typography.caption },

  budgetSection: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  budgetLabel: { ...typography.label, color: colors.textTertiary },
  budgetPct: { ...typography.caption, fontWeight: "500" },
  budgetTrack: { height: 3, backgroundColor: colors.surface, borderRadius: 2, overflow: "hidden" },
  budgetFill: { height: 3, borderRadius: 2, opacity: 0.8 },
  budgetStatus: { ...typography.label, marginTop: spacing.sm, fontSize: 9 },

  statsRow: { flexDirection: "row", alignItems: "stretch" },
  statCell: { flex: 1, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: 6 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statLabel: { ...typography.label, color: colors.textTertiary },
  statValue: { fontSize: 22, fontWeight: "600", letterSpacing: -0.5, color: colors.text },

  sectionLabel: {
    ...typography.label,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.base,
  },

  modelRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.base },
  modelTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modelName: { ...typography.bodySmall, color: colors.text },
  modelCost: { ...typography.bodySmall, fontWeight: "500" },
  barTrack: { height: 2, backgroundColor: colors.surface, borderRadius: 1, overflow: "hidden" },
  barFill: { height: 2, borderRadius: 1, opacity: 0.7 },

  priceHeader: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  priceCell: { ...typography.label, color: colors.textTertiary, flex: 1 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  priceModel: { ...typography.caption, color: colors.textSecondary },
  priceVal: { ...typography.caption, color: colors.textTertiary, flex: 1 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    padding: spacing.xl,
    paddingBottom: 48,
  },
  modalHandle: {
    width: 36, height: 3,
    backgroundColor: colors.borderStrong,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.xl,
  },
  modalTitle: { ...typography.title2, color: colors.text, marginBottom: spacing.xl },
  fieldLabel: { ...typography.label, color: colors.textTertiary, marginBottom: spacing.sm, marginTop: spacing.lg },
  fieldInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.base,
    color: colors.text,
    fontSize: 15,
  },
  modalBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing["2xl"] },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.base,
    alignItems: "center",
  },
  cancelBtnText: { ...typography.label, color: colors.textSecondary },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.text,
    borderRadius: radius.sm,
    paddingVertical: spacing.base,
    alignItems: "center",
  },
  saveBtnText: { ...typography.label, color: colors.bg },
});
