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

const BG = "#0c0c0e";
const CARD = "#0e0e11";
const BORDER = "#1a1a20";
const SURFACE = "#13131a";
const TEXT = "#f0f0f0";
const TEXT_MUTED = "#555566";
const TEXT_DIM = "#888899";
const ACCENT = "#f97316";
const ACCENT_DIM = "#f9731614";
const GREEN = "#22c55e";
const YELLOW = "#eab308";
const RED = "#ef4444";

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

function ScanLine() {
  return <View style={styles.scanLine} />;
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
          {/* header bar */}
          <View style={styles.modalTopBar}>
            <View style={styles.modalPill} />
          </View>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalSysLabel}>SYS://BUDGET.CONFIG</Text>
            <View style={styles.statusDot} />
          </View>
          <ScanLine />

          <Text style={styles.modalFieldLabel}>// monthly limit (USD)</Text>
          <TextInput
            style={styles.modalInput}
            value={monthly}
            onChangeText={setMonthly}
            placeholder="50.00"
            placeholderTextColor={TEXT_MUTED}
            keyboardType="decimal-pad"
          />

          <Text style={styles.modalFieldLabel}>// daily limit (USD, optional)</Text>
          <TextInput
            style={styles.modalInput}
            value={daily}
            onChangeText={setDaily}
            placeholder="5.00"
            placeholderTextColor={TEXT_MUTED}
            keyboardType="decimal-pad"
          />

          <Text style={styles.modalFieldLabel}>// alert threshold (%)</Text>
          <TextInput
            style={styles.modalInput}
            value={alertPct}
            onChangeText={setAlertPct}
            placeholder="80"
            placeholderTextColor={TEXT_MUTED}
            keyboardType="number-pad"
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>ABORT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSave} onPress={save}>
              <Text style={styles.modalSaveText}>WRITE</Text>
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

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

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
  const warnBudget =
    budget.monthlyLimitUsd !== null && monthlyProj > budget.monthlyLimitUsd * 0.8;
  const budgetPct =
    budget.monthlyLimitUsd !== null
      ? Math.min(100, Math.round((monthlyProj / budget.monthlyLimitUsd) * 100))
      : 0;
  const budgetColor = overBudget ? RED : warnBudget ? YELLOW : GREEN;

  return (
    <>
      <ScrollView
        style={[styles.root]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={ACCENT}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.sysLabel}>SYS://COST.MONITOR</Text>
            <Text style={styles.headerTitle}>TOKEN SPEND</Text>
          </View>
          <TouchableOpacity style={styles.budgetBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.budgetBtnText}>⚙ BUDGET</Text>
          </TouchableOpacity>
        </View>

        <ScanLine />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={ACCENT} size="large" />
            <Text style={styles.loadingText}>QUERYING TELEMETRY...</Text>
          </View>
        ) : (
          <>
            {/* Hero cost grid */}
            <View style={styles.heroGrid}>
              <View style={[styles.heroCard, styles.heroCardLarge]}>
                <Text style={styles.heroLabel}>TODAY</Text>
                <Text style={styles.heroCostMain}>{formatCost(totalCost)}</Text>
                <View style={[styles.heroBadge, { backgroundColor: GREEN + "22" }]}>
                  <Text style={[styles.heroBadgeText, { color: GREEN }]}>● LIVE</Text>
                </View>
              </View>
              <View style={styles.heroCardSmallCol}>
                <View style={[styles.heroCard, styles.heroCardSmall]}>
                  <Text style={styles.heroLabel}>PROJECTED</Text>
                  <Text style={[styles.heroCostSm, { color: budgetColor }]}>
                    {formatCost(monthlyProj)}
                  </Text>
                  <Text style={styles.heroSubLabel}>/mo</Text>
                </View>
                <View style={[styles.heroCard, styles.heroCardSmall]}>
                  <Text style={styles.heroLabel}>SESSIONS</Text>
                  <Text style={styles.heroCostSm}>{analytics?.totalSessions ?? 0}</Text>
                  <Text style={styles.heroSubLabel}>total</Text>
                </View>
              </View>
            </View>

            {/* Budget bar */}
            {budget.monthlyLimitUsd !== null && (
              <View style={styles.budgetCard}>
                <View style={styles.budgetCardHeader}>
                  <Text style={styles.budgetCardLabel}>MONTHLY BUDGET ALLOCATION</Text>
                  <Text style={[styles.budgetPct, { color: budgetColor }]}>{budgetPct}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(2, budgetPct)}%`, backgroundColor: budgetColor },
                    ]}
                  />
                </View>
                <View style={styles.budgetCardFooter}>
                  <Text style={styles.budgetCardSub}>
                    {formatCost(monthlyProj)} / ${budget.monthlyLimitUsd} limit
                  </Text>
                  {overBudget && (
                    <Text style={[styles.budgetCardWarn, { color: RED }]}>⚠ OVER LIMIT</Text>
                  )}
                  {!overBudget && warnBudget && (
                    <Text style={[styles.budgetCardWarn, { color: YELLOW }]}>⚠ APPROACHING</Text>
                  )}
                </View>
              </View>
            )}

            {/* Model breakdown */}
            {modelBreakdown.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>// MODEL BREAKDOWN</Text>
                <View style={styles.tableCard}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderCell}>MODEL</Text>
                    <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>COST</Text>
                  </View>
                  <View style={styles.tableDivider} />
                  {modelBreakdown.map((m, i) => {
                    const cost = parseFloat(m.totalCost);
                    const pct = (cost / maxCost) * 100;
                    const rowColor = cost > 0.05 ? RED : cost > 0.01 ? YELLOW : GREEN;
                    return (
                      <View key={m.model}>
                        <View style={styles.tableRow}>
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={styles.tableModel}>{m.model}</Text>
                            <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.barFill,
                                  {
                                    width: `${Math.max(2, pct)}%`,
                                    backgroundColor: rowColor + "99",
                                  },
                                ]}
                              />
                            </View>
                          </View>
                          <Text style={[styles.tableCost, { color: rowColor }]}>
                            {formatCost(cost)}
                          </Text>
                        </View>
                        {i < modelBreakdown.length - 1 && (
                          <View style={styles.tableDivider} />
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Pricing reference */}
            <Text style={styles.sectionLabel}>// PRICING REFERENCE ($/1M tokens)</Text>
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderCell}>MODEL</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: "center" }]}>IN</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>OUT</Text>
              </View>
              <View style={styles.tableDivider} />
              {Object.keys(MODEL_INPUT_COSTS).map((model, i) => (
                <View key={model}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceModel}>{model}</Text>
                    <Text style={[styles.priceVal, { textAlign: "center" }]}>
                      ${MODEL_INPUT_COSTS[model]}
                    </Text>
                    <Text style={[styles.priceVal, { textAlign: "right" }]}>
                      ${MODEL_OUTPUT_COSTS[model]}
                    </Text>
                  </View>
                  {i < Object.keys(MODEL_INPUT_COSTS).length - 1 && (
                    <View style={styles.tableDivider} />
                  )}
                </View>
              ))}
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
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sysLabel: {
    color: TEXT_MUTED,
    fontFamily: "SpaceMono",
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: {
    color: TEXT,
    fontFamily: "SpaceMono",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
  },
  budgetBtn: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: ACCENT_DIM,
  },
  budgetBtnText: { color: ACCENT, fontFamily: "SpaceMono", fontSize: 10, letterSpacing: 1 },

  scanLine: { height: 1, backgroundColor: BORDER, marginBottom: 16 },

  loadingWrap: { alignItems: "center", paddingTop: 80, gap: 12 },
  loadingText: { color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 10, letterSpacing: 2 },

  // Hero
  heroGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },
  heroCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
  },
  heroCardLarge: { flex: 1.4, justifyContent: "space-between" },
  heroCardSmallCol: { flex: 1, gap: 10 },
  heroCardSmall: { flex: 1, justifyContent: "space-between" },
  heroLabel: {
    color: TEXT_MUTED,
    fontFamily: "SpaceMono",
    fontSize: 8,
    letterSpacing: 2,
    marginBottom: 6,
  },
  heroCostMain: { color: ACCENT, fontFamily: "SpaceMono", fontSize: 28, fontWeight: "700" },
  heroCostSm: { color: TEXT, fontFamily: "SpaceMono", fontSize: 17, fontWeight: "700" },
  heroSubLabel: { color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 9, marginTop: 2 },
  heroBadge: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 8,
  },
  heroBadgeText: { fontFamily: "SpaceMono", fontSize: 9, letterSpacing: 1 },

  // Budget
  budgetCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  budgetCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  budgetCardLabel: {
    color: TEXT_MUTED,
    fontFamily: "SpaceMono",
    fontSize: 8,
    letterSpacing: 2,
  },
  budgetPct: { fontFamily: "SpaceMono", fontSize: 13, fontWeight: "700" },
  barTrack: {
    height: 4,
    backgroundColor: "#ffffff0d",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 2,
  },
  barFill: { height: 4, borderRadius: 2 },
  budgetCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  budgetCardSub: { color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 9 },
  budgetCardWarn: { fontFamily: "SpaceMono", fontSize: 9, letterSpacing: 1 },

  // Section label
  sectionLabel: {
    color: TEXT_MUTED,
    fontFamily: "SpaceMono",
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 8,
  },

  // Table
  tableCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: SURFACE,
  },
  tableHeaderCell: {
    flex: 1,
    color: TEXT_MUTED,
    fontFamily: "SpaceMono",
    fontSize: 8,
    letterSpacing: 2,
  },
  tableDivider: { height: 1, backgroundColor: BORDER },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tableModel: { color: TEXT_DIM, fontFamily: "SpaceMono", fontSize: 11, marginBottom: 4 },
  tableCost: { fontFamily: "SpaceMono", fontSize: 13, fontWeight: "700", minWidth: 60, textAlign: "right" },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  priceModel: { flex: 2, color: TEXT_DIM, fontFamily: "SpaceMono", fontSize: 10 },
  priceVal: { flex: 1, color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 10 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000dd", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    paddingBottom: 40,
  },
  modalTopBar: { alignItems: "center", marginBottom: 16 },
  modalPill: { width: 36, height: 4, backgroundColor: BORDER, borderRadius: 2 },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalSysLabel: { color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 9, letterSpacing: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  modalFieldLabel: {
    color: TEXT_MUTED,
    fontFamily: "SpaceMono",
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 14,
  },
  modalInput: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 12,
    color: TEXT,
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: { color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 12, letterSpacing: 1 },
  modalSave: {
    flex: 1,
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalSaveText: { color: "#fff", fontFamily: "SpaceMono", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
});
