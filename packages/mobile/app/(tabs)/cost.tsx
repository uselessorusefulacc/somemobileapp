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
  "claude-opus-4-5": 15, "claude-sonnet-4-5": 3, "claude-haiku-3-5": 0.8,
  "gpt-4o": 5, "gpt-4o-mini": 0.15, "o3-mini": 1.1,
  "gemini-2-5-pro": 1.25, "gemini-2-5-flash": 0.1,
};
const MODEL_OUTPUT_COSTS: Record<string, number> = {
  "claude-opus-4-5": 75, "claude-sonnet-4-5": 15, "claude-haiku-3-5": 4,
  "gpt-4o": 15, "gpt-4o-mini": 0.6, "o3-mini": 4.4,
  "gemini-2-5-pro": 10, "gemini-2-5-flash": 0.4,
};

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function SummaryBox({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function BudgetBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.min(100, Math.max(2, pct))}%`, backgroundColor: color }]} />
    </View>
  );
}

function BudgetModal({ visible, budget, onSave, onClose }: { visible: boolean; budget: BudgetConfig; onSave: (b: BudgetConfig) => void; onClose: () => void }) {
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>BUDGET SETTINGS</Text>
          <Text style={styles.modalLabel}>Monthly limit (USD)</Text>
          <TextInput style={styles.modalInput} value={monthly} onChangeText={setMonthly} placeholder="50" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
          <Text style={styles.modalLabel}>Daily limit (USD, optional)</Text>
          <TextInput style={styles.modalInput} value={daily} onChangeText={setDaily} placeholder="5" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
          <Text style={styles.modalLabel}>Alert at (%)</Text>
          <TextInput style={styles.modalInput} value={alertPct} onChangeText={setAlertPct} placeholder="80" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
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
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [analyticsData, budgetData] = await Promise.all([apiClient.getAnalytics(), apiClient.getBudget()]);
      setAnalytics(analyticsData);
      setBudget(budgetData);
    } catch (e) {
      console.error("cost load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const saveBudget = async (cfg: BudgetConfig) => {
    try { const updated = await apiClient.setBudget(cfg); setBudget(updated); Alert.alert("Saved", "Budget updated."); }
    catch { Alert.alert("Error", "Failed to save budget."); }
  };

  const totalCost = parseFloat(analytics?.totalCost || "0");
  const monthlyProj = analytics?.projectedMonthlyCost ?? totalCost * 30;
  const modelBreakdown: ModelBreakdown[] = analytics?.modelBreakdown || [];
  const maxCost = Math.max(...modelBreakdown.map((m) => parseFloat(m.totalCost)), 0.0001);
  const overBudget = budget.monthlyLimitUsd !== null && monthlyProj > budget.monthlyLimitUsd;
  const warnBudget = budget.monthlyLimitUsd !== null && monthlyProj > budget.monthlyLimitUsd * 0.8;

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />}>

        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Costs</Text>
            <Text style={styles.headerSub}>Token spend breakdown</Text>
          </View>
          <TouchableOpacity style={styles.budgetBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.budgetBtnText}>Set Budget</Text>
          </TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} /> : (
          <>
            {/* Summary */}
            <View style={styles.summaryRow}>
              <SummaryBox label="TODAY" value={formatCost(totalCost)} />
              <SummaryBox label="PROJECTED" value={formatCost(monthlyProj)} color={overBudget ? colors.danger : warnBudget ? colors.warning : colors.text} />
              <SummaryBox label="SESSIONS" value={String(analytics?.totalSessions ?? 0)} />
            </View>

            {/* Budget bar */}
            {budget.monthlyLimitUsd !== null && (
              <Card>
                <Text style={styles.budgetLabel}>MONTHLY BUDGET</Text>
                <BudgetBar pct={(monthlyProj / budget.monthlyLimitUsd) * 100} color={overBudget ? colors.danger : warnBudget ? colors.warning : colors.success} />
                <Text style={styles.budgetSub}>{Math.round((monthlyProj / budget.monthlyLimitUsd) * 100)}% of ${budget.monthlyLimitUsd} limit</Text>
              </Card>
            )}

            {/* Model breakdown */}
            {modelBreakdown.length > 0 && (
              <>
                <SectionTitle text="By Model" />
                <Card>
                  {modelBreakdown.map((m, i) => {
                    const cost = parseFloat(m.totalCost);
                    const pct = (cost / maxCost) * 100;
                    return (
                      <View key={m.model} style={[styles.modelRow, i < modelBreakdown.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modelName}>{m.model}</Text>
                          <BudgetBar pct={pct} color={cost > 0.05 ? colors.danger : cost > 0.01 ? colors.warning : colors.success} />
                        </View>
                        <Text style={styles.modelCost}>{formatCost(cost)}</Text>
                      </View>
                    );
                  })}
                </Card>
              </>
            )}

            {/* Pricing */}
            <SectionTitle text="Pricing Reference" />
            <Card>
              {Object.keys(MODEL_INPUT_COSTS).map((model) => (
                <View key={model} style={styles.priceRow}>
                  <Text style={styles.priceModel}>{model}</Text>
                  <Text style={styles.priceValue}>${MODEL_INPUT_COSTS[model]}/M in · ${MODEL_OUTPUT_COSTS[model]}/M out</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <BudgetModal visible={showModal} budget={budget} onSave={saveBudget} onClose={() => setShowModal(false)} />
    </>
  );
}

function formatCost(costUsd: number): string {
  if (costUsd < 0.0001) return "<$0.0001";
  if (costUsd < 1) return `$${costUsd.toFixed(4)}`;
  return `$${costUsd.toFixed(2)}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { color: colors.text, fontSize: 24, fontFamily: "SpaceMono", fontWeight: "700" },
  headerSub: { color: colors.textMuted, fontSize: 11, fontFamily: "SpaceMono", marginTop: 2 },
  budgetBtn: { borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  budgetBtnText: { color: colors.accent, fontSize: 11, fontFamily: "SpaceMono" },

  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.sm, marginTop: spacing.md },

  summaryRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  summaryBox: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: "center" },
  summaryValue: { fontSize: 18, fontFamily: "SpaceMono", fontWeight: "700" },
  summaryLabel: { color: colors.textMuted, fontSize: 9, fontFamily: "SpaceMono", letterSpacing: 1, marginTop: 4 },

  barTrack: { height: 6, backgroundColor: "#ffffff10", borderRadius: 3, overflow: "hidden", marginTop: 4 },
  barFill: { height: 6, borderRadius: 3 },

  budgetLabel: { color: colors.textMuted, fontSize: 9, fontFamily: "SpaceMono", letterSpacing: 1.5, marginBottom: 8 },
  budgetSub: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", marginTop: 6 },

  modelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  modelName: { color: colors.text, fontSize: 12, fontFamily: "SpaceMono", marginBottom: 4 },
  modelCost: { color: colors.accent, fontSize: 13, fontFamily: "SpaceMono", fontWeight: "700", marginLeft: spacing.md },

  priceRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  priceModel: { color: colors.text, fontSize: 12, fontFamily: "SpaceMono" },
  priceValue: { color: colors.textSecondary, fontSize: 10, fontFamily: "SpaceMono" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000cc", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, paddingBottom: 40 },
  modalTitle: { color: colors.text, fontSize: 14, fontFamily: "SpaceMono", fontWeight: "700", letterSpacing: 2, marginBottom: spacing.lg },
  modalLabel: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", letterSpacing: 1, marginBottom: 6, marginTop: spacing.sm },
  modalInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, color: colors.text, fontFamily: "SpaceMono", fontSize: 14 },
  modalButtons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, alignItems: "center" },
  modalCancelText: { color: colors.textMuted, fontFamily: "SpaceMono", fontSize: 13 },
  modalSave: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.sm, alignItems: "center" },
  modalSaveText: { color: "#fff", fontFamily: "SpaceMono", fontSize: 13, fontWeight: "700" },
});
