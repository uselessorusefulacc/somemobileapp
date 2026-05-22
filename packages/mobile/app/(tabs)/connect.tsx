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
import {
  colors,
  spacing,
  radius,
  typography,
  getAgentColor,
  getAgentLabel,
} from "../../lib/theme";

const AGENTS = [
  { id: "claude",   name: "Claude Code",     model: "claude-sonnet-4-5", color: "#D4A574" },
  { id: "opencode", name: "OpenCode",         model: "claude-sonnet-4-5", color: "#818CF8" },
  { id: "codex",    name: "Codex CLI",        model: "o3",                color: "#10A37F" },
  { id: "gemini",   name: "Gemini CLI",       model: "gemini-2-5-pro",    color: "#4285F4" },
  { id: "aider",    name: "Aider",            model: "claude-sonnet-4-5", color: "#4CAF50" },
  { id: "copilot",  name: "GitHub Copilot",   model: "gpt-4o",            color: "#A78BFA" },
  { id: "cline",    name: "Cline",            model: "claude-sonnet-4-5", color: "#FB923C" },
];

function getRelayWsUrl(): string {
  return API_BASE
    .replace(/^http/, "ws")
    .replace(":4200", ":8082")
    .replace(":4201", ":8082");
}

// ── Agent logo (circular avatar with initial) ──────────────────────
function AgentAvatar({ color, name, size = 40 }: { color: string; name: string; size?: number }) {
  const initial = name.charAt(0);
  return (
    <View style={[c.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + "18" }]}>
      <Text style={[c.avatarText, { color, fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

// ── Copy block (terminal-style command) ────────────────────────────
function CopyBlock({ cmd, label }: { cmd: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <View style={c.copyBlock}>
      {label && <Text style={c.copyLabel}>{label}</Text>}
      <TouchableOpacity style={c.copyInner} onPress={copy} activeOpacity={0.7}>
        <Text style={c.copyPrompt}>$</Text>
        <Text style={c.copyText} selectable>{cmd}</Text>
        <View style={[c.copyBadge, copied && { backgroundColor: colors.successDim, borderColor: colors.success + "40" }]}>
          <Text style={[c.copyBadgeText, { color: copied ? colors.success : colors.textDisabled }]}>
            {copied ? "✓" : "Copy"}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Status banner ──────────────────────────────────────────────────
function StatusBanner({ connected }: { connected: boolean }) {
  return (
    <View style={[c.statusBanner, connected && { borderColor: colors.success + "30", backgroundColor: colors.successDim }]}>
      <View style={[c.statusDot, { backgroundColor: connected ? colors.success : colors.textDisabled }]} />
      <View style={{ flex: 1 }}>
        <Text style={[c.statusTitle, { color: connected ? colors.success : colors.textSecondary }]}>
          {connected ? "Relay connected" : "Waiting for daemon"}
        </Text>
        <Text style={c.statusSub}>
          {connected ? "Agent data flowing in real-time" : "Run the command on your machine"}
        </Text>
      </View>
      {!connected && <ActivityIndicator size="small" color={colors.textDisabled} />}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────
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

  // ── RUN STEP ────────────────────────────────────────────────────
  if (step === "run") {
    return (
      <View style={[c.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={c.header}>
          <TouchableOpacity onPress={() => setStep("pick")} style={c.backBtn} activeOpacity={0.7}>
            <Text style={c.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={c.headerTitle}>Connect</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing["3xl"] }}
          showsVerticalScrollIndicator={false}
        >
          {/* Session card */}
          <View style={[c.sessionCard, { borderColor: agent.color + "30" }]}>
            <AgentAvatar color={agent.color} name={agent.name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={c.sessionCardName}>{agent.name}</Text>
              <Text style={c.sessionCardId} numberOfLines={1} selectable>{sessionId}</Text>
            </View>
            <View style={[c.readyBadge, { backgroundColor: colors.successDim }]}>
              <View style={[c.readyDot, { backgroundColor: colors.success }]} />
              <Text style={[c.readyText, { color: colors.success }]}>Ready</Text>
            </View>
          </View>

          {/* Step 1 */}
          <Text style={c.stepLabel}>Step 1 — Install</Text>
          <CopyBlock cmd={installCmd} />

          {/* Step 2 */}
          <Text style={c.stepLabel}>Step 2 — Run</Text>
          <CopyBlock cmd={runCmd} />

          {/* Remote URL */}
          <View style={c.hintCard}>
            <Text style={c.hintLabel}>Full command with relay</Text>
            <Text style={c.hintValue} selectable>{runCmdFull}</Text>
          </View>

          {/* QR */}
          <View style={[c.qrCard, { borderColor: agent.color + "20" }]}>
            <Text style={c.qrTitle}>Pair via QR</Text>
            <Text style={c.qrSub}>Scan from your laptop camera</Text>
            <View style={c.qrWrap}>
              <Image
                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(runCmdFull)}&color=e0e0e0&bgcolor=141414` }}
                style={c.qrImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* OR attach */}
          <View style={c.orDivider}>
            <View style={c.orLine} />
            <Text style={c.orText}>OR</Text>
            <View style={c.orLine} />
          </View>

          <View style={c.hintCard}>
            <Text style={c.hintLabel}>Attach to running agent</Text>
            <CopyBlock cmd={attachCmd} />
          </View>

          {/* Status */}
          <StatusBanner connected={relay.isConnected} />

          {/* CTA */}
          <TouchableOpacity
            style={[c.ctaBtn, { backgroundColor: relay.isConnected ? colors.success : colors.accent }]}
            onPress={handleLink}
            disabled={connecting}
            activeOpacity={0.8}
          >
            {connecting
              ? <ActivityIndicator color="#fff" />
              : <Text style={c.ctaBtnText}>{relay.isConnected ? "Open dashboard →" : "Link now →"}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── PICK STEP ────────────────────────────────────────────────────
  return (
    <View style={[c.root, { paddingTop: insets.top }]}>
      <View style={c.header}>
        <Text style={c.headerTitle}>New Session</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={c.sectionLabel}>Choose agent</Text>
        {AGENTS.map((a) => {
          const sel = agentId === a.id;
          return (
            <Pressable
              key={a.id}
              style={[c.agentCard, sel && { borderColor: a.color + "50", backgroundColor: a.color + "08" }]}
              onPress={() => setAgentId(a.id)}
            >
              <AgentAvatar color={a.color} name={a.name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={[c.agentName, sel && { color: a.color }]}>{a.name}</Text>
                <Text style={c.agentModel}>{a.model}</Text>
              </View>
              {sel && (
                <View style={[c.check, { borderColor: a.color }]}>
                  <View style={[c.checkInner, { backgroundColor: a.color }]} />
                </View>
              )}
            </Pressable>
          );
        })}

        <Text style={[c.sectionLabel, { marginTop: spacing.xl }]}>Session name</Text>
        <View style={[c.inputWrap, { borderColor: agent.color + "30" }]}>
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

        <View style={c.modelRow}>
          <Text style={c.modelRowLabel}>Default model</Text>
          <View style={[c.modelPill, { borderColor: agent.color + "40", backgroundColor: agent.color + "10" }]}>
            <Text style={[c.modelPillText, { color: agent.color }]}>{agent.model}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[c.ctaBtn, { backgroundColor: agent.color }]}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.8}
        >
          {creating
            ? <ActivityIndicator color="#000" />
            : <Text style={[c.ctaBtnText, { color: "#000" }]}>Create & connect →</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
  },
  headerTitle: { ...typography.title1, color: colors.text },
  backBtn: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  backArrow: { color: colors.textSecondary, fontSize: 20 },

  // Section label
  sectionLabel: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: spacing.base,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  // Agent card
  agentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  agentName: { ...typography.body, color: colors.text },
  agentModel: { ...typography.caption, color: colors.textTertiary },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkInner: { width: 10, height: 10, borderRadius: 5 },

  // Input
  inputWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  input: {
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },

  // Model row
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  modelRowLabel: { ...typography.bodySmall, color: colors.textTertiary },
  modelPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  modelPillText: { fontSize: 12, fontWeight: "600" },

  // CTA
  ctaBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.base,
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.base,
  },
  ctaBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Session card (run step)
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  sessionCardName: { ...typography.body, color: colors.text },
  sessionCardId: { ...typography.caption, color: colors.textTertiary, fontFamily: "monospace" },
  readyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  readyDot: { width: 5, height: 5, borderRadius: 3 },
  readyText: { ...typography.caption, fontWeight: "700" },

  // Step label
  stepLabel: {
    ...typography.label,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Copy block
  copyBlock: { marginBottom: spacing.lg, paddingHorizontal: spacing.lg },
  copyLabel: { ...typography.label, color: colors.textTertiary, marginBottom: spacing.xs },
  copyInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  copyPrompt: { color: colors.textDisabled, fontSize: 13, fontFamily: "monospace" },
  copyText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
    color: colors.textSecondary,
  },
  copyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyBadgeText: { fontSize: 11, fontWeight: "600" },

  // Hint
  hintCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  hintLabel: { ...typography.label, color: colors.textTertiary, marginBottom: spacing.xs },
  hintValue: {
    ...typography.caption,
    color: colors.textDisabled,
    fontFamily: "monospace",
    lineHeight: 18,
  },

  // QR
  qrCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  qrTitle: { ...typography.body, color: colors.text, marginBottom: spacing.xs },
  qrSub: { ...typography.caption, color: colors.textTertiary, marginBottom: spacing.lg },
  qrWrap: {
    width: 140,
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  qrImage: { width: 120, height: 120 },

  // OR
  orDivider: { flexDirection: "row", alignItems: "center", gap: spacing.base, marginVertical: spacing.lg, paddingHorizontal: spacing.lg },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { ...typography.label, color: colors.textTertiary },

  // Status
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusTitle: { ...typography.body, color: colors.textSecondary },
  statusSub: { ...typography.caption, color: colors.textTertiary, marginTop: 1 },

  // Avatar
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800" },
});
