import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Animated,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, type Analytics, type BudgetAlert } from "../../lib/api";
import { colors, fonts, radius, space } from "../../lib/theme";
import { formatCost, formatTokens } from "../../lib/format";

// ── Full provider + model pricing ──────────────────────────────────────────
const PROVIDER_COLORS: Record<string, string> = {
  openai:      "#10A37F",
  anthropic:   "#CC785C",
  google:      "#4285F4",
  groq:        "#F55036",
  deepseek:    "#4D6EFF",
  mistral:     "#FF7000",
  perplexity:  "#20B2AA",
  openrouter:  "#9B59B6",
  cohere:      "#39C5BB",
  together:    "#FF4785",
  fireworks:   "#FF6B35",
  azure:       "#0089D6",
  amazon:      "#FF9900",
  xai:         "#AAAAAA",
  meta:        "#0082FB",
  nvidia:      "#76B900",
  "01ai":      "#00D4FF",
  inflection:  "#FF6680",
  aleph:       "#00C896",
  other:       "#888888",
};

interface ModelPrice { in: number; out: number; provider: string; note?: string }

const MODEL_PRICING: Record<string, ModelPrice> = {
  // ── OpenAI ──
  "gpt-4.1":              { in: 2.00,  out: 8.00,   provider: "openai"    },
  "gpt-4.1-mini":         { in: 0.40,  out: 1.60,   provider: "openai"    },
  "gpt-4.1-nano":         { in: 0.10,  out: 0.40,   provider: "openai"    },
  "gpt-4o":               { in: 2.50,  out: 10.00,  provider: "openai"    },
  "gpt-4o-mini":          { in: 0.15,  out: 0.60,   provider: "openai"    },
  "gpt-4-turbo":          { in: 10.00, out: 30.00,  provider: "openai"    },
  "gpt-3.5-turbo":        { in: 0.50,  out: 1.50,   provider: "openai"    },
  "o1":                   { in: 15.00, out: 60.00,  provider: "openai"    },
  "o1-mini":              { in: 3.00,  out: 12.00,  provider: "openai"    },
  "o3":                   { in: 0.40,  out: 1.60,   provider: "openai"    },
  "o3-mini":              { in: 1.10,  out: 4.40,   provider: "openai"    },
  "o4-mini":              { in: 1.10,  out: 4.40,   provider: "openai"    },
  // ── Anthropic ──
  "claude-opus-4":        { in: 5.00,  out: 25.00,  provider: "anthropic" },
  "claude-opus-4-5":      { in: 15.00, out: 75.00,  provider: "anthropic" },
  "claude-sonnet-4":      { in: 3.00,  out: 15.00,  provider: "anthropic" },
  "claude-sonnet-4-5":    { in: 3.00,  out: 15.00,  provider: "anthropic" },
  "claude-haiku-4.5":     { in: 1.00,  out: 5.00,   provider: "anthropic" },
  "claude-haiku-3.5":     { in: 0.80,  out: 4.00,   provider: "anthropic" },
  "claude-haiku-3":       { in: 0.25,  out: 1.25,   provider: "anthropic" },
  "claude-3-5-sonnet":    { in: 3.00,  out: 15.00,  provider: "anthropic" },
  "claude-3-opus":        { in: 15.00, out: 75.00,  provider: "anthropic" },
  // ── Google ──
  "gemini-2.5-pro":       { in: 1.25,  out: 10.00,  provider: "google"    },
  "gemini-2.5-flash":     { in: 0.30,  out: 2.50,   provider: "google"    },
  "gemini-2.0-flash":     { in: 0.10,  out: 0.40,   provider: "google"    },
  "gemini-1.5-pro":       { in: 1.25,  out: 5.00,   provider: "google"    },
  "gemini-1.5-flash":     { in: 0.075, out: 0.30,   provider: "google"    },
  "gemini-3.5-flash":     { in: 1.50,  out: 9.00,   provider: "google"    },
  // ── Groq ──
  "llama-3.3-70b-versatile":  { in: 0.59, out: 0.79,  provider: "groq"  },
  "llama-3.1-8b-instant":     { in: 0.05, out: 0.08,  provider: "groq"  },
  "llama-3.1-70b-versatile":  { in: 0.59, out: 0.79,  provider: "groq"  },
  "mixtral-8x7b-32768":       { in: 0.24, out: 0.24,  provider: "groq"  },
  "gemma2-9b-it":             { in: 0.20, out: 0.20,  provider: "groq"  },
  // ── DeepSeek ──
  "deepseek-v3":          { in: 0.14,  out: 0.28,   provider: "deepseek"  },
  "deepseek-v3-0324":     { in: 0.14,  out: 0.28,   provider: "deepseek"  },
  "deepseek-r1":          { in: 0.55,  out: 2.19,   provider: "deepseek"  },
  "deepseek-r1-0528":     { in: 0.55,  out: 2.19,   provider: "deepseek"  },
  "deepseek-coder-v2":    { in: 0.14,  out: 0.28,   provider: "deepseek"  },
  // ── Mistral ──
  "mistral-large-latest": { in: 2.00,  out: 6.00,   provider: "mistral"   },
  "mistral-medium":       { in: 0.40,  out: 1.20,   provider: "mistral"   },
  "mistral-small-latest": { in: 0.10,  out: 0.30,   provider: "mistral"   },
  "codestral-latest":     { in: 0.20,  out: 0.60,   provider: "mistral"   },
  "mistral-7b-instruct":  { in: 0.025, out: 0.025,  provider: "mistral"   },
  "mixtral-8x22b":        { in: 1.20,  out: 1.20,   provider: "mistral"   },
  // ── Perplexity ──
  "sonar-pro":            { in: 3.00,  out: 15.00,  provider: "perplexity" },
  "sonar":                { in: 1.00,  out: 1.00,   provider: "perplexity" },
  "sonar-reasoning":      { in: 1.00,  out: 5.00,   provider: "perplexity" },
  "sonar-reasoning-pro":  { in: 2.00,  out: 8.00,   provider: "perplexity" },
  // ── OpenRouter ──
  "openrouter/auto":      { in: 0,     out: 0,      provider: "openrouter", note: "varies" },
  // ── Cohere ──
  "command-r-plus":       { in: 2.50,  out: 10.00,  provider: "cohere"    },
  "command-r":            { in: 0.15,  out: 0.60,   provider: "cohere"    },
  "command-a-03-2025":    { in: 2.50,  out: 10.00,  provider: "cohere"    },
  // ── Together AI ──
  "together/llama-3.1-405b": { in: 3.50, out: 3.50, provider: "together" },
  "together/mixtral-8x22b":  { in: 1.20, out: 1.20, provider: "together" },
  // ── Fireworks ──
  "fw/llama-v3p1-405b":   { in: 3.00,  out: 3.00,   provider: "fireworks" },
  "fw/llama-v3p1-70b":    { in: 0.90,  out: 0.90,   provider: "fireworks" },
  // ── Azure OpenAI ──
  "azure/gpt-4o":         { in: 2.50,  out: 10.00,  provider: "azure"     },
  "azure/gpt-4o-mini":    { in: 0.15,  out: 0.60,   provider: "azure"     },
  // ── Amazon Bedrock ──
  "bedrock/claude-3-5-sonnet": { in: 3.00, out: 15.00, provider: "amazon" },
  "bedrock/llama-3-70b":       { in: 0.72, out: 0.72,  provider: "amazon" },
  // ── xAI ──
  "grok-3":               { in: 3.00,  out: 15.00,  provider: "xai"       },
  "grok-3-mini":          { in: 0.30,  out: 0.50,   provider: "xai"       },
  "grok-2":               { in: 2.00,  out: 10.00,  provider: "xai"       },
  // ── Meta (via API) ──
  "meta/llama-3.1-405b":  { in: 2.70,  out: 2.70,   provider: "meta"      },
  "meta/llama-3.1-70b":   { in: 0.72,  out: 0.72,   provider: "meta"      },
  "meta/llama-3.2-90b":   { in: 2.00,  out: 2.00,   provider: "meta"      },
  // ── NVIDIA ──
  "nvidia/llama-3.1-nemotron-70b": { in: 0.35, out: 0.40, provider: "nvidia" },
  // ── 01.AI ──
  "yi-large":             { in: 3.00,  out: 3.00,   provider: "01ai"      },
  "yi-medium":            { in: 0.80,  out: 0.80,   provider: "01ai"      },
};

