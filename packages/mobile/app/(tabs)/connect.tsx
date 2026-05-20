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

// ── Design tokens ────────────────────────────────────────────────
const BG      = "#080808";
const SURFACE = "#111111";
const CARD    = "#141414";
const BORDER  = "#1f1f1f";
const LINE    = "#161616";
const TEXT    = "#ffffff";
const TEXT_2  = "#888";
const TEXT_3  = "#3a3a3a";
const GREEN   = "#22c55e";
const AMBER   = "#f59e0b";
const RED     = "#ef4444";
const TEAL    = "#14b8a6";
const VIOLET  = "#7c3aed";
const PURPLE  = "#a78bfa";

const AGENTS = [
  { id: "claude",   name: "Claude Code",     model: "claude-sonnet-4-5", color: "#D4A574", logo: "A"  },
  { id: "opencode", name: "OpenCode",         model: "claude-sonnet-4-5", color: "#818CF8", logo: "O"  },
  { id: "codex",    name: "Codex CLI",        model: "o3",                color: "#10A37F", logo: "C"  },
  { id: "gemini",   name: "Gemini CLI",       model: "gemini-2-5-pro",    color: "#4285F4", logo: "G"  },
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

// ── Agent logo with glow ──────────────────────────────────────────
function AgentLogo({ color, logo, size = 40 }: { color: string; logo: string; size?: number }) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size * 0.3,
      backgroundColor: color + "15",
      borderWidth: 1,
      borderColor: color + "40",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: color,
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
    }}>
      <Text style={{ color, fontSize: size * 0.4, fontWeight: "800" }}>{logo}</Text>
    </View>
  );
}

// ── Terminal copy block ───────────────────────────────────────────
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
      <TouchableOpacity style={[s.cmdInner, accent && { borderColor: accent + "30" }]} onPress={copy} activeOpacity={0.7}>
        <Text style={s.cmdPrompt} selectable={false}>$</Text>
        <Text style={[s.cmdText, { color: accent || TEAL }]} selectable>{cmd}</Text>
        <View style={[s.copyBadge, copied && { backgroundColor: GREEN + "20", borderColor: GREEN + "40" }]}>
          <Text style={[s.copyIcon, { color: copied ? GREEN : TEXT_3 }]}>{copied ? "✓" : "copy"}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Relay status banner ───────────────────────────────────────────
