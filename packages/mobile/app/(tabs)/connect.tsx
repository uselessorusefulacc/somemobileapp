import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Pressable,
  Image,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { apiClient, API_BASE } from "../../lib/api";
import { useRelay } from "../../lib/relay-context";
import { colors, spacing, radius, typography, getAgentColor } from "../../lib/theme";

const AGENTS = [
  { id: "claude",   name: "Claude Code",   model: "claude-sonnet-4-5", color: "#C8956B" },
  { id: "opencode", name: "OpenCode",       model: "claude-sonnet-4-5", color: "#7B7FBF" },
  { id: "codex",    name: "Codex CLI",      model: "o3",                color: "#10A37F" },
  { id: "gemini",   name: "Gemini CLI",     model: "gemini-2-5-pro",    color: "#4285F4" },
  { id: "aider",    name: "Aider",          model: "claude-sonnet-4-5", color: "#3D9E5F" },
  { id: "copilot",  name: "GitHub Copilot", model: "gpt-4o",            color: "#8B7FB8" },
  { id: "cline",    name: "Cline",          model: "claude-sonnet-4-5", color: "#C87941" },
];

function getRelayWsUrl(): string {
  return API_BASE
    .replace(/^http/, "ws")
    .replace(":4200", ":8082")
    .replace(":4201", ":8082");
}