// Group by provider
const PROVIDER_ORDER = ["openai","anthropic","google","groq","deepseek","mistral","perplexity","openrouter","cohere","together","fireworks","azure","amazon","xai","meta","nvidia","01ai"];

interface ProviderGroup { id: string; models: [string, ModelPrice][] }
function buildGroups(): ProviderGroup[] {
  const map = new Map<string, [string, ModelPrice][]>();
  for (const [model, price] of Object.entries(MODEL_PRICING)) {
    const pid = price.provider;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push([model, price]);
  }
  const result: ProviderGroup[] = [];
  for (const pid of PROVIDER_ORDER) {
    if (map.has(pid)) result.push({ id: pid, models: map.get(pid)! });
  }
  // any extra not in order
  for (const [pid, models] of map) {
    if (!PROVIDER_ORDER.includes(pid)) result.push({ id: pid, models });
  }
  return result;
}

const PROVIDER_GROUPS = buildGroups();

// ── Model pricing modal ────────────────────────────────────────────────────
function ModelSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
      ]).start();
    } else {
      slideY.setValue(400);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <Animated.View style={[mo.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[mo.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideY }] }]}>
          <View style={mo.handle} />
          <View style={mo.sheetHead}>
            <Text style={mo.sheetTitle}>MODEL PRICING</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7}>
              <Text style={mo.closeX}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={mo.divider} />
          <View style={mo.tableHead}>
            <Text style={[mo.col1, mo.headCell]}>MODEL</Text>
            <Text style={[mo.col2, mo.headCell]}>IN /1M</Text>
            <Text style={[mo.col2, mo.headCell]}>OUT /1M</Text>
          </View>
          <View style={mo.divider} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {PROVIDER_GROUPS.map((group) => {
              const pColor = PROVIDER_COLORS[group.id] ?? PROVIDER_COLORS.other;
              return (
                <View key={group.id}>
                  {/* Provider header */}
                  <View style={[mo.providerHeader, { borderLeftColor: pColor }]}>
                    <Text style={[mo.providerLabel, { color: pColor }]}>{group.id.toUpperCase()}</Text>
                  </View>
                  {group.models.map(([model, price], i) => (
                    <View key={model}>
                      <View style={mo.tableRow}>
                        <View style={mo.col1}>
                          <View style={[mo.providerDot, { backgroundColor: pColor }]} />
                          <Text style={mo.modelName} numberOfLines={1}>{model}</Text>
                        </View>
                        <Text style={[mo.col2, mo.priceCell]}>
                          {price.note ? price.note : `$${price.in}`}
                        </Text>
                        <Text style={[mo.col2, mo.priceCell]}>
                          {price.note ? "—" : `$${price.out}`}
                        </Text>
                      </View>
                      {i < group.models.length - 1 && <View style={mo.rowDivider} />}
                    </View>
                  ))}
                  <View style={mo.divider} />
                </View>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Animated bar ───────────────────────────────────────────────────────────
function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const w = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 700, delay, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={co.barTrack}>
      <Animated.View style={[co.barFill, {
        width: w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        backgroundColor: color,
        shadowColor: color,
        shadowRadius: 4,
        shadowOpacity: 0.6,
      }]} />
    </View>
  );
}

// ── Error state ────────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={co.errorBlock}>
      <View style={co.errorIcon}><Text style={co.errorIconText}>!</Text></View>
      <Text style={co.errorLabel}>LOAD FAILED</Text>
      <Text style={co.errorSub}>Could not fetch cost data</Text>
      <TouchableOpacity style={co.retryBtn} onPress={onRetry} activeOpacity={0.7}>
        <Text style={co.retryText}>↻  RETRY</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Animated stat card ─────────────────────────────────────────────────────
function StatChip({ label, value, color, delay = 0 }: {
  label: string; value: string; color?: string; delay?: number
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(10)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[co.heroChip, { opacity, transform: [{ translateY: slideY }] }]}>
      <Text style={co.heroChipLabel}>{label}</Text>
      <Text style={[co.heroChipVal, color ? { color } : {}]}>{value}</Text>
    </Animated.View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function CostScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [error, setError] = useState(false);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(16)).current;

  const load = useCallback(async (silent = false) => {
    setError(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const [analyticsResult, alertsResult] = await Promise.allSettled([
        apiClient.getAnalytics(),
        apiClient.getAlerts(),
      ]);
      if (analyticsResult.status === "fulfilled") {
        setStats(analyticsResult.value);
        Animated.parallel([
          Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.spring(heroSlide, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        ]).start();
      } else {
        setError(true);
      }
      if (alertsResult.status === "fulfilled") {
        setAlerts(alertsResult.value.alerts || []);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(true);
      }
    } finally {
      clearTimeout(timer);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const totalCost = parseFloat(String(stats?.totalCost || "0"));
  const todayCost = parseFloat(String(stats?.dailyCost || "0"));
  const monthlyCost = parseFloat(String(stats?.monthlyCost || "0"));
  const totalTokens = stats?.totalTokens || 0;
  const modelBreakdown = stats?.modelBreakdown;

  const heroCostColor =
    totalCost > 50 ? colors.danger :
    totalCost > 10 ? colors.warning :
    colors.success;

  const sorted = modelBreakdown
    ? [...modelBreakdown].sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost))
    : [];
  const maxCost = sorted.length > 0 ? parseFloat(sorted[0].totalCost) : 1;

  return (
    <View style={[co.root, { paddingTop: insets.top }]}>
      <View style={co.topBar}>
        <Text style={co.pageTitle}>COST</Text>
        <TouchableOpacity onPress={() => setShowPricing(true)} style={co.pricingBtn} activeOpacity={0.7}>
          <Text style={co.pricingBtnText}>PRICING ↗</Text>
        </TouchableOpacity>
      </View>
      <View style={co.topAccent} />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? <ErrorState onRetry={() => load(false)} /> : (
          <>
            {/* ── Budget alerts ── */}
            {alerts.length > 0 && (
              <View style={co.alertsBlock}>
                {alerts.map((alert, i) => {
                  const isCritical = alert.level === "critical";
                  const alertColor = isCritical ? colors.danger : colors.warning;
                  return (
                    <View key={i} style={[co.alertRow, { borderColor: alertColor + "40", backgroundColor: alertColor + "10" }]}>
                      <View style={[co.alertStripe, { backgroundColor: alertColor }]} />
                      <Text style={[co.alertText, { color: alertColor }]}>
                        {isCritical ? "⚠ " : "▲ "}{alert.message}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Hero ── */}
            <Animated.View style={[co.heroBlock, { opacity: heroOpacity, transform: [{ translateY: heroSlide }] }]}>
              <Text style={co.heroLabel}>ALL-TIME SPEND</Text>
              <Text style={[co.heroCost, {
                color: heroCostColor,
                textShadowColor: heroCostColor + "60",
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 24,
              }]}>
                {formatCost(totalCost)}
              </Text>
              <View style={co.heroRow}>
                <StatChip
                  label="TODAY"
                  value={formatCost(todayCost)}
                  color={todayCost > 1 ? colors.warning : colors.text}
                  delay={0}
                />
                <StatChip
                  label="THIS MONTH"
                  value={formatCost(monthlyCost)}
                  color={monthlyCost > 10 ? colors.warning : colors.text}
                  delay={80}
                />
                <StatChip
                  label="TOKENS"
                  value={formatTokens(totalTokens)}
                  delay={160}
                />
              </View>
            </Animated.View>

            {/* ── Section line ── */}
            <View style={co.sectionHead}>
              <Text style={co.sectionLabel}>BY MODEL</Text>
              <View style={co.sectionLine} />
            </View>

            {/* ── Model bars ── */}
            {sorted.length > 0 ? (
              <View style={co.modelBlock}>
                {sorted.map((m, i) => {
                  const cost = parseFloat(m.totalCost);
                  const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
                  const providerColor = PROVIDER_COLORS[MODEL_PRICING[m.model]?.provider ?? ""] ?? colors.accent;
                  const isTop = i === 0;
                  return (
                    <View key={m.model} style={[co.modelRow, isTop && co.modelRowTop]}>
                      <View style={co.modelLeft}>
                        <View style={[co.providerDot, { backgroundColor: providerColor }]} />
                        <Text style={[co.modelName, isTop && { color: colors.text }]} numberOfLines={1}>{m.model}</Text>
                      </View>
                      <View style={co.barWrap}>
                        <AnimatedBar pct={Math.max(pct, 1)} color={isTop ? providerColor : providerColor + "80"} delay={i * 80} />
                      </View>
                      <Text style={[co.modelCost, isTop && { color: providerColor }]}>{formatCost(cost)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={co.emptyModel}>
                <Text style={co.emptyModelText}>No session data yet</Text>
              </View>
            )}

            {/* ── Cache efficiency ── */}
            {stats && (
              <>
                <View style={co.sectionHead}>
                  <Text style={co.sectionLabel}>EFFICIENCY</Text>
                  <View style={co.sectionLine} />
                </View>
                <View style={co.efficiencyBlock}>
                  <View style={co.effRow}>
                    <Text style={co.effLabel}>CACHE HIT RATE</Text>
                    <Text style={[co.effValue, { color: (stats.cacheHitRate ?? 0) > 0.5 ? colors.success : colors.text }]}>
                      {Math.round((stats.cacheHitRate ?? 0) * 100)}%
                    </Text>
                  </View>
                  <View style={co.effBarTrack}>
                    <Animated.View style={[co.effBarFill, {
                      width: `${Math.round((stats.cacheHitRate ?? 0) * 100)}%`,
                      backgroundColor: (stats.cacheHitRate ?? 0) > 0.5 ? colors.success : colors.accent,
                    }]} />
                  </View>
                  <View style={co.effRow}>
                    <Text style={co.effLabel}>PROJECTED MONTHLY</Text>
                    <Text style={[co.effValue, { color: (stats.projectedMonthlyCost ?? 0) > 20 ? colors.warning : colors.text }]}>
                      {formatCost(stats.projectedMonthlyCost ?? 0)}
                    </Text>
                  </View>
                  <View style={co.effRow}>
                    <Text style={co.effLabel}>AVG / SESSION</Text>
                    <Text style={co.effValue}>
                      {(stats.totalSessions ?? 0) > 0 ? formatCost(totalCost / stats.totalSessions) : "$0.00"}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>

      <ModelSheet visible={showPricing} onClose={() => setShowPricing(false)} />
    </View>
  );
}

const co = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topAccent: { height: 1, backgroundColor: colors.accent + "30" },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: space.lg, paddingVertical: 14,
  },
  pageTitle: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 3, color: colors.accent, textTransform: "uppercase" },
  pricingBtn: {
    borderWidth: 1, borderColor: colors.accentBorder,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 2, backgroundColor: colors.accentMuted,
  },
  pricingBtnText: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.6, color: colors.accent, textTransform: "uppercase" },

  // Error
  errorBlock: { padding: space.xl, alignItems: "center", gap: 12, marginTop: space.xl },
  errorIcon: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerMuted,
    alignItems: "center", justifyContent: "center",
  },
  errorIconText: { fontFamily: fonts.sansMedium, fontSize: 18, color: colors.danger, lineHeight: 22 },
  errorLabel: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.8, color: colors.danger, textTransform: "uppercase" },
  errorSub: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary },
  retryBtn: {
    borderWidth: 1, borderColor: colors.accentBorder, backgroundColor: colors.accentMuted,
    paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.xs, marginTop: 4,
  },
  retryText: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.8, color: colors.accent, textTransform: "uppercase" },

  // Alerts
  alertsBlock: { paddingHorizontal: space.md, paddingTop: space.sm, gap: 6 },
  alertRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: radius.sm,
    overflow: "hidden",
  },
  alertStripe: { width: 3, alignSelf: "stretch" },
  alertText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, flex: 1, paddingHorizontal: 12, paddingVertical: 10 },

  // Hero
  heroBlock: { paddingHorizontal: space.lg, paddingTop: space.xl + 4, paddingBottom: space.lg },
  heroLabel: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 2.4, color: colors.textSecondary, textTransform: "uppercase", marginBottom: 10 },
  heroCost: { fontFamily: fonts.sans, fontSize: 64, fontWeight: "300", letterSpacing: -4, lineHeight: 64, marginBottom: 16 },
  heroRow: { flexDirection: "row", gap: 8 },
  heroChip: {
    flex: 1, backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    padding: 10,
  },
  heroChipLabel: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.4, color: colors.textSecondary, textTransform: "uppercase", marginBottom: 4 },
  heroChipVal: { fontFamily: fonts.mono, fontSize: 13, color: colors.text, letterSpacing: -0.2 },

  // Section
  sectionHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, marginBottom: 2, marginTop: space.md, gap: 10 },
  sectionLabel: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 2.0, color: colors.textSecondary, textTransform: "uppercase", flexShrink: 0 },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },

  // Model bars
  modelBlock: {
    marginHorizontal: space.md, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden", marginBottom: space.sm,
  },
  modelRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingVertical: 13, gap: 10 },
  modelRowTop: { backgroundColor: colors.surfaceRaised },
  modelLeft: { flexDirection: "row", alignItems: "center", gap: 7, width: 130 },
  providerDot: { width: 5, height: 5, borderRadius: 2.5, flexShrink: 0 },
  modelName: { fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary, letterSpacing: 0.2, flex: 1 },
  barWrap: { flex: 1 },
  barTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  modelCost: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary, width: 62, textAlign: "right" },

  // Efficiency
  efficiencyBlock: {
    marginHorizontal: space.md, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space.md, gap: 14, marginBottom: space.sm,
  },
  effRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  effLabel: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.4, color: colors.textSecondary, textTransform: "uppercase" },
  effValue: { fontFamily: fonts.mono, fontSize: 13, color: colors.text },
  effBarTrack: { height: 3, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden", marginTop: -6 },
  effBarFill: { height: "100%", borderRadius: 2 },

  emptyModel: { padding: space.xl, alignItems: "center" },
  emptyModelText: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary },
});

