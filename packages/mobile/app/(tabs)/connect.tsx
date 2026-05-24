import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRelay } from "../../lib/relay-context";
import { colors, fonts, radius, space } from "../../lib/theme";
import { DotGrid } from "../../components/DotGrid";

const RELAY_URL = "wss://81ylvadrgdbxmql33216v-preview-8080.runable.site";
const EXPO_URL  = "exp://81ylvadrgdbxmql33216v-preview-4300.runable.site";

// ─── PulseDot ──────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 2.2, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute",
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
      }} />
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

// ─── CopyBlock with hover pop ──────────────────────────────────────────────
function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const scale  = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0)).current;

  const copy = () => {
    Clipboard.setStringAsync(value);
    setCopied(true);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50, bounciness: 4 }),
    ]).start();
    setTimeout(() => setCopied(false), 1500);
  };

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.015, useNativeDriver: true, speed: 60, bounciness: 2 }),
      Animated.timing(glowOp, { toValue: 1, duration: 120, useNativeDriver: false }),
    ]).start();
  };
  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 2 }),
      Animated.timing(glowOp, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const glowBorder = glowOp.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.borderStrong, colors.accentBorder],
  });

  return (
    <TouchableOpacity onPress={copy} onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1}>
      <Animated.View style={[c.codeBlock, { transform: [{ scale }], borderColor: glowBorder }]}>
        <View style={c.codeLabelRow}>
          <Text style={c.codeLabel}>{label}</Text>
        </View>
        <View style={c.codeRow}>
          <Text style={c.codeText} numberOfLines={1}>{value}</Text>
          <View style={c.copyBtn}>
            <Text style={[c.copyText, copied && c.copyTextActive]}>
              {copied ? "COPIED" : "COPY"}
            </Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── StepBlock with stagger entry ─────────────────────────────────────────
