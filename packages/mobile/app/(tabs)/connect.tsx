import React, { useState } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient, API_BASE } from "../../lib/api";
import { useRelay } from "../../lib/relay-context";

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
const GREEN_DIM = "#22c55e14";

type AgentMeta = {
  label: string;
  logo: string;
  color: string;
  model: string;
  desc: string;
};

const AGENTS: Record<string, AgentMeta> = {
  claude:    { label: "Claude Code",  logo: "✦",  color: "#f97316", model: "claude-sonnet-4-5",  desc: "Anthropic agentic coding" },
  opencode:  { label: "OpenCode",     logo: "</>", color: "#818cf8", model: "claude-sonnet-4-5",  desc: "Open-source coding agent" },
  codex:     { label: "Codex CLI",    logo: "⬡",  color: "#38bdf8", model: "o3-mini",             desc: "OpenAI terminal-native" },
  gemini:    { label: "Gemini CLI",   logo: "◈",  color: "#4ade80", model: "gemini-2-5-pro",      desc: "Google Gemini agent" },
  aider:     { label: "Aider",        logo: "⌥",  color: "#f472b6", model: "claude-sonnet-4-5",  desc: "AI pair programming" },
};

export default function ConnectScreen() {
  const router = useRouter();
  const relay = useRelay();
  const insets = useSafeAreaInsets();

  const [agentType, setAgentType] = useState("claude");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"create" | "connect">("create");
  const [sessionId, setSessionId] = useState("");
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const agent = AGENTS[agentType];

  const handleCreate = async () => {
    const sessionName = name.trim() || `${agent.label} Session`;
    setCreating(true);
    try {
      const data = await apiClient.createSession({
        name: sessionName,
        agentType,
        model: agent.model,
      });
      setSessionId(data.id);
      setStep("connect");
    } catch (e) {
      Alert.alert("Error", String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleConnect = () => {
    if (!sessionId) return;
    setConnecting(true);
    const wsUrl = API_BASE.replace("http", "ws").replace(":4200", ":8082");
    relay.connect(sessionId, wsUrl);
    setTimeout(() => {
      setConnecting(false);
      if (relay.isConnected) {
        Alert.alert("Linked", "Phone paired with agent daemon.");
        router.push("/");
      } else {
        Alert.alert("Timeout", "No relay response. Is the daemon running?");
      }
    }, 2000);
  };

  const daemonCommand = `npx @agentpilot/daemon --session ${sessionId}`;

  /* ── CONNECT STEP ─────────────────────────────────── */
  if (step === "connect") {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      >
        <Text style={styles.sysLabel}>SYS://SESSION.READY</Text>
        <Text style={styles.pageTitle}>RUN DAEMON</Text>
        <View style={styles.scanLine} />

        {/* Session ID badge */}
        <View style={styles.sessionBadge}>
          <View style={[styles.agentLogoWrap, { borderColor: agent.color + "44", backgroundColor: agent.color + "11" }]}>
            <Text style={[styles.agentLogo, { color: agent.color }]}>{agent.logo}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionBadgeAgent}>{agent.label}</Text>
            <Text style={styles.sessionBadgeId} numberOfLines={1}>{sessionId}</Text>
          </View>
          <View style={[styles.liveChip, { backgroundColor: GREEN_DIM }]}>
            <Text style={[styles.liveChipText, { color: GREEN }]}>READY</Text>
          </View>
        </View>

        {/* Command block */}
        <Text style={styles.fieldLabel}>// daemon command</Text>
        <View style={styles.cmdBlock}>
          <Text style={styles.cmdPrompt}>$</Text>
          <Text style={styles.cmdText} selectable>{daemonCommand}</Text>
        </View>
        <Text style={styles.cmdHint}>
          Run this on the machine where your agent lives. It streams token events to this app.
        </Text>

        {/* Status */}
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {relay.isConnected ? "RELAY LINKED" : "WAITING FOR DAEMON..."}
          </Text>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: relay.isConnected ? GREEN : ACCENT }]}
          onPress={handleConnect}
          disabled={connecting}
        >
          {connecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {relay.isConnected ? "▶ OPEN DASHBOARD" : "⟳ LINK NOW"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} onPress={() => setStep("create")}>
          <Text style={styles.ghostBtnText}>← START OVER</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  /* ── CREATE STEP ──────────────────────────────────── */
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.sysLabel}>SYS://SESSION.INIT</Text>
      <Text style={styles.pageTitle}>NEW SESSION</Text>
      <View style={styles.scanLine} />

      {/* Agent grid */}
      <Text style={styles.fieldLabel}>// select agent</Text>
      <View style={styles.agentGrid}>
        {Object.entries(AGENTS).map(([id, a]) => {
          const sel = agentType === id;
          return (
            <Pressable
              key={id}
              style={[
                styles.agentCard,
                sel && { borderColor: a.color + "88", backgroundColor: a.color + "0a" },
              ]}
              onPress={() => setAgentType(id)}
            >
              {/* top row */}
              <View style={styles.agentCardTop}>
                <View
                  style={[
                    styles.agentLogoWrap,
                    {
                      borderColor: sel ? a.color + "66" : BORDER,
                      backgroundColor: sel ? a.color + "18" : SURFACE,
                    },
                  ]}
                >
                  <Text style={[styles.agentLogo, { color: sel ? a.color : TEXT_MUTED }]}>
                    {a.logo}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.agentCardName, sel && { color: a.color }]}>
                    {a.label}
                  </Text>
                  <Text style={styles.agentCardModel}>{a.model}</Text>
                </View>
                {sel && (
                  <View style={[styles.selPip, { backgroundColor: a.color }]} />
                )}
              </View>
              {/* desc */}
              <Text style={styles.agentCardDesc}>{a.desc}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Session name */}
      <Text style={styles.fieldLabel}>// session name (optional)</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={`${agent.label} Session`}
          placeholderTextColor={TEXT_MUTED}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
      </View>

      {/* Model badge — read-only, informational */}
      <View style={styles.modelBadge}>
        <Text style={styles.modelBadgeLabel}>DEFAULT MODEL</Text>
        <Text style={[styles.modelBadgeValue, { color: agent.color }]}>{agent.model}</Text>
      </View>

      {/* CTA */}
      <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate} disabled={creating}>
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>CREATE SESSION →</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  sysLabel: {
    color: TEXT_MUTED,
    fontFamily: "SpaceMono",
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 4,
  },
  pageTitle: {
    color: TEXT,
    fontFamily: "SpaceMono",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 14,
  },
  scanLine: { height: 1, backgroundColor: BORDER, marginBottom: 20 },

  fieldLabel: {
    color: TEXT_MUTED,
    fontFamily: "SpaceMono",
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 4,
  },

  /* Agent grid */
  agentGrid: { gap: 8, marginBottom: 20 },
  agentCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
  },
  agentCardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  agentLogoWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  agentLogo: { fontFamily: "SpaceMono", fontSize: 15 },
  agentCardName: { color: TEXT, fontFamily: "SpaceMono", fontSize: 12, fontWeight: "700" },
  agentCardModel: { color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 9, marginTop: 1 },
  agentCardDesc: { color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 9, lineHeight: 14 },
  selPip: { width: 6, height: 6, borderRadius: 3 },

  /* Input */
  inputWrap: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    marginBottom: 14,
  },
  input: {
    color: TEXT,
    fontFamily: "SpaceMono",
    fontSize: 13,
    padding: 12,
  },

  /* Model badge */
  modelBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  modelBadgeLabel: { color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 9, letterSpacing: 2 },
  modelBadgeValue: { fontFamily: "SpaceMono", fontSize: 12, fontWeight: "700" },

  /* Buttons */
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#fff", fontFamily: "SpaceMono", fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  ghostBtn: { paddingVertical: 12, alignItems: "center" },
  ghostBtnText: { color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 11, letterSpacing: 1 },

  /* Connect step */
  sessionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  sessionBadgeAgent: { color: TEXT, fontFamily: "SpaceMono", fontSize: 12, fontWeight: "700" },
  sessionBadgeId: { color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 9, marginTop: 2 },
  liveChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  liveChipText: { fontFamily: "SpaceMono", fontSize: 9, letterSpacing: 1 },

  cmdBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  cmdPrompt: { color: ACCENT, fontFamily: "SpaceMono", fontSize: 13 },
  cmdText: { flex: 1, color: TEXT, fontFamily: "SpaceMono", fontSize: 11, lineHeight: 18 },
  cmdHint: { color: TEXT_MUTED, fontFamily: "SpaceMono", fontSize: 9, lineHeight: 16, marginBottom: 20 },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  statusText: { color: TEXT_DIM, fontFamily: "SpaceMono", fontSize: 10, letterSpacing: 1 },
});
