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
import {
  colors,
  spacing,
  radius,
  typography,
  formatCost,
} from "../../lib/theme";

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

// ── Bottom sheet modal (Figma-style) ───────────────────────────────
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
          <Text style={c.modalTitle}>Budget Settings</Text>

          <Text style={c.fieldLabel}>Monthly limit (USD)</Text>
          <TextInput
            style={c.fieldInput}
            value={monthly}
            onChangeText={setMonthly}
            placeholder="50.00"
            placeholderTextColor={colors.textDisabled}
            keyboardType="decimal-pad"
          />

          <Text style={c.fieldLabel}>Daily limit (optional)</Text>
          <TextInput
            style={c.fieldInput}
            value={daily}
            onChangeText={setDaily}
            placeholder="5.00"
            placeholderTextColor={colors.textDisabled}
            keyboardType="decimal-pad"
          />

          <Text style={c.fieldLabel}>Alert at (%)</Text>
          <TextInput
            style={c.fieldInput}
            value={alertPct}
            onChangeText={setAlertPct}
            placeholder="80"
            placeholderTextColor={colors.textDisabled}
            keyboardType="number-pad"
          />

          <View style={c.modalBtns}>
            <TouchableOpacity style={c.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={c.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={c.saveBtn} onPress={save} activeOpacity={0.7}>
              <Text style={c.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Progress ring (Apple Health-style) ─────────────────────────────
function ProgressRing({ pct, color, size = 120 }: { pct: number; color: string; size?: number }) {
  return (
    <View style={[c.ringWrap, { width: size, height: size }]}>
      <View style={[c.ringBg, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[c.ringFill, {
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: size * 0.425,
          borderColor: color,
          borderWidth: Math.max(3, size * 0.04),
          opacity: Math.min(1, pct / 100 + 0.3),
        }]} />
      </View>
      <View style={c.ringCenter}>
        <Text style={c.ringValue}>{Math.round(pct)}%</Text>
        <Text style={c.ringLabel}>used</Text>
      </View>
    </View>
  );
}

// ── Model bar (Stripe Dashboard-style data visualization) ────────────
function ModelBar({ model, cost, maxCost }: { model: string; cost: number; maxCost: number }) {
  const pct = Math.max(4, (cost / maxCost) * 100);
  const color = cost > 0.05 ? colors.danger : cost > 0.01 ? colors.warning : colors.success;
  return (
    <View style={c.modelBar}>
      <View style={c.modelBarInfo}>
        <Text style={c.modelBarName}>{model}</Text>
        <Text style={[c.modelBarCost, { color }]}>{formatCost(cost)}</Text>
      </View>
      <View style={c.modelBarTrack}>
        <View style={[c.modelBarFill, { width: `${pct}%`, backgroundColor: color + "60" }]} />
      </View>
    </View>
  );
}

// ── Main Cost Screen ───────────────────────────────────────────────
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
    } catch (e) {
      console.error("cost load:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const saveBudget = async (cfg: BudgetConfig) => {
    try {
      const updated = await apiClient.setBudget(cfg);
      setBudget(updated);
      Alert.alert("Saved", "Budget updated.");
    } catch {
      Alert.alert("Error", "Failed to save budget.");
    }
  };

  const totalCost = parseFloat(analytics?.totalCost || "0");
  const monthlyProj = analytics?.projectedMonthlyCost ?? totalCost * 30;
  const modelBreakdown: ModelBreakdown[] = analytics?.modelBreakdown || [];
  const maxCost = Math.max(...modelBreakdown.map((m) => parseFloat(m.totalCost)), 0.0001);

  const overBudget = budget.monthlyLimitUsd !== null && monthlyProj > budget.monthlyLimitUsd;
  const warnBudget = budget.monthlyLimitUsd !== null && monthlyProj > budget.monthlyLimitUsd * 0.8;
  const budgetPct = budget.monthlyLimitUsd !== null
    ? Math.min(100, Math.round((monthlyProj / budget.monthlyLimitUsd) * 100))
    : 0;
  const budgetColor = overBudget ? colors.danger : warnBudget ? colors.warning : colors.success;

  return (
    <>
      <ScrollView
        style={c.root}
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing["4xl"] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={c.header}>
          <Text style={c.headerTitle}>Costs</Text>
          <TouchableOpacity style={c.headerBtn} onPress={() => setShowModal(true)} activeOpacity={0.7}>
            <Text style={c.headerBtnText}>Budget</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={c.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <>
            {/* Budget ring */}
            {budget.monthlyLimitUsd !== null && (
              <View style={c.ringSection}>
                <ProgressRing pct={budgetPct} color={budgetColor} />
                <View style={c.ringInfo}>
                  <Text style={[c.ringInfoValue, { color: budgetColor }]}>{formatCost(monthlyProj)}</Text>
                  <Text style={c.ringInfoLabel}>of ${budget.monthlyLimitUsd}/mo</Text>
                  {overBudget && <Text style={[c.ringInfoStatus, { color: colors.danger }]}>Over budget</Text>}
                  {warnBudget && !overBudget && <Text style={[c.ringInfoStatus, { color: colors.warning }]}>Approaching limit</Text>}
                </View>
              </View>
            )}

            {/* Metrics */}
            <View style={c.metrics}>
              <View style={c.metricCard}>
                <Text style={c.metricLabel}>Today</Text>
                <Text style={c.metricValue}>{formatCost(totalCost)}</Text>
              </View>
              <View style={c.metricCard}>
                <Text style={c.metricLabel}>Projected</Text>
                <Text style={[c.metricValue, { color: budgetColor }]}>{formatCost(monthlyProj)}</Text>
              </View>
              <View style={c.metricCard}>
                <Text style={c.metricLabel}>Sessions</Text>
                <Text style={c.metricValue}>{analytics?.totalSessions ?? 0}</Text>
              </View>
            </View>

            {/* Model breakdown */}
            {modelBreakdown.length > 0 && (
              <View style={c.section}>
                <Text style={c.sectionTitle}>Model Breakdown</Text>
                <View style={c.card}>
                  {modelBreakdown.map((m, i) => (
                    <View key={m.model}>
                      {i > 0 && <View style={c.divider} />}
                      <ModelBar model={m.model} cost={parseFloat(m.totalCost)} maxCost={maxCost} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Pricing */}
            <View style={c.section}>
              <Text style={c.sectionTitle}>Pricing ($/1M tokens)</Text>
              <View style={c.card}>
                <View style={c.priceHead}>
                  <Text style={[c.priceCell, { flex: 2 }]}>Model</Text>
                  <Text style={[c.priceCell, { textAlign: "center" }]}>Input</Text>
                  <Text style={[c.priceCell, { textAlign: "right" }]}>Output</Text>
                </View>
                {Object.keys(MODEL_INPUT_COSTS).map((model, i) => (
                  <View key={model}>
                    {i > 0 && <View style={c.divider} />}
                    <View style={c.priceRow}>
                      <Text style={[c.priceModel, { flex: 2 }]}>{model}</Text>
                      <Text style={[c.priceVal, { textAlign: "center" }]}>${MODEL_INPUT_COSTS[model]}</Text>
                      <Text style={[c.priceVal, { textAlign: "right" }]}>${MODEL_OUTPUT_COSTS[model]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
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

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  headerTitle: { ...typography.title1, color: colors.text },
  headerBtn: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerBtnText: { ...typography.caption, color: colors.textSecondary, fontWeight: "500" },

  // Ring
  ringSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.xl,
  },
  ringWrap: { alignItems: "center", justifyContent: "center" },
  ringBg: {
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ringFill: {
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: 9999,
    backgroundColor: "transparent",
  },
  ringCenter: { position: "absolute", alignItems: "center" },
  ringValue: { ...typography.number, color: colors.text, fontWeight: "700" },
  ringLabel: { ...typography.caption, color: colors.textTertiary },
  ringInfo: { flex: 1 },
  ringInfoValue: { ...typography.title2, fontWeight: "700" },
  ringInfoLabel: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.xs },
  ringInfoStatus: { ...typography.caption, fontWeight: "600", marginTop: spacing.sm },

  // Metrics
  metrics: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing["2xl"],
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  metricLabel: { ...typography.label, color: colors.textTertiary, marginBottom: spacing.xs },
  metricValue: { ...typography.number, color: colors.text, fontWeight: "700" },

  // Section
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing["2xl"] },
  sectionTitle: { ...typography.title3, color: colors.text, marginBottom: spacing.base },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  divider: { height: 1, backgroundColor: colors.border },

  // Model bar
  modelBar: { padding: spacing.base },
  modelBarInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  modelBarName: { ...typography.bodySmall, color: colors.text },
  modelBarCost: { ...typography.body, fontSize: 14, fontWeight: "600" },
  modelBarTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  modelBarFill: { height: 4, borderRadius: 2 },

  // Price table
  priceHead: {
    flexDirection: "row",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgElevated,
  },
  priceCell: { ...typography.label, color: colors.textTertiary, flex: 1 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  priceModel: { ...typography.caption, color: colors.textSecondary },
  priceVal: { ...typography.caption, color: colors.textTertiary, flex: 1 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000aa", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    paddingBottom: spacing["4xl"],
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: { ...typography.title2, color: colors.text, marginBottom: spacing.xl },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.lg },
  fieldInput: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.base,
    color: colors.text,
    fontSize: 15,
  },
  modalBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing["2xl"] },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.base,
    alignItems: "center",
  },
  cancelBtnText: { color: colors.textSecondary, fontSize: 15, fontWeight: "500" },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.base,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