function StepBlock({ num, title, desc, children, delay = 0 }: {
  num: string; title: string; desc: string; children?: React.ReactNode; delay?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.spring(slideY,  { toValue: 0, delay, useNativeDriver: true, damping: 22, stiffness: 200 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[c.stepBlock, { opacity, transform: [{ translateY: slideY }] }]}>
      <Text style={c.stepNum}>{num}</Text>
      <Text style={c.stepTitle}>{title}</Text>
      <Text style={c.stepDesc}>{desc}</Text>
      {children}
    </Animated.View>
  );
}

// ─── ConnectScreen ─────────────────────────────────────────────────────────
export default function ConnectScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const relay   = useRelay();
  const connected = relay.isConnected;

  // Hero block scale pop on mount
  const heroScale   = useRef(new Animated.Value(0.94)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity,  { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(heroScale,    { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 200 }),
    ]).start();
  }, []);

  return (
    <View style={[c.root, { paddingTop: insets.top }]}>
      <DotGrid opacity={0.28} />

      {/* Top bar */}
      <View style={c.topBar}>
        <View style={c.topBarLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.65}
            hitSlop={12}
            style={c.backBtn}
          >
            <Text style={c.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={c.pageTitle}>CONNECT</Text>
        </View>
        <View style={[c.statusPill, connected && c.statusPillActive]}>
          {connected
            ? <PulseDot color={colors.success} />
            : <View style={[c.dot, { backgroundColor: colors.textTertiary }]} />
          }
          <Text style={[c.statusText, { color: connected ? colors.success : colors.textTertiary }]}>
            {connected ? "LIVE" : "OFFLINE"}
          </Text>
        </View>
      </View>
      <View style={c.accentLine} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* ── Status block with hero pop ── */}
        <Animated.View style={[
          c.statusBlock,
          connected && c.statusBlockConnected,
          { opacity: heroOpacity, transform: [{ scale: heroScale }] }
        ]}>
          <View style={c.statusLabelRow}>
            <Text style={c.sectionLabel}>RELAY STATUS</Text>
            <View style={c.sectionLine} />
          </View>
          <Text style={[c.statusMain, connected && c.statusMainConnected]}>
            {connected ? "Relay connected" : "Waiting for relay"}
          </Text>
          <Text style={c.statusSub}>
            {connected
              ? "MAFA is receiving real-time events from your agents."
              : "Open the relay on your machine to start monitoring."}
          </Text>
        </Animated.View>

        <View style={c.divider} />

        {/* ── Steps with staggered entry ── */}
        <StepBlock num="01" title="Install relay" delay={80}
          desc="Run the relay server on your machine. It bridges your AI agents to this app."
        >
          <CopyBlock label="INSTALL" value="npx mafa-relay" />
        </StepBlock>

        <View style={c.divider} />

        <StepBlock num="02" title="Configure relay URL" delay={160}
          desc="Set this WebSocket URL in your relay config or environment variable."
        >
          <CopyBlock label="RELAY URL" value={RELAY_URL} />
          <CopyBlock label="EXPO URL"  value={EXPO_URL} />
        </StepBlock>

        <View style={c.divider} />

        <StepBlock num="03" title="Wrap your agent" delay={240}
          desc="Use the MAFA SDK to instrument Claude Code, Codex, or any LLM agent."
        >
          <CopyBlock label="ENV" value="MAFA_URL=wss://..." />
        </StepBlock>

        {/* ── Swipe hint ── */}
        <View style={c.swipeHint}>
          <Text style={c.swipeText}>‹ SWIPE TABS ›</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  divider: { height: 1, backgroundColor: colors.border },
  accentLine: { height: 1, backgroundColor: colors.accent + "30" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: 13,
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { paddingRight: 4 },
  backArrow: { fontFamily: fonts.sans, fontSize: 20, color: colors.text, lineHeight: 24 },
  pageTitle: {
    fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 3,
    color: colors.accent, textTransform: "uppercase",
  },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 2,
  },
  statusPillActive: { borderColor: colors.successBorder, backgroundColor: colors.successMuted },
  dot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase" },

  sectionLabel: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.8,
    color: colors.textTertiary, textTransform: "uppercase",
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border, marginLeft: 12 },
  statusLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: space.md },

  // Status block
  statusBlock: {
    paddingHorizontal: space.lg, paddingVertical: space.xl,
    borderWidth: 1, borderColor: "transparent",
    margin: space.md, borderRadius: 3,
  },
  statusBlockConnected: {
    borderColor: colors.successBorder, backgroundColor: colors.successMuted,
    shadowColor: colors.success, shadowRadius: 18, shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 0 },
  },
  statusMain: {
    fontFamily: fonts.sans, fontSize: 21, fontWeight: "300",
    letterSpacing: -0.8, color: colors.text, marginBottom: 8,
  },
  statusMainConnected: {
    color: colors.success,
    textShadowColor: colors.success + "60",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  statusSub: { fontFamily: fonts.sans, fontSize: 14, color: colors.text, lineHeight: 21, opacity: 0.7 },

  // Steps
  stepBlock: { paddingHorizontal: space.lg, paddingVertical: space.xl },
  stepNum: {
    fontFamily: fonts.mono, fontSize: 10, color: colors.accent + "80",
    letterSpacing: 0.5, marginBottom: 5,
  },
  stepTitle: {
    fontFamily: fonts.sans, fontSize: 18, fontWeight: "300",
    letterSpacing: -0.5, color: colors.text, marginBottom: 8,
  },
  stepDesc: {
    fontFamily: fonts.sans, fontSize: 14, color: colors.text,
    lineHeight: 22, marginBottom: space.md, opacity: 0.65,
  },

  // Copy block
  codeBlock: {
    borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: 2, marginBottom: space.sm,
    backgroundColor: colors.surface, overflow: "hidden",
  },
  codeLabelRow: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: space.md, paddingTop: 8, paddingBottom: 6,
  },
  codeLabel: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.4,
    color: colors.textSecondary, textTransform: "uppercase",
  },
  codeRow: { flexDirection: "row", alignItems: "center", paddingLeft: space.md },
  codeText: { fontFamily: fonts.mono, fontSize: 13, color: colors.text, flex: 1, paddingVertical: 10 },
  copyBtn: {
    paddingHorizontal: space.md, paddingVertical: 10,
    borderLeftWidth: 1, borderLeftColor: colors.border,
  },
  copyText: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.2,
    color: colors.textSecondary, textTransform: "uppercase",
  },
  copyTextActive: {
    color: colors.success,
    textShadowColor: colors.success + "80",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  // Swipe hint
  swipeHint: { alignItems: "center", paddingVertical: space.xl, paddingTop: space.lg },
  swipeText: {
    fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 3,
    color: colors.textTertiary, textTransform: "uppercase", opacity: 0.5,
  },
});
