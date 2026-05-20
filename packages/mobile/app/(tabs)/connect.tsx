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
} from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing, radius } from "../../lib/theme";
import { apiClient, API_BASE } from "../../lib/api";
import { useRelay } from "../../lib/relay-context";

const AGENT_TYPES = [
  { id: "claude", label: "Claude Code", desc: "Anthropic's Claude with computer use", color: colors.agentClaude },
  { id: "opencode", label: "OpenCode", desc: "Open-source coding agent", color: colors.agentOpencode },
  { id: "codex", label: "Codex CLI", desc: "OpenAI's terminal-native coding agent", color: colors.agentCodex },
  { id: "custom", label: "Custom Agent", desc: "Any LLM agent with token event webhook", color: colors.textSecondary },
];

const MODELS_BY_AGENT: Record<string, string[]> = {
  claude: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"],
  opencode: ["claude-sonnet-4-5", "gpt-4o", "gemini-2-5-pro"],
  codex: ["o3-mini", "gpt-4o", "gpt-4o-mini"],
  custom: ["gpt-4o", "gpt-4o-mini", "claude-haiku-3-5", "gemini-2-5-flash"],
};

function AgentCard({ agent, selected, onPress }: { agent: typeof AGENT_TYPES[0]; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.agentCard, selected && { borderColor: agent.color, backgroundColor: `${agent.color}10` }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.agentCardTop}>
        <View style={[styles.agentDot, { backgroundColor: agent.color }]} />
        <Text style={[styles.agentCardLabel, selected && { color: agent.color }]}>{agent.label}</Text>
      </View>
      <Text style={styles.agentCardDesc}>{agent.desc}</Text>
    </TouchableOpacity>
  );
}

export default function ConnectScreen() {
  const router = useRouter();
  const relay = useRelay();
  const [agentType, setAgentType] = useState("claude");
  const [model, setModel] = useState("claude-sonnet-4-5");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"create" | "connect">("create");
  const [sessionId, setSessionId] = useState("");
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleAgentChange = (id: string) => {
    setAgentType(id);
    setModel(MODELS_BY_AGENT[id][0]);
  };

  const handleCreate = async () => {
    const sessionName = name.trim() || `${AGENT_TYPES.find((a) => a.id === agentType)?.label} Session`;
    setCreating(true);
    try {
      const data = await apiClient.createSession({ name: sessionName, agentType, model });
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
        Alert.alert("Connected", "Your phone is now paired with the agent daemon.");
        router.push("/");
      } else {
        Alert.alert("Connection Failed", "Make sure the relay server is running on your laptop.");
      }
    }, 2000);
  };

  const daemonCommand = `npx @agentpilot/daemon --session ${sessionId}`;

  if (step === "connect") {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Connect Agent</Text>
          <Text style={styles.headerSub}>Your session is ready</Text>
        </View>

        <View style={[styles.card, { borderLeftColor: colors.accent, borderLeftWidth: 3 }]}>
          <Text style={styles.label}>DAEMON COMMAND</Text>
          <View style={styles.commandBox}>
            <Text style={styles.commandText}>{daemonCommand}</Text>
          </View>
          <Text style={styles.hint}>Run this on the laptop where your agent is running</Text>
        </View>

        <TouchableOpacity style={styles.connectBtn} onPress={handleConnect} disabled={connecting}>
          {connecting ? <ActivityIndicator color="#fff" /> : <Text style={styles.connectBtnText}>🔗 Connect Now</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => setStep("create")}>
          <Text style={styles.backBtnText}>← Start Over</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Session</Text>
        <Text style={styles.headerSub}>Configure your agent cockpit</Text>
      </View>

      <Text style={styles.label}>AGENT TYPE</Text>
      <View style={styles.agentGrid}>
        {AGENT_TYPES.map((a) => (
          <AgentCard key={a.id} agent={a} selected={agentType === a.id} onPress={() => handleAgentChange(a.id)} />
        ))}
      </View>

      <Text style={styles.label}>MODEL</Text>
      <View style={styles.modelRow}>
        {MODELS_BY_AGENT[agentType].map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modelChip, model === m && styles.modelChipActive]}
            onPress={() => setModel(m)}
            activeOpacity={0.7}
          >
            <Text style={[styles.modelChipText, model === m && styles.modelChipTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>NAME (optional)</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={`${AGENT_TYPES.find((a) => a.id === agentType)?.label} Session`}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
      </View>

      <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={creating}>
        {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create & Get Command</Text>}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 60 },
  header: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { color: colors.text, fontSize: 24, fontFamily: "SpaceMono", fontWeight: "700" },
  headerSub: { color: colors.textMuted, fontSize: 11, fontFamily: "SpaceMono", marginTop: 2 },

  label: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", letterSpacing: 2, marginBottom: spacing.sm, marginTop: spacing.lg },

  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  commandBox: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  commandText: { color: colors.text, fontFamily: "SpaceMono", fontSize: 12, lineHeight: 18 },
  hint: { color: colors.textMuted, fontSize: 11, fontFamily: "SpaceMono", lineHeight: 17 },

  connectBtn: { backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md },
  connectBtnText: { color: "#fff", fontFamily: "SpaceMono", fontSize: 14, fontWeight: "700" },
  backBtn: { marginTop: spacing.lg, alignItems: "center" },
  backBtnText: { color: colors.textMuted, fontFamily: "SpaceMono", fontSize: 12 },

  agentGrid: { gap: spacing.sm },
  agentCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  agentCardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 4 },
  agentDot: { width: 8, height: 8, borderRadius: 4 },
  agentCardLabel: { color: colors.text, fontFamily: "SpaceMono", fontSize: 13, fontWeight: "700" },
  agentCardDesc: { color: colors.textMuted, fontFamily: "SpaceMono", fontSize: 10, lineHeight: 16 },

  modelRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  modelChip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  modelChipActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  modelChipText: { color: colors.textMuted, fontSize: 11, fontFamily: "SpaceMono" },
  modelChipTextActive: { color: colors.accent },

  inputWrap: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  input: { color: colors.text, fontFamily: "SpaceMono", fontSize: 14, padding: spacing.md },

  createBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xl },
  createBtnText: { color: "#fff", fontFamily: "SpaceMono", fontSize: 14, fontWeight: "700" },
});
