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
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { apiClient, API_BASE } from "../../lib/api";
import { useRelay } from "../../lib/relay-context";

// ── Design tokens ───────────────────────────────────────────────
const BG      = "#141414";
const SURFACE = "#1c1c1c";
const CARD    = "#1e1e1e";
const BORDER  = "#282828";
const LINE    = "#222222";
const TEXT    = "#f0f0f0";
const TEXT_2  = "#a0a0a0";
const TEXT_3  = "#585858";
const GREEN   = "#22c55e";
const AMBER   = "#f59e0b";
const RED     = "#ef4444";

// agent accent palette — same as Factory pill colors
const AGENTS = [
  { id: "claude",   name: "Claude Code",     model: "claude-sonnet-4-5", color: "#D4A574", logo: "A" },
  { id: "opencode", name: "OpenCode",         model: "claude-sonnet-4-5", color: "#818CF8", logo: "O" },
  { id: "codex",    name: "Codex CLI",        model: "o3",                color: "#10A37F", logo: "C" },
  { id: "gemini",   name: "Gemini CLI",       model: "gemini-2-5-pro",    color: "#4285F4", logo: "G" },
  { id: "aider",    name: "Aider",            model: "claude-sonnet-4-5", color: "#22c55e", logo: "Ai" },
  { id: "copilot",  name: "GitHub Copilot",   model: "gpt-4o",            color: "#a78bfa", logo: "Co" },
  { id: "cline",    name: "Cline",            model: "claude-sonnet-4-5", color: "#fb923c", logo: "Cl" },
];

function getRelayWsUrl(): string {
  return API_BASE
    .replace(/^http/, "ws")
    .replace(":4200", ":8080")
    .replace(":4201", ":8080");
}

// ── Small reusable pieces ────────────────────────────────────────
function AgentLogo({ color, logo, size = 36 }: { color: string; logo: string; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.28,
      backgroundColor: color + "18",
      alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{ color, fontSize: size * 0.38, fontWeight: "700" }}>{logo}</Text>
    </View>
  );
}

