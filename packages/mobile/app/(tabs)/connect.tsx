import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
// BUG-23 FIX: use expo-clipboard instead of deprecated react-native Clipboard
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRelay } from "../../lib/relay-context";
import { colors, fonts, radius, space } from "../../lib/theme";

const RELAY_URL = "wss://81ylvadrgdbxmql33216v-preview-8080.runable.site";
const EXPO_URL = "exp://81ylvadrgdbxmql33216v-preview-4300.runable.site";

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    Clipboard.setStringAsync(value); // async, fire-and-forget is fine for copy UX
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <View style={c.codeBlock}>
      <Text style={c.codeLabel}>{label}</Text>
      <View style={c.codeRow}>
        <Text style={c.codeText} numberOfLines={1}>{value}</Text>
        <TouchableOpacity onPress={copy} activeOpacity={0.65} style={c.copyBtn}>
          <Text style={c.copyText}>{copied ? "COPIED" : "COPY"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ConnectScreen() {
  const insets = useSafeAreaInsets();
  const relay = useRelay();
  const connected = relay.isConnected;

  return (
    <View style={[c.root, { paddingTop: insets.top }]}>
      <View style={c.topBar}>
        <Text style={c.pageTitle}>CONNECT</Text>
        <View style={c.statusPill}>
          <View style={[c.dot, { backgroundColor: connected ? colors.success : colors.textTertiary }]} />
          <Text style={[c.statusText, { color: connected ? colors.success : colors.textTertiary }]}>
            {connected ? "LIVE" : "OFFLINE"}
          </Text>
        </View>
      </View>

      <View style={c.divider} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* ── Status block ── */}
        <View style={c.statusBlock}>
          <Text style={c.sectionLabel}>RELAY STATUS</Text>
          <Text style={c.statusMain}>
            {connected ? "Relay connected" : "Waiting for relay"}
          </Text>
          <Text style={c.statusSub}>
            {connected
              ? "AgentPilot is receiving real-time events from your agents"
              : "Open the relay on your machine to start monitoring"}
          </Text>
        </View>

        <View style={c.divider} />

        {/* ── Step 01 ── */}
        <View style={c.stepBlock}>
          <Text style={c.stepNum}>01</Text>
          <Text style={c.stepTitle}>Install relay</Text>
          <Text style={c.stepDesc}>
            Run the relay server on your development machine. It bridges your AI agents to this app.
          </Text>
          <CopyBlock label="INSTALL" value="npx agentpilot-relay" />
        </View>

        <View style={c.divider} />

        {/* ── Step 02 ── */}
        <View style={c.stepBlock}>
          <Text style={c.stepNum}>02</Text>
          <Text style={c.stepTitle}>Configure relay URL</Text>
          <Text style={c.stepDesc}>
            Set this WebSocket URL in your relay config or environment.
          </Text>
          <CopyBlock label="RELAY URL" value={RELAY_URL} />
          <CopyBlock label="EXPO URL" value={EXPO_URL} />
        </View>

        <View style={c.divider} />

        {/* ── Step 03 ── */}
        <View style={c.stepBlock}>
          <Text style={c.stepNum}>03</Text>
          <Text style={c.stepTitle}>Wrap your agent</Text>
          <Text style={c.stepDesc}>
            Use the AgentPilot SDK to instrument Claude Code, Codex, or any LLM agent.
          </Text>
          <CopyBlock label="ENV" value="AGENTPILOT_URL=wss://..." />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  divider: { height: 1, backgroundColor: colors.border },

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
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
  statusText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: space.sm,
  },

  // Status block
  statusBlock: {
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
  },
  statusMain: {
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: "400",
    letterSpacing: -0.5,
    color: colors.text,
    marginBottom: 6,
  },
  statusSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Steps
  stepBlock: {
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
  },
  stepNum: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepTitle: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: "400",
    letterSpacing: -0.3,
    color: colors.text,
    marginBottom: 8,
  },
  stepDesc: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: space.md,
  },

  // Copy block
  codeBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginBottom: space.sm,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  codeLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: "uppercase",
    paddingHorizontal: space.md,
    paddingTop: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: space.md,
  },
  codeText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    paddingVertical: 10,
  },
  copyBtn: {
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  copyText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
});