function StatusBanner({ connected }: { connected: boolean }) {
  return (
    <View style={[s.statusBanner, connected && {
      borderColor: GREEN + "40",
      backgroundColor: GREEN + "08",
    }]}>
      <View style={[s.statusDot, {
        backgroundColor: connected ? GREEN : TEXT_3,
        shadowColor: connected ? GREEN : "transparent",
        shadowOpacity: 1,
        shadowRadius: 6,
      }]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.statusTitle, { color: connected ? GREEN : TEXT_2 }]}>
          {connected ? "Relay connected" : "Waiting for daemon"}
        </Text>
        <Text style={s.statusSub}>
          {connected ? "Agent data flowing" : "Run the command below on your machine"}
        </Text>
      </View>
      {!connected && <ActivityIndicator size="small" color={TEXT_3} />}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────
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

  // ── RUN STEP ─────────────────────────────────────────────────────
  if (step === "run") {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => setStep("pick")} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Connect daemon</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.divider} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Session card */}
          <View style={[s.sessionCard, {
            borderColor: agent.color + "35",
            shadowColor: agent.color,
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 6,
          }]}>
            <AgentLogo color={agent.color} logo={agent.logo} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={s.sessionCardAgent}>{agent.name}</Text>
              <Text style={s.sessionCardId} numberOfLines={1} selectable>{sessionId}</Text>
            </View>
            <View style={[s.readyBadge, {
              backgroundColor: GREEN + "12",
              borderColor: GREEN + "40",
            }]}>
              <View style={[s.statusDot, {
                backgroundColor: GREEN,
                shadowColor: GREEN,
                shadowOpacity: 1,
                shadowRadius: 5,
              }]} />
              <Text style={[s.readyText, { color: GREEN }]}>Ready</Text>
            </View>
          </View>

          {/* Step 1 */}
          <View style={s.stepBlock}>
            <View style={s.stepNumWrap}>
              <Text style={s.stepNum}>1</Text>
            </View>
            <Text style={s.stepTitle}>Install once</Text>
          </View>
          <CopyBlock cmd={installCmd} />

          {/* Step 2 */}
          <View style={s.stepBlock}>
            <View style={[s.stepNumWrap, { backgroundColor: agent.color + "20", borderColor: agent.color + "40" }]}>
              <Text style={[s.stepNum, { color: agent.color }]}>2</Text>
            </View>
            <Text style={s.stepTitle}>Wrap your agent</Text>
          </View>
          <CopyBlock cmd={runCmd} accent={agent.color} />

          {/* Remote relay hint */}
          <View style={s.hintBox}>
            <Text style={s.hintTitle}>Remote relay URL</Text>
            <Text style={s.hintValue} selectable>{runCmdFull}</Text>
          </View>

          {/* OR: Attach */}
          <View style={s.orDivider}>
            <View style={s.orLine} />
            <Text style={s.orText}>OR</Text>
            <View style={s.orLine} />
          </View>

          <View style={[s.altCard, { borderColor: AMBER + "25" }]}>
            <Text style={s.altTitle}>Attach to running agent</Text>
            <Text style={s.altDesc}>No wrapping needed — connects to an already-running process.</Text>
            <CopyBlock cmd={attachCmd} accent={AMBER} />
          </View>

          {/* Status */}
          <StatusBanner connected={relay.isConnected} />

          {/* CTA */}
          <TouchableOpacity
            style={[s.bigBtn, {
              backgroundColor: relay.isConnected ? GREEN : VIOLET,
              shadowColor: relay.isConnected ? GREEN : VIOLET,
              shadowOpacity: 0.6,
              shadowRadius: 20,
              elevation: 10,
            }]}
            onPress={handleLink}
            disabled={connecting}
            activeOpacity={0.85}
          >
            {connecting
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.bigBtnText}>
                  {relay.isConnected ? "Open dashboard →" : "Link now →"}
                </Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── PICK STEP ─────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>New session</Text>
        <View style={{ width: 40 }} />
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
              style={[s.agentCard, sel && {
                backgroundColor: a.color + "0d",
                borderColor: a.color + "50",
                shadowColor: a.color,
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 5,
              }]}
              onPress={() => setAgentId(a.id)}
            >
              <AgentLogo color={a.color} logo={a.logo} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={[s.agentName, sel && { color: a.color }]}>{a.name}</Text>
                <Text style={s.agentModel}>{a.model}</Text>
              </View>
              {sel && (
                <View style={[s.checkCircle, {
                  borderColor: a.color,
                  shadowColor: a.color,
                  shadowOpacity: 0.7,
                  shadowRadius: 6,
                }]}>
                  <View style={[s.checkInner, { backgroundColor: a.color }]} />
                </View>
              )}
            </Pressable>
          );
        })}

        {/* Session name */}
        <Text style={[s.sectionLabel, { marginTop: 28 }]}>Session name</Text>
        <View style={[s.inputWrap, { borderColor: agent.color + "30" }]}>
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

        {/* Model info */}
        <View style={s.modelRow}>
          <Text style={s.modelRowLabel}>Model</Text>
          <View style={[s.modelPill, {
            borderColor: agent.color + "40",
            backgroundColor: agent.color + "10",
          }]}>
            <Text style={[s.modelPillText, { color: agent.color }]}>{agent.model}</Text>
          </View>
        </View>

        {/* Create */}
        <TouchableOpacity
          style={[s.bigBtn, {
            backgroundColor: agent.color,
            shadowColor: agent.color,
            shadowOpacity: 0.5,
            shadowRadius: 16,
            elevation: 8,
          }]}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.8}
        >
          {creating
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.bigBtnText}>Create & connect →</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { color: TEXT, fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  backBtn: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  backArrow: { color: TEXT_2, fontSize: 22 },
  divider: { height: 1, backgroundColor: LINE },

  sectionLabel: {
    color: TEXT_3,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 24,
  },

  // Agent cards
  agentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  agentName: { color: TEXT, fontSize: 15, fontWeight: "600", marginBottom: 3 },
  agentModel: { color: TEXT_3, fontSize: 12, fontWeight: "400" },
  checkCircle: {
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
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
  },
  input: {
    color: TEXT,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  // Model row
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  modelRowLabel: { color: TEXT_3, fontSize: 13 },
  modelPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  modelPillText: { fontSize: 12, fontWeight: "600" },

  // Big CTA button
  bigBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  bigBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Session card (run step)
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 28,
    marginTop: 8,
  },
  sessionCardAgent: { color: TEXT, fontSize: 15, fontWeight: "600", marginBottom: 4 },
  sessionCardId: { color: TEXT_3, fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  readyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  readyText: { fontSize: 11, fontWeight: "700" },

  // Step labels
  stepBlock: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 6 },
  stepNumWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: { color: TEXT_3, fontSize: 12, fontWeight: "700" },
  stepTitle: { color: TEXT_2, fontSize: 13, fontWeight: "600" },

  // Terminal command block
  cmdBlock: { marginBottom: 14 },
  cmdLabel: { color: TEXT_3, fontSize: 10, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  cmdInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  cmdPrompt: { color: TEXT_3, fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  cmdText: { flex: 1, fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 18 },
  copyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  copyIcon: { fontSize: 11, fontWeight: "600" },

  // Hint box
  hintBox: {
    backgroundColor: "#0d0d0d",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 20,
    gap: 6,
  },
  hintTitle: { color: TEXT_3, fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  hintValue: {
    color: TEXT_3,
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 17,
  },

  // OR divider
  orDivider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  orLine: { flex: 1, height: 1, backgroundColor: LINE },
  orText: { color: TEXT_3, fontSize: 11, fontWeight: "600", letterSpacing: 1 },

  // Alt card
  altCard: {
    backgroundColor: "#0a0808",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    gap: 8,
  },
  altTitle: { color: TEXT, fontSize: 14, fontWeight: "600" },
  altDesc: { color: TEXT_3, fontSize: 12, lineHeight: 17 },

  // Status banner
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusTitle: { color: TEXT_2, fontSize: 13, fontWeight: "600" },
  statusSub: { color: TEXT_3, fontSize: 11, marginTop: 2 },
});
