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

const MODEL_INPUT_COSTS: Record<string, number> = {
  "claude-opus-4-5": 15,
  "claude-sonnet-4-5": 3,
  "claude-haiku-3-5": 0.8,
  "gpt-4o": 5,
  "gpt-4o-mini": 0.15,
  "o3-mini": 1.1,
  "gemini-2-5-pro": 1.25,
  "gemini-2-5-flash": 0.1,
};
const MODEL_OUTPUT_COSTS: Record<string, number> = {
  "claude-opus-4-5": 75,
  "claude-sonnet-4-5": 15,
  "claude-haiku-3-5": 4,
  "gpt-4o": 15,
  "gpt-4o-mini": 0.6,
  "o3-mini": 4.4,
  "gemini-2-5-pro": 10,
  "gemini-2-5-flash": 0.4,
};

function formatCost(costUsd: number): string {
  if (costUsd < 0.0001) return "<$0.0001";
  if (costUsd < 1) return `$${costUsd.toFixed(4)}`;
  return `$${costUsd.toFixed(2)}`;
}

function BudgetModal({
  visible,
  budget,
  onSave,
  onClose,
}: {
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Budget Settings</Text>

          <Text style={styles.fieldLabel}>Monthly limit (USD)</Text>
          <TextInput
            style={styles.fieldInput}
            value={monthly}
            onChangeText={setMonthly}
            placeholder="50.00"
            placeholderTextColor="#444"
            keyboardType="decimal-pad"
          />

          <Text style={styles.fieldLabel}>Daily limit (optional)</Text>
          <TextInput
            style={styles.fieldInput}
            value={daily}
            onChangeText={setDaily}
            placeholder="5.00"
            placeholderTextColor="#444"
            keyboardType="decimal-pad"
          />

          <Text style={styles.fieldLabel}>Alert threshold (%)</Text>
          <TextInput
            style={styles.fieldInput}
            value={alertPct}
            onChangeText={setAlertPct}
            placeholder="80"
            placeholderTextColor="#444"
            keyboardType="number-pad"
          />

          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={save}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CostScreen() {
  const insets = useSafeAreaInsets();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [budget, setBudget] = useState<BudgetConfig>({
    dailyLimitUsd: null,
    monthlyLimitUsd: 50,
    alertAtPct: 80,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
  const budgetColor = overBudget ? "#ef4444" : warnBudget ? "#f59e0b" : "#22c55e";

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor="#555"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Costs</Text>
          <TouchableOpacity style={styles.budgetBtn} onPress={() => setShowModal(true)} activeOpacity={0.7}>
            <Text style={styles.budgetBtnText}>Budget</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadWrap}>
            <ActivityIndicator color="#888" size="large" />
          </View>
        ) : (
          <>
            {/* Metric cards */}
            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Today</Text>
                <Text style={styles.metricValue}>{formatCost(totalCost)}</Text>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              </View>
              <View style={styles.metricCardSmallCol}>
                <View style={styles.metricCardSmall}>
                  <Text style={styles.metricLabel}>Projected</Text>
                  <Text style={[styles.metricValueSm, { color: budgetColor }]}>
                    {formatCost(monthlyProj)}
                  </Text>
                  <Text style={styles.metricUnit}>/mo</Text>
                </View>
                <View style={styles.metricCardSmall}>
                  <Text style={styles.metricLabel}>Sessions</Text>
                  <Text style={styles.metricValueSm}>{analytics?.totalSessions ?? 0}</Text>
                  <Text style={styles.metricUnit}>total</Text>
                </View>
              </View>
            </View>

            {/* Budget bar */}
            {budget.monthlyLimitUsd !== null && (
              <View style={styles.budgetCard}>
                <View style={styles.budgetCardHeader}>
                  <Text style={styles.budgetCardLabel}>Monthly budget</Text>
                  <Text style={[styles.budgetPct, { color: budgetColor }]}>{budgetPct}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(2, budgetPct)}%` as any, backgroundColor: budgetColor },
                    ]}
                  />
                </View>
                <View style={styles.budgetFooter}>
                  <Text style={styles.budgetSub}>
                    {formatCost(monthlyProj)} of ${budget.monthlyLimitUsd}
                  </Text>
                  {overBudget && <Text style={styles.budgetWarn}>Over limit</Text>}
                  {!overBudget && warnBudget && <Text style={[styles.budgetWarn, { color: "#f59e0b" }]}>Approaching</Text>}
                </View>
              </View>
            )}

            {/* Model breakdown */}
            {modelBreakdown.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Model breakdown</Text>
                <View style={styles.tableCard}>
                  <View style={styles.tableHead}>
                    <Text style={styles.tableHeadCell}>Model</Text>
                    <Text style={[styles.tableHeadCell, { textAlign: "right" }]}>Cost</Text>
                  </View>
                  {modelBreakdown.map((m, i) => {
                    const cost = parseFloat(m.totalCost);
                    const pct = (cost / maxCost) * 100;
                    const rowColor = cost > 0.05 ? "#ef4444" : cost > 0.01 ? "#f59e0b" : "#22c55e";
                    return (
                      <View key={m.model}>
                        {i > 0 && <View style={styles.divider} />}
                        <View style={styles.tableRow}>
                          <View style={styles.tableRowLeft}>
                            <Text style={styles.tableModel}>{m.model}</Text>
                            <View style={styles.barTrack}>
                              <View style={[styles.barFill, { width: `${Math.max(2, pct)}%` as any, backgroundColor: rowColor + "88" }]} />
                            </View>
                          </View>
                          <Text style={[styles.tableCost, { color: rowColor }]}>{formatCost(cost)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Pricing reference */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Pricing reference ($/1M tokens)</Text>
              <View style={styles.tableCard}>
                <View style={styles.tableHead}>
                  <Text style={[styles.tableHeadCell, { flex: 2 }]}>Model</Text>
                  <Text style={[styles.tableHeadCell, { textAlign: "center" }]}>Input</Text>
                  <Text style={[styles.tableHeadCell, { textAlign: "right" }]}>Output</Text>
                </View>
                {Object.keys(MODEL_INPUT_COSTS).map((model, i) => (
                  <View key={model}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.priceRow}>
                      <Text style={styles.priceModel}>{model}</Text>
                      <Text style={[styles.priceVal, { textAlign: "center" }]}>${MODEL_INPUT_COSTS[model]}</Text>
                      <Text style={[styles.priceVal, { textAlign: "right" }]}>${MODEL_OUTPUT_COSTS[model]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      <BudgetModal
        visible={showModal}
        budget={budget}
        onSave={saveBudget}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#141414" },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: { color: "#e8e8e8", fontSize: 22, fontWeight: "600" },
  budgetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#303030",
  },
  budgetBtnText: { color: "#888", fontSize: 13 },

  loadWrap: { alignItems: "center", paddingTop: 80 },

  // Metrics
  metricRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  metricCard: {
    flex: 1.4,
    backgroundColor: "#1c1c1c",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#252525",
    justifyContent: "space-between",
  },
  metricCardSmallCol: { flex: 1, gap: 10 },
  metricCardSmall: {
    flex: 1,
    backgroundColor: "#1c1c1c",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#252525",
  },
  metricLabel: { color: "#555", fontSize: 11, marginBottom: 6 },
  metricValue: { color: "#f0f0f0", fontSize: 26, fontWeight: "600", marginBottom: 8 },
  metricValueSm: { color: "#e0e0e0", fontSize: 17, fontWeight: "600" },
  metricUnit: { color: "#444", fontSize: 10, marginTop: 2 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  liveText: { color: "#22c55e", fontSize: 11, fontWeight: "500" },

  // Budget
  budgetCard: {
    backgroundColor: "#1c1c1c",
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#252525",
  },
  budgetCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  budgetCardLabel: { color: "#666", fontSize: 12 },
  budgetPct: { fontSize: 14, fontWeight: "600" },
  barTrack: { height: 4, backgroundColor: "#ffffff0d", borderRadius: 2, overflow: "hidden", marginBottom: 2 },
  barFill: { height: 4, borderRadius: 2 },
  budgetFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  budgetSub: { color: "#555", fontSize: 11 },
  budgetWarn: { color: "#ef4444", fontSize: 11 },

  // Section
  section: { marginTop: 24 },
  sectionLabel: { color: "#555", fontSize: 12, fontWeight: "500", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 },

  // Table
  tableCard: {
    backgroundColor: "#1c1c1c",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#252525",
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#181818",
  },
  tableHeadCell: { flex: 1, color: "#444", fontSize: 11, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: "#222" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tableRowLeft: { flex: 1, marginRight: 12 },
  tableModel: { color: "#aaa", fontSize: 12, marginBottom: 5 },
  tableCost: { fontSize: 13, fontWeight: "600", minWidth: 60, textAlign: "right" },

  priceRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 },
  priceModel: { flex: 2, color: "#888", fontSize: 11 },
  priceVal: { flex: 1, color: "#555", fontSize: 11 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000cc", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#1c1c1c",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    padding: 20,
    paddingBottom: 40,
  },
  modalHandle: { width: 36, height: 4, backgroundColor: "#333", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { color: "#e0e0e0", fontSize: 17, fontWeight: "600", marginBottom: 20 },
  fieldLabel: { color: "#666", fontSize: 12, marginBottom: 6, marginTop: 14 },
  fieldInput: {
    backgroundColor: "#252525",
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 10,
    padding: 12,
    color: "#e0e0e0",
    fontSize: 15,
  },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelBtnText: { color: "#888", fontSize: 14 },
  saveBtn: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveBtnText: { color: "#000", fontSize: 14, fontWeight: "600" },
});