function Pill({ label, active, color, onPress }: { label: string; active?: boolean; color?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity
      style={[s.pill, active && { backgroundColor: (color || TEXT_2) + "18", borderColor: (color || TEXT_2) + "55" }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[s.pillText, active && { color: color || TEXT }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CopyBlock({ cmd, label, accent }: { cmd: string; label?: string; accent?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <View style={s.cmdBlock}>
      {label && <Text style={s.cmdLabel}>{label}</Text>}
      <View style={s.cmdInner}>
        <Text style={s.cmdPrompt} selectable={false}>$</Text>
        <Text style={[s.cmdText, accent && { color: accent }]} selectable>{cmd}</Text>
        <TouchableOpacity onPress={copy} style={s.copyBtn} activeOpacity={0.7}>
          <Text style={[s.copyIcon, copied && { color: GREEN }]}>{copied ? "✓" : "⧉"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatusBar({ connected }: { connected: boolean }) {
  return (
    <View style={[s.statusBar, connected && s.statusBarOn]}>
      <View style={[s.statusDot, { backgroundColor: connected ? GREEN : TEXT_3 }]} />
      <Text style={[s.statusBarText, connected && { color: GREEN }]}>
        {connected ? "Relay connected" : "Waiting for daemon…"}
      </Text>
      {!connected && <ActivityIndicator size="small" color={TEXT_3} style={{ marginLeft: "auto" }} />}
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────
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
    setTimeout(() => {
      setConnecting(false);
      if (relay.isConnected) {
        router.push("/");
      } else {
        Alert.alert("Not linked yet", "Run the daemon command on your computer first, then tap Link.");
      }
    }, 2200);
  };

  // ── RUN STEP ────────────────────────────────────────────────────
  if (step === "run") {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => setStep("pick")} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Connect daemon</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.divider} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Session card */}
          <View style={s.sessionCard}>
            <AgentLogo color={agent.color} logo={agent.logo} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={s.sessionCardAgent}>{agent.name}</Text>
              <Text style={s.sessionCardId} numberOfLines={1}>{sessionId}</Text>
            </View>
            <View style={[s.readyBadge, { backgroundColor: GREEN + "14" }]}>
              <View style={[s.statusDot, { backgroundColor: GREEN }]} />
              <Text style={[s.readyText, { color: GREEN }]}>Ready</Text>
            </View>
          </View>

          {/* Step 1 */}
          <Text style={s.stepHeading}>1  Install once</Text>
          <CopyBlock cmd={installCmd} />

          {/* Step 2 */}
          <Text style={s.stepHeading}>2  Wrap your agent</Text>
          <CopyBlock cmd={runCmd} accent={agent.color} />

          {/* Remote relay hint */}
          <View style={s.hintRow}>
            <Text style={s.hintLabel}>Remote relay?</Text>
            <Text style={s.hintValue} selectable>{runCmdFull}</Text>
          </View>

          {/* Attach alternative */}
          <View style={s.altCard}>
            <View style={s.altHeader}>
              <Text style={s.altBadge}>OR</Text>
              <Text style={s.altTitle}>Attach to running agent</Text>
            </View>
            <CopyBlock cmd={attachCmd} />
            <Text style={s.altDesc}>
              Attaches to an already-running process — no wrapping needed.
            </Text>
          </View>

          {/* Status */}
          <StatusBar connected={relay.isConnected} />

          {/* CTA */}
          <TouchableOpacity
            style={[s.primaryBtn, relay.isConnected && { backgroundColor: GREEN }]}
            onPress={handleLink}
            disabled={connecting}
            activeOpacity={0.85}
          >
            {connecting
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnText}>{relay.isConnected ? "Open dashboard" : "Link now"}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── PICK STEP ───────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>New session</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.divider} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Agent grid */}
        <Text style={s.sectionLabel}>Choose agent</Text>
        {AGENTS.map((a) => {
          const sel = agentId === a.id;
          return (
            <Pressable
              key={a.id}
              style={[s.agentRow, sel && { backgroundColor: a.color + "0c", borderColor: a.color + "44" }]}
              onPress={() => setAgentId(a.id)}
            >
              <AgentLogo color={a.color} logo={a.logo} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={[s.agentName, sel && { color: a.color }]}>{a.name}</Text>
                <Text style={s.agentModel}>{a.model}</Text>
              </View>
              {sel && <View style={[s.checkDot, { backgroundColor: a.color }]} />}
            </Pressable>
          );
        })}

        {/* Name input */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>Session name</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder={`${agent.name} session`}
            placeholderTextColor={TEXT_3}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
        </View>

        {/* Model badge */}
        <View style={s.modelRow}>
          <Text style={s.modelRowLabel}>Default model</Text>
          <View style={[s.modelPill, { borderColor: agent.color + "44", backgroundColor: agent.color + "10" }]}>
            <Text style={[s.modelPillText, { color: agent.color }]}>{agent.model}</Text>
          </View>
        </View>

        {/* Create button */}
        <TouchableOpacity
          style={[s.primaryBtn, { borderColor: agent.color + "33", backgroundColor: agent.color + "14" }]}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.8}
        >
          {creating
            ? <ActivityIndicator color={agent.color} />
            : <Text style={[s.primaryBtnText, { color: agent.color }]}>Create session →</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16 },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { color: TEXT, fontSize: 16, fontWeight: "600" },
  backBtn: { width: 36, height: 36, alignItems: "flex-start", justifyContent: "center" },
  backArrow: { color: TEXT_2, fontSize: 20 },
  divider: { height: 1, backgroundColor: LINE },

  sectionLabel: {
    color: TEXT_3, fontSize: 11, fontWeight: "500",
    textTransform: "uppercase", letterSpacing: 0.6,
    marginBottom: 10, marginTop: 20,
  },

  // Agent rows
  agentRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: SURFACE, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    marginBottom: 8,
  },
  agentName: { color: TEXT, fontSize: 14, fontWeight: "500", marginBottom: 2 },
  agentModel: { color: TEXT_3, fontSize: 12 },
  checkDot: { width: 8, height: 8, borderRadius: 4 },

  // Input
  inputWrap: {
    backgroundColor: SURFACE, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, marginBottom: 14,
  },
  input: { color: TEXT, fontSize: 14, paddingHorizontal: 14, paddingVertical: 12 },

  // Model row
  modelRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 20,
  },
  modelRowLabel: { color: TEXT_3, fontSize: 12 },
  modelPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1,
  },
  modelPillText: { fontSize: 11, fontWeight: "500" },

  // Pill
  pill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  pillText: { color: TEXT_3, fontSize: 12 },

  // Buttons
  primaryBtn: {
    borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginBottom: 12,
    borderWidth: 1,
    backgroundColor: SURFACE, borderColor: BORDER,
  },
  primaryBtnText: { color: TEXT, fontSize: 14, fontWeight: "600" },

  // Session card (run step)
  sessionCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 14, marginBottom: 24, marginTop: 8,
  },
  sessionCardAgent: { color: TEXT, fontSize: 14, fontWeight: "600", marginBottom: 3 },
  sessionCardId: { color: TEXT_3, fontSize: 11, fontFamily: "monospace" },
  readyBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  readyText: { fontSize: 11, fontWeight: "500" },

  stepHeading: { color: TEXT_2, fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 4 },

  // Command block
  cmdBlock: { marginBottom: 12 },
  cmdLabel: { color: TEXT_3, fontSize: 11, marginBottom: 5, letterSpacing: 0.3 },
  cmdInner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#111", borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 12, paddingHorizontal: 14, gap: 8,
  },
  cmdPrompt: { color: TEXT_3, fontSize: 13, fontFamily: "monospace" },
  cmdText: { flex: 1, color: TEXT_2, fontSize: 12, fontFamily: "monospace", lineHeight: 18 },
  copyBtn: { padding: 4 },
  copyIcon: { color: TEXT_3, fontSize: 16 },

  // Hint row
  hintRow: {
    backgroundColor: "#111", borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    padding: 12, marginBottom: 12, gap: 4,
  },
  hintLabel: { color: TEXT_3, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  hintValue: { color: TEXT_3, fontSize: 11, fontFamily: "monospace" },

  // Alt card
  altCard: {
    backgroundColor: "#111", borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    padding: 14, marginBottom: 20,
  },
  altHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  altBadge: { color: AMBER, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  altTitle: { color: TEXT_2, fontSize: 13, fontWeight: "600" },
  altDesc: { color: TEXT_3, fontSize: 12, lineHeight: 17, marginTop: 8 },

  // Status bar
  statusBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: SURFACE, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 16,
  },
  statusBarOn: { borderColor: GREEN + "44", backgroundColor: GREEN + "0a" },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusBarText: { color: TEXT_3, fontSize: 13 },
});