const mo = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md,
    maxHeight: "85%",
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: colors.accentBorder,
  },
  handle: { width: 32, height: 3, backgroundColor: colors.textTertiary, alignSelf: "center", marginTop: 10, marginBottom: 4, borderRadius: 2 },
  sheetHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  sheetTitle: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 2.0, color: colors.accent, textTransform: "uppercase" },
  closeX: { fontFamily: fonts.sans, fontSize: 16, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: space.lg },
  tableHead: {
    flexDirection: "row", paddingHorizontal: space.lg, paddingVertical: 9,
    backgroundColor: colors.surfaceRaised,
  },
  headCell: { fontFamily: fonts.sansMedium, fontSize: 8, letterSpacing: 1.4, color: colors.textSecondary, textTransform: "uppercase" },
  providerHeader: {
    paddingHorizontal: space.lg, paddingVertical: 8,
    backgroundColor: colors.bg,
    borderLeftWidth: 3, marginLeft: space.md, marginRight: space.md,
    marginTop: 4,
    borderRadius: 1,
  },
  providerLabel: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 2.0, textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingHorizontal: space.lg, paddingVertical: 12, alignItems: "center" },
  col1: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, marginRight: space.sm },
  col2: { width: 64, textAlign: "right" as const },
  providerDot: { width: 5, height: 5, borderRadius: 2.5, flexShrink: 0 },
  modelName: { fontFamily: fonts.mono, fontSize: 11, color: colors.text },
  priceCell: { fontFamily: fonts.mono, fontSize: 11, color: colors.text },
});