function CopyBlock({ cmd, label }: { cmd: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <View style={c.copyWrap}>
      {label && <Text style={c.copyLabel}>{label}</Text>}
      <TouchableOpacity style={c.copyBlock} onPress={copy} activeOpacity={0.7}>
        <Text style={c.copyPrompt}>$</Text>
        <Text style={c.copyCmd} selectable numberOfLines={2}>{cmd}</Text>
        <Text style={[c.copyBtn, copied && { color: colors.success }]}>
          {copied ? "✓" : "COPY"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ConnectScreen() {
  const router = useRouter();
  const relay = useRelay();
  const insets = useSafeAreaInsets();

  const [agentId, setAgentId] = useState("claude");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"pick" | "run">("pick");
  const [sessionId, setSessionId] = useState("");
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const agent = AGENTS.find((a) => a.id === agentId)!;
  const relayUrl = getRelayWsUrl();
  const installCmd = "npm install -g agentpilot-daemon";
  const runCmd = sessionId ? `agentpilot-daemon run -s ${sessionId} -- ${agent.id}` : "";
  const runCmdFull = sessionId ? `agentpilot-daemon run -s ${sessionId} -r ${relayUrl} -- ${agent.id}` : "";
  const attachCmd = sessionId ? `agentpilot-daemon attach -s ${sessionId}` : "";

  const handleCreate = async () => {
    setCreating(true);
    try {
      const sessionName = name.trim() || `${agent.name} Session`;
      const data = await apiClient.createSession({ name: sessionName, agentType: agentId, model: agent.model });
      setSessionId(data.id);
      setStep("run");
    } catch (e) {
      Alert.alert("Error", String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleLink = () => {
    if (!sessionId) return;
    setConnecting(true);
    relay.connect(sessionId, relayUrl);
    const onConnect = () => {
      setConnecting(false);
      relay.client?.off("connected", onConnect);
      relay.client?.off("error", onError);
      router.push("/");
    };
    const onError = () => {
      setConnecting(false);
      relay.client?.off("connected", onConnect);
      relay.client?.off("error", onError);
      Alert.alert("Connection failed", "Could not reach relay.");
    };
    relay.client?.on("connected", onConnect);
    relay.client?.on("error", onError);
    setTimeout(() => {
      setConnecting(false);
      relay.client?.off("connected", onConnect);
      relay.client?.off("error", onError);
    }, 8000);
  };

  // ── RUN STEP ──────────────────────────────────────────────────────
  if (step === "run") {
    return (
      <View style={[c.root, { paddingTop: insets.top }]}>
        <View style={c.header}>
          <TouchableOpacity onPress={() => setStep("pick")} activeOpacity={0.6}>
            <Text style={c.back}>← BACK</Text>
          </TouchableOpacity>
          <Text style={c.headerTitle}>Connect</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={c.divider} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Session info row */}
          <View style={c.sessionInfo}>
            <View style={[c.agentDot, { backgroundColor: agent.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={c.sessionAgent}>{agent.name.toUpperCase()}</Text>
              <Text style={c.sessionId} selectable numberOfLines={1}>{sessionId}</Text>
            </View>
            <View style={c.readyTag}>
              <Text style={c.readyText}>READY</Text>
            </View>
          </View>

          <View style={c.divider} />

          {/* Steps */}
          <View style={c.steps}>
            <Text style={c.stepNum}>01</Text>
            <Text style={c.stepTitle}>Install daemon</Text>
          </View>
          <CopyBlock cmd={installCmd} />

          <View style={c.divider} />

          <View style={c.steps}>
            <Text style={c.stepNum}>02</Text>
            <Text style={c.stepTitle}>Run with session</Text>
          </View>
          <CopyBlock cmd={runCmd} />

          <View style={c.divider} />

          {/* QR */}
          <View style={c.qrSection}>
            <Text style={c.qrLabel}>SCAN TO COPY FULL COMMAND</Text>
            <View style={c.qrBox}>
              <Image
                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(runCmdFull)}&color=EEEEEE&bgcolor=111111` }}
                style={c.qrImage}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={c.divider} />

          {/* Attach alt */}
          <View style={c.altSection}>
            <Text style={c.altLabel}>OR ATTACH TO RUNNING AGENT</Text>
            <CopyBlock cmd={attachCmd} />
          </View>

          <View style={c.divider} />

          {/* Status */}
          <View style={c.statusRow}>
            <View style={[c.statusDot, { backgroundColor: relay.isConnected ? colors.success : colors.textDisabled }]} />
            <Text style={[c.statusText, { color: relay.isConnected ? colors.text : colors.textSecondary }]}>
              {relay.isConnected ? "Relay connected — data flowing" : "Waiting for daemon..."}
            </Text>
            {!relay.isConnected && <ActivityIndicator size="small" color={colors.textDisabled} />}
          </View>

          <View style={c.divider} />

          {/* CTA */}
          <TouchableOpacity
            style={[c.cta, relay.isConnected && c.ctaActive]}
            onPress={handleLink}
            disabled={connecting}
            activeOpacity={0.8}
          >
            {connecting
              ? <ActivityIndicator color={relay.isConnected ? colors.bg : colors.text} />
              : <Text style={[c.ctaText, relay.isConnected && c.ctaTextActive]}>
                  {relay.isConnected ? "OPEN DASHBOARD →" : "LINK NOW →"}
                </Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── PICK STEP ─────────────────────────────────────────────────────
  return (
    <View style={[c.root, { paddingTop: insets.top }]}>
      <View style={c.header}>
        <Text style={c.headerTitle}>New Session</Text>
      </View>
      <View style={c.divider} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Agent list */}
        <Text style={c.listLabel}>CHOOSE AGENT</Text>
        {AGENTS.map((a) => {
          const sel = agentId === a.id;
          return (
            <Pressable
              key={a.id}
              style={[c.agentRow, sel && c.agentRowSelected]}
              onPress={() => setAgentId(a.id)}
            >
              <View style={[c.agentDot, { backgroundColor: sel ? a.color : colors.textDisabled }]} />
              <View style={{ flex: 1 }}>
                <Text style={[c.agentName, sel && { color: colors.text }]}>{a.name}</Text>
                <Text style={c.agentModel}>{a.model}</Text>
              </View>
              {sel && <Text style={c.check}>✓</Text>}
            </Pressable>
          );
        })}

        <View style={c.divider} />

        {/* Name input */}
        <Text style={c.listLabel}>SESSION NAME</Text>
        <View style={c.inputWrap}>
          <TextInput
            style={c.input}
            value={name}
            onChangeText={setName}
            placeholder={`${agent.name} session`}
            placeholderTextColor={colors.textDisabled}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
        </View>

        <View style={c.divider} />

        {/* CTA */}
        <TouchableOpacity
          style={c.cta}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.8}
        >
          {creating
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={c.ctaTextActive}>CREATE & CONNECT →</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
  },
  headerTitle: { ...typography.title1, color: colors.text },
  back: { ...typography.label, color: colors.textSecondary },

  divider: { height: 1, backgroundColor: colors.border },

  listLabel: {
    ...typography.label,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },

  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  agentRowSelected: {
    backgroundColor: colors.surface,
  },
  agentDot: { width: 8, height: 8, borderRadius: 4 },
  agentName: { ...typography.body, color: colors.textSecondary },
  agentModel: { ...typography.monoSm, color: colors.textTertiary, marginTop: 2 },
  check: { color: colors.text, fontSize: 14, fontWeight: "600" },

  inputWrap: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.base,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },

  cta: {
    margin: spacing.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  ctaActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  ctaText: { ...typography.label, color: colors.text },
  ctaTextActive: { ...typography.label, color: colors.bg },

  // Run step
  sessionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
  },
  sessionAgent: { fontSize: 10, fontWeight: "600", letterSpacing: 0.7, color: colors.textSecondary },
  sessionId: { ...typography.monoSm, color: colors.textTertiary, marginTop: 2 },
  readyTag: {
    borderWidth: 1,
    borderColor: "rgba(40,200,64,0.3)",
    borderRadius: radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: colors.successDim,
  },
  readyText: { fontSize: 9, fontWeight: "600", letterSpacing: 0.5, color: colors.success },

  steps: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  stepNum: { ...typography.mono, color: colors.textTertiary, fontSize: 11 },
  stepTitle: { ...typography.label, color: colors.textSecondary },

  copyWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.base },
  copyLabel: { ...typography.label, color: colors.textTertiary, marginBottom: spacing.xs },
  copyBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  copyPrompt: { ...typography.mono, color: colors.textTertiary },
  copyCmd: { flex: 1, ...typography.mono, color: colors.textSecondary },
  copyBtn: { ...typography.label, color: colors.textTertiary, fontSize: 9 },

  qrSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: "flex-start",
  },
  qrLabel: { ...typography.label, color: colors.textTertiary, marginBottom: spacing.base },
  qrBox: {
    width: 140,
    height: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  qrImage: { width: 120, height: 120 },

  altSection: { paddingTop: spacing.base },
  altLabel: {
    ...typography.label,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: spacing.lg,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...typography.bodySmall, flex: 1 },
});
